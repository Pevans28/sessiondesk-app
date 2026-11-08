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


## SessionDesk 2.0 interface (November 2026)

A redesigned responsive dashboard is now available on this development branch and is **not merged to production**. It uses the same `sessiondesk_v1` browser storage key as the original version to retain existing local customer records.

### Working local features

- Mobile and desktop dashboard with four KPI cards, 7-day activity chart, recent activity, renewal watchlist, and upcoming appointments.
- Client directory with search, active/archived/renewal filters, edit, archive and restore.
- Manual package session logging, package renewals, and client payment records.
- Calendar with create/edit/cancel appointments and a complete-and-deduct-one-session action.
- Client detail modal, history, notes and copyable renewal-message text.
- Settings for business name, industry and low-package threshold.
- JSON backup/restore, client CSV export, offline-cached app shell, and installable PWA manifest.
- Optional cloud mode preserves the new appointment and preferences fields.

### Known limitations before commercial launch

- Stripe subscriptions are a *code foundation*, not live payments. You must configure accounts, secure environment variables, SQL schema, billing webhooks and a Stripe sandbox first.
- Payment entries do not charge clients; appointments do not send invitations; renewal copy does not send an SMS.
- The PWA works as an installable **web app**, not as a published native iOS/Android app or App Store listing.
- Local mode remains usable without paid access. Disable or redesign it before offering a fully enforced paid subscription.
- The PWA caches app-shell assets for offline viewing. Test offline behavior and cache updates on actual iOS and Android devices.
- Static checks are in `tests/smoke.cjs` and GitHub Actions; **these do not replace browser, payment, authentication and security testing**.
- Privacy policy, terms of service, support contact, data deletion and branding/trademark review need owner approval before selling.

### Owner's manual setup checklist

1. Create a Supabase project, enable email auth/verification, run `sql/001_cloud_saas.sql` in a nonproduction project first.
2. Create a Stripe subscription product, recurring price and webhook, starting with Stripe test mode.
3. Set the environment variables listed earlier in Vercel (use separate preview/test and production credentials).
4. Configure SMTP email delivery, account recovery, privacy policy, terms of service, support email and user data deletion.
5. Test two separate customer accounts to verify database row isolation and browser-to-cloud import.
6. Test subscription checkout, payment failures, cancellation, webhook signature checks and trial expiration.
7. Test the interface on iPhone, Android, desktop and offline; check navigation, client/session edits, calendar, import/export and reinstall.
8. Review the draft pull request, complete testing, then merge when ready. No manual copying of app code is required.

