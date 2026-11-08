'use strict';
const APP_ORIGIN = 'https://sessiondesk-app.vercel.app';
function method(req, res, allowed = 'POST') {
  if (req.method !== allowed) { res.setHeader('Allow', allowed); res.status(405).json({ error: 'Method not allowed' }); return false; }
  res.setHeader('Cache-Control', 'no-store');
  return true;
}
function config(names) {
  for (const name of names) if (!process.env[name]) throw new Error('Missing server configuration: '+name);
}
function origin() {
  const raw = process.env.APP_URL || APP_ORIGIN;
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('APP_URL must be an HTTPS origin');
  return url.origin;
}
async function authenticatedUser(req) {
  config(['SUPABASE_URL','SUPABASE_ANON_KEY']);
  const token = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw Object.assign(new Error('Sign in first'), { status: 401 });
  const response = await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/auth/v1/user', {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer '+token },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw Object.assign(new Error('Session expired; sign in again'), { status: 401 });
  const user = await response.json();
  if (!/^[0-9a-f-]{36}$/i.test(user.id||'') || !user.email) throw Object.assign(new Error('Invalid account'), { status: 401 });
  return user;
}
async function stripe(endpoint, params) {
  config(['STRIPE_SECRET_KEY']);
  const response = await fetch('https://api.stripe.com/v1/'+endpoint, {
    method: 'POST',
    headers: { Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY, 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Billing provider error');
  return result;
}
async function supabaseAdmin(path, options={}) {
  config(['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/'+path, {
    ...options,
    headers: { apikey: key, Authorization:'Bearer '+key, ...options.headers },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0,250);
    throw new Error('Database request failed ('+response.status+'): '+detail);
  }
  if (response.status===204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
function fail(res, error) {
  console.error('SessionDesk API:', error.message);
  return res.status(error.status || 500).json({ error: error.status ? error.message : 'Service temporarily unavailable' });
}
module.exports = { method, config, origin, authenticatedUser, stripe, supabaseAdmin, fail };
