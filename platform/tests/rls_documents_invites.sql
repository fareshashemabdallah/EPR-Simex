-- Test-only: synthetic records are transactionally rolled back.
BEGIN; SET LOCAL ROLE authenticated;
DO $$
DECLARE a uuid:='10000000-0000-4000-8000-000000000001';
 b uuid:='10000000-0000-4000-8000-000000000002';
 oa uuid;ob uuid;ea uuid;eb uuid;ta uuid;tb uuid;docid uuid;inviteid uuid;blocked boolean:=false;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 oa:=public.create_organization('RLS-DOC-A');
 INSERT INTO public.exercises(org_id,title,created_by) VALUES(oa,'Doc test agency A',a) RETURNING id INTO ea;
 INSERT INTO public.teams(exercise_id,org_id,name) VALUES(ea,oa,'Alpha') RETURNING id INTO ta;
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 ob:=public.create_organization('RLS-DOC-B');
 INSERT INTO public.exercises(org_id,title,created_by) VALUES(ob,'Doc test agency B',b) RETURNING id INTO eb;
 INSERT INTO public.teams(exercise_id,org_id,name) VALUES(eb,ob,'Other agency') RETURNING id INTO tb;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 INSERT INTO public.document_records(org_id,exercise_id,title,kind,url,visibility,team_id,owner_id)
 VALUES(oa,ea,'Authorized policy','link','https://example.org/policy','team',ta,a) RETURNING id INTO docid;
 IF docid IS NULL THEN RAISE EXCEPTION 'Valid link did not return record'; END IF;
 BEGIN
  INSERT INTO public.document_records(org_id,exercise_id,title,kind,url,visibility,team_id,owner_id)
  VALUES(oa,ea,'Wrong agency policy','link','https://example.org/policy','team',tb,a);
 EXCEPTION WHEN OTHERS THEN
  IF position('Document team must belong' IN SQLERRM)=0 THEN RAISE; END IF;
  blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cross-agency document reference accepted'; END IF;
 blocked:=false;
 BEGIN
  INSERT INTO public.invitations(org_id,exercise_id,team_id,email,exercise_role,invited_by)
  VALUES(oa,ea,tb,'synthetic@example.org','participant',a);
 EXCEPTION WHEN OTHERS THEN
  IF position('Invitation team must belong' IN SQLERRM)=0 THEN RAISE; END IF;
  blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cross-agency invitation accepted'; END IF;
 INSERT INTO public.invitations(org_id,exercise_id,team_id,email,exercise_role,invited_by)
 VALUES(oa,ea,ta,'synthetic@example.org','participant',a) RETURNING id INTO inviteid;
 IF inviteid IS NULL THEN RAISE EXCEPTION 'Valid invitation not returned'; END IF;
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 IF (SELECT count(*) FROM public.document_records WHERE id=docid) <> 0 THEN RAISE EXCEPTION 'Document visible in other organization'; END IF;
 IF (SELECT count(*) FROM public.invitations WHERE id=inviteid) <> 0 THEN RAISE EXCEPTION 'Invitation visible in other organization'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: valid docs/invites and cross-tenant reference denial; fixtures rolled back' AS result;
