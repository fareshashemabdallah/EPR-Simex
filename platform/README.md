# EPR-Simex Platform — multi-agency development branch

**Not a production release.** An independent humanitarian simulation-training tool, not an official UN/UNICEF or other agency service. The existing READY72 site is intentionally preserved in the repository root.

This branch adds an isolated, no-build frontend at `platform/index.html` plus a Supabase/PostgreSQL schema with role and tenant controls. The frontend supports verified email account sign-in, organization and exercise setup, participant teams, support cells, invitations, scenario stages and controlled inject releases, participant decision submissions, facilitator reviews, an agenda with authored text slides, a presentation mode, private document references and file uploads, basic messaging, and 30/60/90-day AAR action plans.

## Verified development status — November 11, 2026

- A separate **EPR-Simex-Test** Supabase project has been provisioned on the $0/month tier in Frankfurt (`eu-central-1`), project ref `rqspzcnkbftytldggezc`.
- The GitHub development branch's `platform/config.js` points to the test API using **only a public publishable key**. No privileged key has been committed.
- All **25 public application tables** have RLS enabled; the documents bucket is private.
- Migrations were applied successfully. A real SQL role-impersonation test with **two fictional agencies and two participant teams** passed after correcting cross-exercise message access, inject/document INSERT…RETURNING and reference-link validation. The tests use synthetic UUIDs, wrap all fixtures in a transaction and ROLLBACK.
- Internal authorization helper functions are now in a non-exposed `private` schema. The security advisor reports **two intentionally callable, authenticated SECURITY DEFINER RPCs** (`create_organization` and `accept_invitation`) requiring continued review.
- The web application has NOT undergone end-to-end sign-up / invite acceptance testing with verified accounts on separate devices. GitHub Actions syntax and browser-mock tests are useful but do **not** establish production readiness.
- The app remains separate under `platform/` on `development/secure-platform`. Nothing has been merged into `main`; the live READY72 homepage is unaffected.
- File uploads accept PDF/PPTX/DOCX for **fictional testing materials only**. Antivirus scanning is unavailable; PPTX is private download, not native animated presentation.
- Current collaboration is refresh-based. Real-time subscriptions, concurrent draft handling, SSO/MFA enforcement, backup/restore drills, privacy assessment, accessibility review and independent penetration testing remain open.

## Reproduce the test database (new test Supabase project only)

1. Use a dedicated, empty Supabase **test** project. The first test project is already created; do **not** rerun initial `schema.sql` against it.
2. On a NEW empty test database, carefully review and apply, **in order**, `platform/sql/schema.sql`, `002_restrict_function_permissions.sql`, `003_fix_cross_exercise_messages_and_inject_returning.sql`, `004_guard_document_and_invitation_scopes.sql`, , `005_fix_document_insert_returning.sql`, and `006_move_rls_helpers_to_private_schema.sql`. These are development migrations, not production certifications.
3. Confirm Email authentication and email verification are enabled; set an approved test site URL and redirect paths in Supabase Auth. Production authentication settings have not been verified from a real browser.
4. Set the project URL and **publishable** key in `platform/config.js` for the intended test deployment. Never add service_role, sb_secret, passwords, or JWT signing secrets.
5. Keep GitHub Pages on **main** for READY72. To try the development branch locally, clone/check out `development/secure-platform` and run a static HTTP server, then open `/platform/` in the browser. Do not switch the production Pages source.
6. Run `platform/tests/rls_smoke.sql`, `platform/tests/rls_documents_invites.sql`, and `platform/tests/rls_training_studio.sql` against a test database only. Each script intentionally impersonates synthetic users under the authenticated Postgres role, asserts access controls and rolls back its test fixtures. This is not a substitute for real account integration testing.
7. Run `platform/tests/UAT.md` manually with separate verified test accounts before a pilot.

## Security verification is a release blocker

Use `platform/tests/UAT.md`. Test at least **two different organizations and two different participant teams** with distinct real verified accounts on separate browsers. Specifically test direct API calls for cross-tenant data, unreleased injects, facilitator-only notes, upload/download object access, role escalation, unexpected state transitions, invite redemption and repeat use.

The included GitHub Action runs JavaScript syntax, browser-mock workflow tests and static source assertions. Separately, the SQL regression scripts have been executed successfully on the Supabase test project. Neither validates full real-user authentication, delivery/performance, operations resilience or overall production security.

Before real agency adoption: complete threat modeling, database/RLS and API adversarial tests, email delivery and invite rate limiting, enforced MFA/SSO, malware scanning and content disarm policy, privacy/DPIA/retention assessments, recovery and backup tests, accessibility audits and independent penetration testing, and obtain each organization's approvals.

## Future work

- Full content editor and speaker-notes UI; supervised PPTX-to-slide conversion
- Scheduled injects with reliable delivery, websocket-style realtime, team workspaces and controlled peer collaboration
- Rich evaluation rubric, comprehensive AAR exports and versioned scenario templates
- Provider tenancy administration, audit dashboards, operations telemetry and incident response
