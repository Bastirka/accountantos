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