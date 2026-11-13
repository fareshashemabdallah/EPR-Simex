-- EPR-Simex test project: scoped edit and deletion policies, with parent-safety guards.
-- Never delete user content automatically as part of this migration.
-- All structural DELETE requests remain subject to RLS and trigger checks.

create policy ai_update on public.action_items for update to authenticated
  using (private.is_ex_staff(exercise_id))
  with check (private.is_ex_staff(exercise_id));

-- Participant drafts can be discarded by the team that authored them.
-- Submitted/accepted work remains part of the exercise evidence.
create policy sub_delete on public.submissions for delete to authenticated
  using (status = 'draft' and updated_by = auth.uid() and private.is_team_member(team_id));

-- Only an organization's original creator can remove an EMPTY organization.
-- Non-empty organizations remain intact and can be renamed.
create or replace function private.can_delete_empty_org(_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organizations o
    where o.id = _id and o.created_by = auth.uid()
      and not exists(select 1 from public.exercises e where e.org_id=o.id)
      and not exists(select 1 from public.document_records d where d.org_id=o.id)
      and not exists(select 1 from public.invitations i where i.org_id=o.id)
      and not exists(select 1 from public.org_memberships m where m.org_id=o.id and m.user_id <> auth.uid())
  )
$$;
revoke execute on function private.can_delete_empty_org(uuid) from public,anon;
grant execute on function private.can_delete_empty_org(uuid) to authenticated;

create policy orgs_delete_empty on public.organizations for delete to authenticated
  using (private.can_delete_empty_org(id));

-- A creator can delete their own DRAFT exercise, even if they created preparation
-- stages/teams/slides, but not once another user or evidence is involved.
create or replace function private.can_delete_draft_exercise(_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.exercises e
    where e.id = _id and e.created_by = auth.uid() and e.status = 'draft'
      and exists(select 1 from public.exercise_memberships m
        where m.exercise_id=e.id and m.user_id=auth.uid() and m.role='director')
      and not exists(select 1 from public.exercise_memberships m
        where m.exercise_id=e.id and m.user_id<>auth.uid())
      and not exists(select 1 from public.invitations i
        where i.exercise_id=e.id and i.status='accepted')
      and not exists(select 1 from public.submissions s where s.exercise_id=e.id)
      and not exists(select 1 from public.messages msg where msg.exercise_id=e.id)
      and not exists(select 1 from public.document_records d
        where d.exercise_id=e.id and d.kind='file')
  )
$$;
revoke execute on function private.can_delete_draft_exercise(uuid) from public,anon;
grant execute on function private.can_delete_draft_exercise(uuid) to authenticated;

create policy ex_delete_draft_own on public.exercises for delete to authenticated
  using (private.can_delete_draft_exercise(id));

-- These guards prevent accidental cascading deletion of team participation,
-- inject allocations, agenda content, and files.
create or replace function private.guard_structural_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_TABLE_NAME = 'teams' and (
    exists(select 1 from public.team_memberships x where x.team_id=old.id)
    or exists(select 1 from public.inject_targets x where x.team_id=old.id)
    or exists(select 1 from public.submissions x where x.team_id=old.id)
    or exists(select 1 from public.messages x where x.team_id=old.id or x.to_team_id=old.id)
    or exists(select 1 from public.document_records x where x.team_id=old.id)
    or exists(select 1 from public.invitations x where x.team_id=old.id and x.status='pending')
  ) then raise exception 'Cannot delete this team: remove assignments, messages, or references first'; end if;
  if TG_TABLE_NAME = 'stages' and (
    exists(select 1 from public.injects x where x.stage_id=old.id)
    or exists(select 1 from public.agenda_sessions x where x.stage_id=old.id)
    or exists(select 1 from public.exercises x where x.current_stage_id=old.id)
  ) then raise exception 'Cannot delete a stage referenced by an inject, session or current exercise stage'; end if;
  if TG_TABLE_NAME = 'agenda_days'
    and exists(select 1 from public.agenda_sessions x where x.day_id=old.id)
  then raise exception 'Cannot delete a training day containing sessions'; end if;
  if TG_TABLE_NAME = 'agenda_sessions' and (
    exists(select 1 from public.slides x where x.session_id=old.id)
    or exists(select 1 from public.document_records x where x.session_id=old.id)
  ) then raise exception 'Cannot delete a session containing slides or documents'; end if;
  return old;
end $$;
revoke execute on function private.guard_structural_delete() from public,anon,authenticated;

do $$
declare t text;
begin
  foreach t in array array['teams','stages','agenda_days','agenda_sessions'] loop
    execute format('drop trigger if exists trg_guard_delete_structure on public.%I',t);
    execute format('create trigger trg_guard_delete_structure before delete on public.%I for each row execute function private.guard_structural_delete()',t);
  end loop;
end $$;

-- Avoid leaving orphaned private facilitator notes when a slide or inject is deleted.
create or replace function private.cleanup_private_notes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.private_notes
  where subject_type=TG_ARGV[0] and subject_id=old.id;
  return old;
end $$;
revoke execute on function private.cleanup_private_notes() from public,anon,authenticated;
drop trigger if exists trg_slide_cleanup_notes on public.slides;
create trigger trg_slide_cleanup_notes after delete on public.slides
  for each row execute function private.cleanup_private_notes('slide');
drop trigger if exists trg_inject_cleanup_notes on public.injects;
create trigger trg_inject_cleanup_notes after delete on public.injects
  for each row execute function private.cleanup_private_notes('inject');
