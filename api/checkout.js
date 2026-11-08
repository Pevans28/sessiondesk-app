const {method,config,origin,authenticatedUser,stripe,fail}=require('../lib/server');
module.exports = async function handler(req,res) {
  if (!method(req,res)) return;
  try {
    config(['STRIPE_SECRET_KEY','STRIPE_PRICE_ID']);
    const user = await authenticatedUser(req);
    const app = origin();
    const session = await stripe('checkout/sessions', {
      mode:'subscription',
      'line_items[0][price]':process.env.STRIPE_PRICE_ID,
      'line_items[0][quantity]':'1',
      client_reference_id:user.id,
      customer_email:user.email,
      'metadata[user_id]':user.id,
      'subscription_data[metadata][user_id]':user.id,
      success_url:app+'/?billing=success',
      cancel_url:app+'/?billing=cancel',
      allow_promotion_codes:'true'
    });
    return res.status(200).json({ url:session.url });
  } catch(error) {return fail(res,error);}
};
