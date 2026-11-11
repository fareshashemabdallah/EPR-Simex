-- Rolled-back authorization test: agenda, slides, speaker notes and support actors.
begin; set local role authenticated;
do $$
declare
 director uuid:='10000000-0000-4000-8000-000000000011';
 participant uuid:='10000000-0000-4000-8000-000000000012';
 observer uuid:='10000000-0000-4000-8000-000000000013';
 actor uuid:='10000000-0000-4000-8000-000000000014';
 org uuid; ex uuid; team uuid; support_cell uuid; day uuid; session uuid; slide uuid;
 denied boolean:=false;
begin
 perform set_config('request.jwt.claim.sub',director::text,true);
 org:=public.create_organization('RLS TRAINING DEMO');
 insert into public.org_memberships(org_id,user_id,role) values(org,participant,'member'),(org,observer,'member'),(org,actor,'member');
 insert into public.exercises(org_id,title,created_by) values(org,'Three Day Exercise',director) returning id into ex;
 insert into public.exercise_memberships(exercise_id,org_id,user_id,role)
 values(ex,org,participant,'participant'),(ex,org,observer,'observer'),(ex,org,actor,'support_actor');
 insert into public.teams(exercise_id,org_id,name,kind) values(ex,org,'Country Team','team') returning id into team;
 insert into public.teams(exercise_id,org_id,name,kind) values(ex,org,'Government support cell','support_cell') returning id into support_cell;
 insert into public.team_memberships(team_id,exercise_id,org_id,user_id) values(team,ex,org,participant),(support_cell,ex,org,actor);
 insert into public.agenda_days(exercise_id,org_id,day_number,title) values(ex,org,1,'Day 1');
 insert into public.agenda_days(exercise_id,org_id,day_number,title) values(ex,org,2,'Day 2') returning id into day;
 insert into public.agenda_sessions(day_id,exercise_id,org_id,title,session_type,learning_objectives)
 values(day,ex,org,'Session 2 · Supply Routes','presentation','Assess contingency routes') returning id into session;
 insert into public.slides(session_id,exercise_id,org_id,position,title,body)
 values(session,ex,org,1,'Route Prioritization','Choose between two fictional corridors') returning id into slide;
 insert into public.private_notes(exercise_id,org_id,subject_type,subject_id,body)
 values(ex,org,'slide',slide,'Facilitator answer: test options against access constraints');

 perform set_config('request.jwt.claim.sub',participant::text,true);
 if (select count(*) from public.slides where id=slide)<>1 then raise exception 'Participant cannot read published training slide'; end if;
 if (select count(*) from public.private_notes where exercise_id=ex)<>0 then raise exception 'Participant sees speaker notes'; end if;
 begin
  insert into public.private_notes(exercise_id,org_id,subject_type,subject_id,body)
  values(ex,org,'slide',gen_random_uuid(),'Attempt to create private note');
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied then raise exception 'Participant could create private notes'; end if;

 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.messages(exercise_id,org_id,sender_id,team_id,to_team_id,channel,persona,body)
 values(ex,org,actor,support_cell,team,'support','Fictional Ministry','Bridge inaccessible for 24 hours');

 perform set_config('request.jwt.claim.sub',participant::text,true);
 if (select count(*) from public.messages where exercise_id=ex)<>1 then raise exception 'Team cannot read support cell reply'; end if;

 perform set_config('request.jwt.claim.sub',observer::text,true);
 if (select count(*) from public.messages where exercise_id=ex)<>1 then raise exception 'Observer cannot review exercise messages'; end if;
 if (select count(*) from public.private_notes where exercise_id=ex)<>0 then raise exception 'Observer can see private speaker notes'; end if;
end $$;
rollback;
select 'PASS: agenda, slides, private speaker notes, observer and support cell permissions; rolled back' as result;