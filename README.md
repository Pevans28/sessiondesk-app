# SessionDesk — single-file client package tracker

A completely separate starter app for trainers, coaches, Pilates instructors, tutors, and other independent professionals.

## What is included
- Mobile-responsive client list
- Package session credits / balances
- Log completed sessions
- Add credits when a client renews
- Record payments manually
- Client activity history and renewal reminder text
- Search, low-balance filter, archive/restore
- CSV export, JSON backup and restore
- One HTML file; no npm install, API key, or database needed

## Launch with GitHub + Vercel
1. Create a **new** GitHub repository (e.g., `sessiondesk-app`). Do not put this in your FixFlip repository.
2. Choose **Add file > Upload files**, and upload `index.html` at the top level of the repo.
3. Visit Vercel and choose **Add New > Project**. Import the new repository.
4. Choose Framework Preset `Other` (or leave auto-detection); leave build command blank. Deploy.
5. Open your Vercel deployment URL. On a phone, users can visit the site and optionally bookmark/add the site to their home screen.

Alternative: publish `index.html` via GitHub Pages, Cloudflare Pages, or Netlify static hosting.

## Important commercial limitation
This release is a fully functional **single-device/local-browser MVP**. It stores data in the visitor's browser using localStorage. It is not a paid multi-user SaaS yet: there is no login, secure cloud backup, subscriber billing, automated reminders, or cross-device syncing. Browser data can be lost if someone clears site storage; use the backup button regularly.

To commercialize subscriptions, build authentication + per-user database storage (Supabase or equivalent), Stripe Checkout + verified webhooks, server-side entitlement checks, secure backups and encryption/access rules, clear terms/privacy notices, and support. A payment link alone would not restrict access to a public static app.

## Notes
- All package prices are displayed in USD, for illustration; no charges are processed by the app.
- Session counts and recorded payments are manually entered. No banking integrations.
- The name SessionDesk is provisional; check trademarks, domains and app availability before investing in a brand.
- Test with mock records first. Don't store real sensitive client health details in this local proof of concept.
