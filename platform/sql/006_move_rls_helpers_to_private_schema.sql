-- Move internal authorization helpers out of exposed PostgREST public schema.
-- public.create_organization and public.accept_invitation remain intentional RPCs.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

do $security$
declare
  helper_names text[]:=array[
   'is_org_member','has_org_role','user_in_org','shares_org',
   'exercise_role_of','is_ex_member','is_ex_staff','is_ex_overseer',
   'is_team_member','team_kind_of','can_view_inject','can_view_document',
   'can_manage_doc_scope','can_read_storage_object','can_upload_storage_object'
  ];
  f record;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname=any(helper_names)
  loop
    execute 'alter function '||f.oid::regprocedure||' set schema private';
  end loop;
end $security$;

-- pg_policy expressions bind function OIDs, so moving a function keeps the policies
-- pointing at the same function. SQL/plpgsql function bodies are source text;
-- rewrite the prior explicit public helper references to the private namespace.
do $security$
declare
  helper_names text[]:=array[
   'is_org_member','has_org_role','user_in_org','shares_org',
   'exercise_role_of','is_ex_member','is_ex_staff','is_ex_overseer',
   'is_team_member','team_kind_of','can_view_inject','can_view_document',
   'can_manage_doc_scope','can_read_storage_object','can_upload_storage_object'
  ];
  f record; src text; updated text; helper text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f'
  loop
    src:=pg_get_functiondef(f.oid);
    updated:=src;
    foreach helper in array helper_names loop
      updated:=replace(updated,'public.'||helper||'(', 'private.'||helper||'(');
    end loop;
    if updated is distinct from src then execute updated; end if;
  end loop;
end $security$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on all functions in schema private to authenticated;
revoke execute on all functions in schema private from public, anon;

-- Intentionally exposed RPCs stay callable only to authenticated accounts.
revoke execute on function public.create_organization(text,text) from public, anon;
grant execute on function public.create_organization(text,text) to authenticated;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;