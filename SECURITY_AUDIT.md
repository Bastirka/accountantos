# AccountantOS — Security & launch readiness audit
Date: 2026-11-18
Scope: GitHub `Bastirka/accountantos`, Vercel `accountantos`, connected Stripe Sandbox.
This is a code/configuration audit, NOT a penetration test or certification.

## Verified observations
- Existing Supabase Auth JWT is checked by server endpoint `authorized()` before account or workspace access.
- Workspace is queried and written with the **authenticated** user ID (not a client-submitted user_id).
- Professional workspace max company count is enforced in `api/workspace.js` (15); attempts exceeding it return HTTP 403.
- Concurrency conflict prevention compares `updated_at` on writes and responds HTTP 409.
- Stripe Sandbox contains one active Professional subscription and configured endpoint/portal (no Live account confirmed).
- Vercel SSO deployment protection was changed from `all_except_custom_domains` to `preview` to permit customer access on the production domain. Verified the public homepage returned HTTP 200; unauthenticated API responses and browser session isolation still need independent HTTP testing.
- Vercel production environment contains Supabase and Stripe server secrets. Values were not decrypted.
- Security regression tests were added at `tests/security.test.js` and CI workflow at `.github/workflows/security.yml`. CI success **not confirmed at audit time**.

## Remediated in source during this audit
- Fixed invoice-number substring matching: `INV-10` no longer matches `INV-100`; ambiguous invoice candidates are not picked arbitrarily.
- Added baseline Vercel security headers (X-Frame-Options, nosniff, Referrer-Policy, HSTS, Permissions-Policy).
- Added read-only permission and RLS inspection SQL at `sql/audit_permissions.sql`.
- Added Stripe-provider subscription verification before Checkout to prevent duplicate subscriptions if Supabase billing status is stale. Locally exercised current GitHub checkout handler with mocked Stripe subscription states (active, trialing, past_due, canceled); all four expected responses passed.
- Added `tests/checkout.test.js`. Test file syntax checked, but GitHub Actions execution has not been independently confirmed.
- Cleared in-memory financial workspace and rendered rows immediately on logout/account change, and discarded stale asynchronous workspace responses. Deployed production and verified Vercel READY.

## Unresolved blockers (required before real financial data)
### Critical: live database isolation not independently verified
- Supabase RLS and grants were not retrieved from the live database; no Supabase SQL admin integration available.
- Run `sql/audit_permissions.sql`. Confirm all privilege checks pass and review *all* listed policies.
- Test two real, separately authenticated users (A and B) to verify that neither can read or modify the other's workspace via the REST/Data API or application. Never use real client data for test.

### Critical: product readiness and payment compliance
- Stripe is Sandbox only; do not enable real payments before seller verification, Live keys/products/webhooks/portal, VAT and legal obligations, terms and data processing agreement.
- No independent backup/restore drill or audit logging validated.

### High: financial correctness
- Current matching algorithm is heuristic and UI labels results as possible matches. Multiple payments may still reference one invoice; no one-to-one reconciliation ledger.
- CSV parser does not fully handle multiline quoted cells or bank-specific encoding; dedicated test fixtures needed.

### High: data lifecycle
- One per-user JSONB workspace rather than normalized, independently versioned company data.
- Downgrading with more companies than the new plan permits blocks writes until excess data is removed. Provide read/export-only or scoped editing policy.
- No verified safe deletion/export workflow for account closure.

### Medium: abuse and operations
- No demonstrated per-user API rate limiting or alerting; monitor resource exhaustion.
- No confirmed automated penetration scans, independent source audit, restoration RTO/RPO, or privacy policy publication.

## Required release gate
1. CI security tests show green (verify Actions run, not only file presence).
2. Supabase live RLS/permission checks all pass.
3. Real isolated test accounts: 15 accepted, 16 rejected, cross-account access denied, unauthenticated 401.
4. Stripe Sandbox renewal/cancel/failure/webhook retry lifecycle tested end-to-end.
5. Backup restore drill, sample CSV reconciliation test, data export test.
6. Live payment identity, legal/VAT, custom-domain/access configuration, then limited rollout.

Status: **NOT APPROVED for storage of real client financial data or collecting Live subscriptions.**
