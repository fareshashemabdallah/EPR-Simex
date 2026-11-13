-- Enforce cross-table tenant and exercise consistency for documents and invitations.
create or replace function public.guard_document_scope() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if new.exercise_id is null and
    (new.team_id is not null or new.inject_id is not null or new.session_id is not null)
  then raise exception 'Organization-level references cannot link to exercise resources'; end if;
  if new.team_id is not null and not exists(
    select 1 from public.teams t where t.id=new.team_id
       and t.exercise_id=new.exercise_id and t.org_id=new.org_id
  ) then raise exception 'Document team must belong to its exercise and organization'; end if;
  if new.inject_id is not null and not exists(
    select 1 from public.injects i where i.id=new.inject_id
       and i.exercise_id=new.exercise_id and i.org_id=new.org_id
  ) then raise exception 'Document inject must belong to its exercise and organization'; end if;
  if new.session_id is not null and not exists(
    select 1 from public.agenda_sessions s where s.id=new.session_id
       and s.exercise_id=new.exercise_id and s.org_id=new.org_id
  ) then raise exception 'Document session must belong to its exercise and organization'; end if;
  return new;
end $$;
revoke execute on function public.guard_document_scope() from public,anon,authenticated;
drop trigger if exists trg_guard_document_scope on public.document_records;
create trigger trg_guard_document_scope before insert or update on public.document_records
for each row execute function public.guard_document_scope();

create or replace function public.guard_invitation_scope() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if new.exercise_id is null and (new.team_id is not null or new.exercise_role is not null) then
    raise exception 'An organization-only invitation cannot assign exercise access';
  end if;
  if new.exercise_id is not null and not exists(
    select 1 from public.exercises e where e.id=new.exercise_id and e.org_id=new.org_id
  ) then raise exception 'Invitation exercise must belong to its organization'; end if;
  if new.team_id is not null and not exists(
    select 1 from public.teams t where t.id=new.team_id and
      t.exercise_id=new.exercise_id and t.org_id=new.org_id
  ) then raise exception 'Invitation team must belong to its exercise'; end if;
  if new.team_id is not null and new.exercise_role is null then
    raise exception 'Invitation with team must include an exercise role'; end if;
  return new;
end $$;
revoke execute on function public.guard_invitation_scope() from public,anon,authenticated;
drop trigger if exists trg_guard_invitation_scope on public.invitations;
create trigger trg_guard_invitation_scope before insert or update on public.invitations
for each row execute function public.guard_invitation_scope();