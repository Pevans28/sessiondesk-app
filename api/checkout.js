const {method,config,origin,authenticatedUser,stripe,supabaseAdmin,fail}=require('../lib/server');

module.exports = async function handler(req,res) {
  if (!method(req,res)) return;
  try {
    config(['STRIPE_SECRET_KEY','STRIPE_PRICE_ID','SUPABASE_SERVICE_ROLE_KEY']);
    const user = await authenticatedUser(req);
    const rows = await supabaseAdmin('account_subscriptions?user_id=eq.'+encodeURIComponent(user.id)+'&select=stripe_customer_id,stripe_subscription_id,status');
    if (!rows?.length) return res.status(409).json({error:'Finish account setup before subscribing.'});
    const account=rows[0];
    // Do not offer a second Checkout to an already subscribed customer.
    if (account.stripe_subscription_id && ['active','trialing','past_due','unpaid'].includes(account.status))
      return res.status(409).json({error:'A subscription already exists. Choose Manage billing instead.'});
    const app=origin();
    const params={
      mode:'subscription',
      'line_items[0][price]':process.env.STRIPE_PRICE_ID,
      'line_items[0][quantity]':'1',
      client_reference_id:user.id,
      'metadata[user_id]':user.id,
      'subscription_data[metadata][user_id]':user.id,
      success_url:app+'/?billing=success',
      cancel_url:app+'/?billing=cancel',
      allow_promotion_codes:'true'
    };
    // Reuse the known customer to avoid duplicate billing portal accounts.
    if (account.stripe_customer_id) params.customer=account.stripe_customer_id;
    else params.customer_email=user.email;
    const session=await stripe('checkout/sessions',params);
    if (!session.url || !session.url.startsWith('https://checkout.stripe.com/'))
      throw new Error('Unexpected Checkout URL');
    return res.status(200).json({url:session.url});
  } catch(error) {return fail(res,error);}
};
