-- Apply after schema.sql when creating a new database from GitHub.
-- Security hardening applied and verified in the Frankfurt EPR-Simex-Test database.
-- Internal trigger procedures are not public Data API endpoints.

revoke execute on function public.audit_row() from public, anon, authenticated;
revoke execute on function public.check_same_exercise() from public, anon, authenticated;
revoke execute on function public.exercise_add_creator() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_org_from_exercise() from public, anon, authenticated;
revoke execute on function public.submission_guard() from public, anon, authenticated;
revoke execute on function public.inject_is_released(public.inject_status,timestamptz) from public, anon;
alter function public.inject_is_released(public.inject_status,timestamptz) set search_path=public;

-- More granular security-definer function refactoring is needed before production.
-- The policy helper functions still have authenticated EXECUTE grants because
-- row level security uses them. Their direct call exposure remains under review.
