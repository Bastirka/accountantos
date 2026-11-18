# AccountantOS

A bookkeeping workflow MVP for Latvian accountants.

## Deployment
This repo contains a static web client backed by Supabase Auth and a per-user JSONB workspace.

1. In Supabase SQL Editor, run `sql/setup.sql` (already done for the connected project).
2. Confirm the `public.workspaces` table has the Data API permissions required by the authenticated role. Keep RLS enabled and ownership policies in place.
3. In Supabase Authentication > URL Configuration, configure the deployed Vercel URL under Site URL and Redirect URLs.
4. Deploy the repository as a static Vercel project.
5. Test creating and reloading a company, then test that different accounts cannot access each other's data.

## Limitations
Testing MVP only. Matching and VAT summaries require human accountant verification. No bank feed, VID submission or active Stripe billing is configured. Do not upload real customer financial data until auth, RLS, backup and security testing are completed.

Never put Supabase secret keys or Stripe secrets in this repository.

## Stripe test subscriptions (not yet activated)
Implemented server routes:
- `POST /api/checkout` — authenticated Stripe Checkout session; allowed plans starter, professional, agency.
- `POST /api/portal` — authenticated Stripe Billing Portal.
- `GET /api/billing` — user-scoped billing status.
- `POST /api/webhook` — signature-verified subscription updates to `billing_accounts`.

Set **encrypted** Vercel environment variables, never commit them:
- `SUPABASE_SECRET_KEY`: freshly rotated Supabase secret key (server-only)
- `STRIPE_SECRET_KEY`: Stripe **test mode** secret key, starts `sk_test_`
- `STRIPE_WEBHOOK_SECRET`: webhook signing secret from Stripe, starts `whsec_`
- `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_AGENCY`: monthly recurring EUR price IDs from Stripe **test mode**
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_URL`: configured in Vercel

Configure Stripe Dashboard > Developers > Webhooks: URL `https://accountantos-chi.vercel.app/api/webhook` with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Configure Customer Portal in Stripe Dashboard.

After setting variables, **redeploy** production to include the new environment values. Test Stripe checkout with Stripe test payment methods and inspect webhook delivery plus billing_accounts.

**Limitations:** Plan-based usage limits and paid access are NOT enforced yet; prices shown in UI are illustrative until test prices are configured. The workspaces table holds user documents; review GDPR, storage design, backup, security, and billing behavior before accepting real customers. Do not paste `sk_test_`, `sk_live_`, `sb_secret_` or `whsec_` values into chat.
