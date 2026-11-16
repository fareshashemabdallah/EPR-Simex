
-- Execute only on an isolated TEST project. Rolls back all synthetic fixtures.
BEGIN;
SET LOCAL ROLE authenticated;
DO $rls$
DECLARE
 a uuid:='10000000-0000-4000-8000-000000000001';
 b uuid:='10000000-0000-4000-8000-000000000002';
 alpha uuid:='10000000-0000-4000-8000-000000000003';
 beta uuid:='10000000-0000-4000-8000-000000000004';
 oa uuid; ob uuid; ea uuid; eb uuid; ta uuid; tb uuid; other_team uuid; inj uuid; subid uuid;
 affected int; blocked boolean:=false;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 oa:=public.create_organization('RLS-TEST Agency A');
 INSERT INTO public.org_memberships(org_id,user_id,role) VALUES(oa,alpha,'member'),(oa,beta,'member');
 INSERT INTO public.exercises(org_id,title,created_by) VALUES(oa,'Fictional flood A',a) RETURNING id INTO ea;
 INSERT INTO public.exercise_memberships(exercise_id,org_id,user_id,role)
 VALUES(ea,oa,alpha,'participant'),(ea,oa,beta,'participant');
 INSERT INTO public.teams(exercise_id,org_id,name) VALUES(ea,oa,'Alpha Team') RETURNING id INTO ta;
 INSERT INTO public.teams(exercise_id,org_id,name) VALUES(ea,oa,'Beta Team') RETURNING id INTO tb;
 INSERT INTO public.team_memberships(team_id,exercise_id,org_id,user_id)
 VALUES(ta,ea,oa,alpha),(tb,ea,oa,beta);
 INSERT INTO public.injects(exercise_id,org_id,title,body,created_by)
 VALUES(ea,oa,'Closed river crossing','Fictional',a) RETURNING id INTO inj;
 INSERT INTO public.inject_targets(inject_id,team_id,exercise_id,org_id) VALUES(inj,ta,ea,oa);
 INSERT INTO public.private_notes(exercise_id,org_id,subject_type,subject_id,body)
 VALUES(ea,oa,'inject',inj,'Facilitator-only notes');
 UPDATE public.exercises SET status='published' WHERE id=ea;
 UPDATE public.exercises SET status='live' WHERE id=ea;

 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 ob:=public.create_organization('RLS-TEST Agency B');
 INSERT INTO public.exercises(org_id,title,created_by) VALUES(ob,'Fictional cholera B',b) RETURNING id INTO eb;
 INSERT INTO public.teams(exercise_id,org_id,name) VALUES(eb,ob,'Other Agency Team') RETURNING id INTO other_team;
 INSERT INTO public.team_memberships(team_id,exercise_id,org_id,user_id)
 VALUES(other_team,eb,ob,b);
 IF (SELECT count(*) FROM public.exercises)<>1 THEN RAISE EXCEPTION 'B may read A exercise'; END IF;

 PERFORM set_config('request.jwt.claim.sub',alpha::text,true);
 IF (SELECT count(*) FROM public.private_notes WHERE exercise_id=ea)<>0 THEN RAISE EXCEPTION 'participant can see private notes'; END IF;
 IF (SELECT count(*) FROM public.injects WHERE id=inj)<>0 THEN RAISE EXCEPTION 'participant can see draft inject'; END IF;
 IF (SELECT count(*) FROM public.exercises WHERE id=eb)<>0 THEN RAISE EXCEPTION 'cross-org exercise read'; END IF;
 UPDATE public.exercises SET status='completed' WHERE id=ea;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'participant changed exercise status'; END IF;

 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 UPDATE public.injects SET status='released' WHERE id=inj;

 PERFORM set_config('request.jwt.claim.sub',alpha::text,true);
 IF (SELECT count(*) FROM public.injects WHERE id=inj)<>1 THEN RAISE EXCEPTION 'Alpha cannot see targeted inject'; END IF;
 INSERT INTO public.submissions(inject_id,team_id,exercise_id,org_id,body,status)
 VALUES(inj,ta,ea,oa,'Alternative bridge selected','submitted') RETURNING id INTO subid;

 PERFORM set_config('request.jwt.claim.sub',beta::text,true);
 IF (SELECT count(*) FROM public.injects WHERE id=inj)<>0 THEN RAISE EXCEPTION 'Beta sees Alpha inject'; END IF;
 IF (SELECT count(*) FROM public.submissions WHERE id=subid)<>0 THEN RAISE EXCEPTION 'Beta sees Alpha response'; END IF;

 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 IF (SELECT count(*) FROM public.submissions WHERE id=subid)<>0 THEN RAISE EXCEPTION 'Other agency sees response'; END IF;

 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 BEGIN
  INSERT INTO public.messages(exercise_id,org_id,sender_id,team_id,to_team_id,channel,body)
  VALUES(ea,oa,a,ta,other_team,'support','Cross-agency message forbidden');
 EXCEPTION WHEN OTHERS THEN
  IF position('Recipient team must belong' IN SQLERRM)=0 THEN RAISE; END IF;
  blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cross-agency recipient was accepted'; END IF;
 INSERT INTO public.messages(exercise_id,org_id,sender_id,team_id,to_team_id,channel,body)
 VALUES(ea,oa,a,ta,tb,'support','Same exercise message allowed');

 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 IF (SELECT count(*) FROM public.messages WHERE exercise_id=ea)<>0 THEN RAISE EXCEPTION 'Other agency can read A messages'; END IF;
 PERFORM set_config('request.jwt.claim.sub',beta::text,true);
 IF (SELECT count(*) FROM public.messages WHERE exercise_id=ea)<>1 THEN RAISE EXCEPTION 'Targeted Beta cannot read its message'; END IF;
END $rls$;
ROLLBACK;
SELECT 'PASS: 2 orgs; 2 teams; RLS; draft/release; notes; submissions; status; messages; all fixture data rolled back' AS test_result;
