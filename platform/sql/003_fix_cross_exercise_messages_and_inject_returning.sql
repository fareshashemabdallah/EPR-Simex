-- EPR-Simex authorization defects discovered during real database RLS tests.
-- Deny cross-exercise/team message visibility even when cross-linked IDs are supplied.
drop policy if exists msg_select on public.messages;
create policy msg_select on public.messages for select to authenticated
using (
  public.is_ex_member(exercise_id)
  and (
    public.is_ex_overseer(exercise_id)
    or sender_id = auth.uid()
    or (team_id is not null and public.is_team_member(team_id))
    or (to_team_id is not null and public.is_team_member(to_team_id))
  )
);

create or replace function public.guard_message_team_scope() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.team_id is not null and not exists
    (select 1 from public.teams where id=new.team_id and exercise_id=new.exercise_id)
  then raise exception 'Sender team must belong to this exercise'; end if;
  if new.to_team_id is not null and not exists
    (select 1 from public.teams where id=new.to_team_id and exercise_id=new.exercise_id)
  then raise exception 'Recipient team must belong to this exercise'; end if;
  return new;
end $$;
revoke execute on function public.guard_message_team_scope() from public, anon, authenticated;
drop trigger if exists trg_message_team_scope on public.messages;
create trigger trg_message_team_scope before insert or update of team_id,to_team_id,exercise_id
on public.messages for each row execute function public.guard_message_team_scope();

-- A facilitator must be able to INSERT ... RETURNING an unreleased draft inject,
-- while participants retain their existing release and team-specific access check.
drop policy if exists inj_select on public.injects;
create policy inj_select on public.injects for select to authenticated
  using (public.is_ex_staff(exercise_id) or public.can_view_inject(id));
