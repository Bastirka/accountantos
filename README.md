# AccountantOS

A Latvian bookkeeping workflow SaaS MVP with Supabase Auth, per-user workspaces and Stripe Sandbox billing.

> **Security status (2026-11-19):** Test accounts passed an application-level isolation audit, and Stripe Sandbox checkout is operational. **Do not upload real client financial records or accept Stripe Live payments yet.** The live Supabase permission/RLS audit, verified restore procedures and legal/compliance review are still required.

## Deployment
- Frontend: `index.html`; API: `api/*.js`; Vercel project `accountantos`.
- Database: Supabase Auth and `public.workspaces` / `public.billing_accounts`.
- `sql/setup.sql` is a **secure-by-default initial schema** for a NEW environment only. Do not re-run setup against production without a reviewed backup and migration plan.
- `sql/lockdown_workspace.sql` is the existing-project hardening migration. It revokes direct client writes to `workspaces` and billing records. All workspace writes must go through the authenticated server API.
- `sql/audit_permissions.sql` is **read-only** and can be run in the production Supabase SQL editor. Review the ten permission checks and the policy listing; no finance data is selected.

## Current features
- Supabase email login, email verification and per-user workspace.
- Companies, CSV imports for invoices/transactions, possible invoice matching, data export (CSV and JSON).
- Server workspace authorization and save conflict protection (409), evaluation limit 1 company / 30 invoices and transactions; paid tiers Starter 3, Professional 15 and Agency 50.
- Stripe **Sandbox** recurring subscriptions, webhook verification and billing customer portal.
- Checkout and paid-workspace write authorization verify subscription state at Stripe; stale billing status alone does not grant a paid write.

## Tests
```sh
npm test
```
Runs Node built-in test runner on `tests/*.test.js`. The repository also includes `.github/workflows/security.yml`. Verify green CI for each release; presence of workflow is not proof the tests ran successfully.

## Release gate (not yet met)
1. Run `sql/audit_permissions.sql` against the live Supabase database; investigate any false/null check or unexpected policy.
2. Verify unauthenticated API rejection, browser account isolation and direct Data API RLS with two nonprivileged test users.
3. Prove verified backup **and restoration** of test records (user JSON export alone is not database disaster recovery).
4. Complete financial correctness tests for bank CSV encoding, multirecord matching and VAT workflows.
5. Verify Stripe Sandbox cancellation, renewal, failure, retry and downgrade handling.
6. Complete privacy policy, GDPR/DPA, account removal process, seller verification, VAT treatment and Stripe Live setup before commercial launch.

Never commit or paste Stripe, Supabase, webhook or test-account passwords into source code or issue trackers.
