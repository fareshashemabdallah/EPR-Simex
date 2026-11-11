# EPR-Simex Platform — multi-agency development branch

**Not a production release.** An independent humanitarian simulation-training tool, not an official UN/UNICEF or other agency service. The existing READY72 site is intentionally preserved in the repository root.

This branch adds an isolated, no-build frontend at `platform/index.html` plus a Supabase/PostgreSQL schema with role and tenant controls. The frontend supports verified email account sign-in, organization and exercise setup, participant teams, support cells, invitations, scenario stages and controlled inject releases, participant decision submissions, facilitator reviews, an agenda with authored text slides, a presentation mode, private document references and file uploads, basic messaging, and 30/60/90-day AAR action plans.

## Technical status

- Frontend uses browser-native JavaScript and GitHub Pages; no Lovable credits or npm packages required for the browser.
- Backend **must be separately configured**. GitHub Pages cannot store shared private data or enforce server-side authorization.
- The SQL migration is **a draft** derived from the developer's authenticated EPR-Simex Lovable workspace project. It has not yet been applied to or independently tested against the new Supabase account. All UI operations depend on the live database and its verified RLS policies.
- The project is kept on `development/secure-platform`. Nothing has been merged into `main`; root `index.html` remains the READY72 demonstration.
- Current document upload accepts PDF/PPTX/DOCX for **synthetic materials only**. It does not scan for malware; PPTX files are private downloadable files, not native animated presentations.
- Current collaboration is refresh-based. Real-time subscriptions, concurrent editor conflict management, SSO/MFA enforcement, backups and restore drills, certified data privacy, accessibility audit, and external penetration testing remain to be implemented.

## Configure an isolated *test* environment

1. Create a separate Supabase **test** project at [supabase.com](https://supabase.com) using your own account. Keep the database password secret. Do not reuse existing agency data or business production credentials.
2. Review `platform/sql/schema.sql`. From Supabase **SQL Editor**, run it once on the new test project, after resolving any version or migration conflicts. The script defines organizations, roles, teams, injects, agenda, documents, submissions, reviews, audit and private storage policies.
3. In **Authentication → Providers → Email**, enable email sign-in and require email verification. Configure a suitable site URL and allowed redirect URL for your eventual `/EPR-Simex/platform/` path.
4. In **Settings → API**, copy the Supabase project URL and **publishable** (or legacy `anon`) key only. Update `platform/config.js` as public client config. **Do not paste service_role, sb_secret, JWT signing secret, database password, or other privileged credentials in the repository.**
5. GitHub Pages remains configured on **main**, so to preview the branch without modifying production, clone/check out `development/secure-platform` locally and serve the repository with a simple static server (e.g. `python3 -m http.server 8080`), then open `http://localhost:8080/platform/`. Alternatively use a separate Pages test repo when ready.
6. Sign in with synthetic accounts only, create a test org, an exercise and at least two teams. Draft an inject, start an exercise via the allowed status transitions `draft → published → live`, then release it.

## Security verification is a release blocker

Use `platform/tests/UAT.md`. Test at least **two different organizations and two different participant teams** with distinct real verified accounts on separate browsers. Specifically test direct API calls for cross-tenant data, unreleased injects, facilitator-only notes, upload/download object access, role escalation, unexpected state transitions, invite redemption and repeat use.

The included GitHub Action only runs JavaScript syntax and **static source assertions**. Its success **does not** verify SQL migration behavior, live RLS, browser workflows, performance or security.

Before real agency adoption: complete threat modeling, database/RLS and API adversarial tests, email delivery and invite rate limiting, enforced MFA/SSO, malware scanning and content disarm policy, privacy/DPIA/retention assessments, recovery and backup tests, accessibility audits and independent penetration testing, and obtain each organization's approvals.

## Future work

- Full content editor and speaker-notes UI; supervised PPTX-to-slide conversion
- Scheduled injects with reliable delivery, websocket-style realtime, team workspaces and controlled peer collaboration
- Rich evaluation rubric, comprehensive AAR exports and versioned scenario templates
- Provider tenancy administration, audit dashboards, operations telemetry and incident response
