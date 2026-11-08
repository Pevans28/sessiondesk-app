const {method,config,origin,authenticatedUser,stripe,supabaseAdmin,fail}=require('../lib/server');
module.exports = async function handler(req,res) {
  if (!method(req,res)) return;
  try {
    config(['STRIPE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY']);
    const user = await authenticatedUser(req);
    const rows = await supabaseAdmin('account_subscriptions?user_id=eq.'+encodeURIComponent(user.id)+'&select=stripe_customer_id');
    const customer = rows?.[0]?.stripe_customer_id;
    if (!customer) return res.status(409).json({error:'No subscription customer found yet'});
    const session = await stripe('billing_portal/sessions',{ customer, return_url:origin()+'/' });
    return res.status(200).json({url:session.url});
  } catch(error) {return fail(res,error);}
};
