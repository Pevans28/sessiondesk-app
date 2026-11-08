# SessionDesk — client session tracking

SessionDesk is a lightweight client/package tracker for trainers, coaches, tutors, Pilates instructors and independent professionals.

**Production currently runs the working browser-only MVP.** The `feature/cloud-saas-foundation` branch adds an opt-in Supabase + Stripe foundation but **is not production-ready until the checklist below is completed**. Never publish server secrets or real customer records in GitHub.

## What works without accounts

- Client roster, package credits and session history.
- Manual payment tracking, renewal reminders, filtering and archiving.
- CSV exports and JSON backups/restores.
- Mobile-responsive layout and the original localStorage workflow.
- No paid plan or cloud infrastructure required.

## Additional features on this branch

- Account sign-up, sign-in, and optional cloud workspace syncing.
- Separate browser records, explicit import, and revision-checked cloud saves to prevent silent multi-device overwrites.
- Supabase Row Level Security isolating each customer's workspace.
- 14-day trial logic for workspace edits (read-only after trial unless Stripe grants an active subscription).
- Stripe Checkout, Stripe Billing Portal, and signature-verified subscription webhooks.

**Important:** This is an infrastructure foundation, not a commercially ready subscription app. It needs database creation, Stripe configuration, production deployment testing, auth hardening, data protection review, privacy policy, terms, support workflows and account deletion. The public local mode remains available, so access to that mode is **not paywalled**.

## Setup sequence

1. Create a Supabase project in your organization. Keep the project's service-role key private.
2. In **Supabase SQL Editor**, carefully review and run `sql/001_cloud_saas.sql`. Enable email sign-in and configure email verification, redirect URLs and an SMTP sender. Enable leaked-password protection if available.
3. In Vercel **Project → Settings → Environment Variables**, set:
   - `SUPABASE_URL` — `https://<project>.supabase.co`
   - `SUPABASE_ANON_KEY` — Supabase public **anon** JWT key (safe for browser)
   - `SUPABASE_SERVICE_ROLE_KEY` — **server-only** service-role key
   - `APP_URL` — `https://sessiondesk-app.vercel.app` for the production domain; set a distinct preview URL for preview deployments
   - `STRIPE_SECRET_KEY` — restricted server secret key from your Stripe account
   - `STRIPE_PRICE_ID` — recurring Stripe subscription Price ID, created in Stripe
   - `STRIPE_WEBHOOK_SECRET` — signing secret for your Stripe webhook endpoint
4. In Stripe, create a recurring product/price; activate a customer portal configuration. Register webhook URL `https://sessiondesk-app.vercel.app/api/webhook`, with:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. **Test in Stripe test mode** with test keys and a test price before switching to live keys. Validate signup, email verification, login, logout, cloud import, multi-account isolation, concurrent edit conflicts, renewal, cancellations, trial expiry, and checkout/webhook/portal.
6. Set up a production SMTP email sender, custom domain, error monitoring, database backup/restore, support/contact, account deletion/export, privacy/terms, and tax/billing compliance review.
7. Merge to the protected production branch **only after** tests pass and the owner approves the launch.

## Data protection boundaries

- Local mode stores browser data in `localStorage`; clearing storage can erase it.
- Cloud mode uses the signed-in account token with Supabase RLS. Stored account tokens are scoped to the current browser tab's session storage; client data is never intentionally written into localStorage during cloud mode. Use normal browser security precautions and a tested CSP before paid launch.
- Auth access is verified by Supabase. Subscription state can only be changed by the server's Stripe webhook. Trial/write rules are enforced by Postgres RLS, not by a cosmetic frontend label.
- Browser-only records are not automatically uploaded. Importing existing browser data requires deliberate confirmation.
- Cloud revisions reject overwriting a newer version from another device. The current conflict workflow is deliberately conservative: export a backup and reload; automatic record merging is not implemented.
- Clients should not use the MVP for sensitive medical, government ID, or financial information.

## Known launch blockers

- Supabase and Stripe credentials/environment settings are not configured.
- Cloud and billing code has not been end-to-end tested against real test-mode services.
- An account can still use the freely available local-only mode: this must be addressed before selling subscriptions as enforced access.
- Production-grade account recovery, account deletion, privacy, terms and user support aren't implemented.
- Cloud client data is a JSON document rather than a normalized relational model; add schema checks, payload limits, rigorous migrations, and per-client operations before scaling.
- The SessionDesk name is provisional until trademark, domain and App Store availability are reviewed.
