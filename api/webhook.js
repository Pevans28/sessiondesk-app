'use strict';
const {createHmac,timingSafeEqual}=require('node:crypto');
const {method,config,supabaseAdmin,fail}=require('../lib/server');
function parseSignature(header, body, secret) {
  const pairs=String(header||'').split(',').map(part=>part.split('=',2));
  const timestamp=pairs.find(([key])=>key==='t')?.[1];
  const signatures=pairs.filter(([key])=>key==='v1').map(([,sig])=>sig);
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))>300) return false;
  const digest=createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');
  return signatures.some(sig => /^[a-f0-9]{64}$/i.test(sig) && timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(digest,'hex')));
}
async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') throw new Error('Webhook raw body unavailable; configure raw request handling');
  const buffers=[];let size=0;
  for await (const chunk of req) {size+=chunk.length;if(size>1024*1024) throw new Error('Webhook too large');buffers.push(chunk);}
  return Buffer.concat(buffers).toString('utf8');
}
async function lookupUserByCustomer(customer) {
  if (!customer) return null;
  const result=await supabaseAdmin('account_subscriptions?stripe_customer_id=eq.'+encodeURIComponent(customer)+'&select=user_id');
  return result?.[0]?.user_id || null;
}
async function applySubscription(obj, created) {
  const userId=obj.metadata?.user_id || await lookupUserByCustomer(obj.customer);
  if (!/^[0-9a-f-]{36}$/i.test(userId||'')) throw new Error('Cannot associate Stripe subscription with a SessionDesk user');
  const current=await supabaseAdmin('account_subscriptions?user_id=eq.'+encodeURIComponent(userId)+'&select=last_stripe_event_created');
  if ((current?.[0]?.last_stripe_event_created||0)>created) return;
  const period = obj.current_period_end || obj.items?.data?.[0]?.current_period_end || 0;
  const row={user_id:userId,stripe_customer_id:obj.customer,stripe_subscription_id:obj.id,
    status:obj.status, current_period_end:period ? new Date(period*1000).toISOString():null,
    last_stripe_event_created:created, updated_at:new Date().toISOString()};
  await supabaseAdmin('account_subscriptions?on_conflict=user_id',{method:'POST',
    headers:{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify(row)});
}
async function applyCheckout(obj, created) {
  const userId=obj.client_reference_id || obj.metadata?.user_id;
  if (!/^[0-9a-f-]{36}$/i.test(userId||'')) throw new Error('Checkout missing user identity');
  // Does not grant access: only subscription events update paid entitlements.
  await supabaseAdmin('account_subscriptions?user_id=eq.'+encodeURIComponent(userId),{method:'PATCH',
    headers:{'Content-Type':'application/json','Prefer':'return=minimal'},
    body:JSON.stringify({stripe_customer_id:obj.customer, stripe_subscription_id:obj.subscription || null,updated_at:new Date().toISOString()})});
}
module.exports.config = { api: { bodyParser: false } };
module.exports = Object.assign(async function handler(req,res) {
  if (!method(req,res)) return;
  try {
    config(['STRIPE_WEBHOOK_SECRET','SUPABASE_SERVICE_ROLE_KEY']);
    const body=await rawBody(req);
    if (!parseSignature(req.headers['stripe-signature'],body,process.env.STRIPE_WEBHOOK_SECRET)) return res.status(400).json({error:'Invalid webhook signature'});
    const event=JSON.parse(body);
    if (!event?.id || !event?.data?.object || !Number.isInteger(event.created)) return res.status(400).json({error:'Invalid Stripe event'});
    if (event.type==='checkout.session.completed') await applyCheckout(event.data.object,event.created);
    if (['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type))
      await applySubscription(event.data.object,event.created);
    return res.status(200).json({received:true});
  } catch(error) {return fail(res,error);}
}, { config: { api: { bodyParser: false } } });
