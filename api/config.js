// Only public configuration is returned; service-role and Stripe secrets stay server-side.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const configured = /^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(url) && anonKey.length > 20;
  return res.status(200).json({
    configured,
    supabaseUrl: configured ? url.replace(/\/$/, '') : null,
    supabaseAnonKey: configured ? anonKey : null,
    billingConfigured: configured && Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY),
    trialDays: 14
  });
};
