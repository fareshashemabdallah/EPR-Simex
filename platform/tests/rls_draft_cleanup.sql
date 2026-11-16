
-- Exercise test database only. All synthetic rows roll back.
BEGIN; SET LOCAL ROLE authenticated;
DO $t$
DECLARE
 a uuid:='30000000-0000-4000-8000-000000000021';
 b uuid:='30000000-0000-4000-8000-000000000022';
 o uuid;e uuid;t uuid;s uuid;i uuid;d uuid;se uuid;e2 uuid;t2 uuid;k integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 o:=public.create_organization('Synthetic Draft Delete');
 INSERT INTO public.org_memberships(org_id,user_id,role) VALUES(o,b,'member');
 INSERT INTO public.exercises(org_id,title,created_by) VALUES(o,'Synthetic Scratch',a) RETURNING id INTO e;
 INSERT INTO public.exercise_memberships(exercise_id,org_id,user_id,role) VALUES(e,o,b,'participant');
 INSERT INTO public.teams(exercise_id,org_id,name) VALUES(e,o,'Scratch Team') RETURNING id INTO t;
 INSERT INTO public.team_memberships(team_id,exercise_id,org_id,user_id) VALUES(t,e,o,b);
 INSERT INTO public.stages(exercise_id,org_id,name,code) VALUES(e,o,'H0','H0') RETURNING id INTO s;
 INSERT INTO public.injects(exercise_id,org_id,stage_id,title,created_by) VALUES(e,o,s,'Draft update',a) RETURNING id INTO i;
 INSERT INTO public.inject_targets(inject_id,team_id,exercise_id,org_id) VALUES(i,t,e,o);
 INSERT INTO public.agenda_days(exercise_id,org_id,day_number,title) VALUES(e,o,1,'Training') RETURNING id INTO d;
 INSERT INTO public.agenda_sessions(exercise_id,org_id,day_id,title) VALUES(e,o,d,'Session') RETURNING id INTO se;
 INSERT INTO public.slides(exercise_id,org_id,session_id,title) VALUES(e,o,se,'Slide 1');
 INSERT INTO public.invitations(org_id,exercise_id,email,exercise_role,invited_by) VALUES(o,e,'delete-synthetic@example.org','participant',a);
 INSERT INTO public.messages(exercise_id,org_id,sender_id,team_id,channel,body) VALUES(e,o,a,t,'support','Synthetic message');
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 DELETE FROM public.exercises WHERE id=e; GET DIAGNOSTICS k=ROW_COUNT;
 IF k<>0 THEN RAISE EXCEPTION 'Participant deleted exercise'; END IF;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 DELETE FROM public.exercises WHERE id=e;GET DIAGNOSTICS k=ROW_COUNT;
 IF k<>1 THEN RAISE EXCEPTION 'Creator could not delete draft with team and message'; END IF;
 IF EXISTS(SELECT 1 FROM public.messages WHERE exercise_id=e) THEN RAISE EXCEPTION 'Message not removed'; END IF;
 INSERT INTO public.exercises(org_id,title,created_by) VALUES(o,'Second scratch',a) RETURNING id INTO e2;
 INSERT INTO public.exercise_memberships(exercise_id,org_id,user_id,role) VALUES(e2,o,b,'participant');
 INSERT INTO public.teams(exercise_id,org_id,name) VALUES(e2,o,'Assignment-only team') RETURNING id INTO t2;
 INSERT INTO public.team_memberships(team_id,exercise_id,org_id,user_id) VALUES(t2,e2,o,b);
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 DELETE FROM public.teams WHERE id=t2;GET DIAGNOSTICS k=ROW_COUNT;
 IF k<>0 THEN RAISE EXCEPTION 'Participant deleted team';END IF;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 DELETE FROM public.teams WHERE id=t2; GET DIAGNOSTICS k=ROW_COUNT;
 IF k<>1 THEN RAISE EXCEPTION 'Creator could not delete team with just membership';END IF;
 DELETE FROM public.exercises WHERE id=e2; GET DIAGNOSTICS k=ROW_COUNT;
 IF k<>1 THEN RAISE EXCEPTION 'Could not delete second draft exercise';END IF;
 DELETE FROM public.organizations WHERE id=o;GET DIAGNOSTICS k=ROW_COUNT;
 IF k<>1 THEN RAISE EXCEPTION 'Could not delete empty org with other member';END IF;
END $t$;
ROLLBACK;
SELECT 'PASS: creator deletes draft with team/invite/message/agenda/inject, assigned team and empty org; participant denied; fixtures rolled back' AS result;
