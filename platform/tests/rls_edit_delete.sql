-- Synthetic RLS regression for edit/delete operations. No persistent records.
begin;
set local role authenticated;
do $test$
declare
 director uuid:='20000000-0000-4000-8000-000000000011';
 participant uuid:='20000000-0000-4000-8000-000000000012';
 org uuid; ex uuid; tm uuid; stageid uuid; injectid uuid; noteid uuid; slideid uuid;
 changed int; blocked boolean;
begin
 perform set_config('request.jwt.claim.sub',director::text,true);
 org:=public.create_organization('TEST Management Rules');
 insert into public.org_memberships(org_id,user_id,role) values(org,participant,'member');
 insert into public.exercises(org_id,title,created_by) values(org,'Demo Exercise',director) returning id into ex;
 insert into public.exercise_memberships(exercise_id,org_id,user_id,role)
 values(ex,org,participant,'participant');
 insert into public.teams(exercise_id,org_id,name,kind) values(ex,org,'Team 1','team') returning id into tm;
 insert into public.team_memberships(team_id,exercise_id,org_id,user_id) values(tm,ex,org,participant);
 insert into public.stages(exercise_id,org_id,name,code) values(ex,org,'H0','H0') returning id into stageid;
 insert into public.injects(exercise_id,org_id,stage_id,title,body,created_by)
 values(ex,org,stageid,'Sample inject','Situation',director) returning id into injectid;
 insert into public.inject_targets(inject_id,team_id,exercise_id,org_id) values(injectid,tm,ex,org);

 blocked:=false;
 begin delete from public.teams where id=tm;
 exception when others then
   if position('Cannot delete this team' in SQLERRM)=0 then raise; end if;
   blocked:=true;
 end;
 if not blocked then raise exception 'FAIL: linked team was deleted'; end if;
 blocked:=false;
 begin delete from public.stages where id=stageid;
 exception when others then
   if position('Cannot delete a stage' in SQLERRM)=0 then raise; end if;
   blocked:=true;
 end;
 if not blocked then raise exception 'FAIL: linked stage was deleted'; end if;

 perform set_config('request.jwt.claim.sub',participant::text,true);
 update public.teams set name='UNAUTHORIZED' where id=tm;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: participant edited team'; end if;
 delete from public.injects where id=injectid;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: participant deleted inject'; end if;
 update public.organizations set name='UNAUTHORIZED' where id=org;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: participant edited organization'; end if;

 perform set_config('request.jwt.claim.sub',director::text,true);
 delete from public.injects where id=injectid;
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'FAIL: draft inject not deletable'; end if;
 delete from public.stages where id=stageid;
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'FAIL: empty stage not deletable'; end if;
 delete from public.team_memberships where team_id=tm;
 delete from public.teams where id=tm;
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'FAIL: empty team not deletable'; end if;

 delete from public.exercises where id=ex;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'FAIL: exercise with another participant was deleted'; end if;
end $test$;
rollback;
select 'PASS: destructive dependencies blocked, participant permissions denied, facilitator draft cleanup allowed' as test_result;