-- EPR-Simex test workspace cleanup safety: verified against Frankfurt test DB.
-- Creator/director may delete draft exercises with members/invites/messages.
-- Submitted decisions, released injects and uploaded files remain protected.
-- Empty organizations and teams with only member assignments can be deleted.
-- Install AFTER platform/sql/007_scoped_edit_delete_and_parent_safeguards.sql.
-- No RPC privileges or public grants are widened.

-- can_delete_draft_exercise
CREATE OR REPLACE FUNCTION private.can_delete_draft_exercise(_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS (
  SELECT 1 FROM public.exercises e
  WHERE e.id=_id AND e.created_by=auth.uid() AND e.status='draft'
  AND EXISTS (SELECT 1 FROM public.exercise_memberships m
              WHERE m.exercise_id=e.id AND m.user_id=auth.uid() AND m.role='director')
  AND NOT EXISTS (SELECT 1 FROM public.submissions s WHERE s.exercise_id=e.id)
  AND NOT EXISTS (SELECT 1 FROM public.injects i WHERE i.exercise_id=e.id AND i.status='released')
  AND NOT EXISTS (SELECT 1 FROM public.document_records d WHERE d.exercise_id=e.id AND d.kind='file')
 );
$function$
;

-- can_delete_empty_org
CREATE OR REPLACE FUNCTION private.can_delete_empty_org(_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS (
  SELECT 1 FROM public.organizations o
  WHERE o.id=_id AND o.created_by=auth.uid()
  AND NOT EXISTS (SELECT 1 FROM public.exercises e WHERE e.org_id=o.id)
  AND NOT EXISTS (SELECT 1 FROM public.document_records d WHERE d.org_id=o.id)
  AND NOT EXISTS (SELECT 1 FROM public.invitations i WHERE i.org_id=o.id)
 );
$function$
;

-- guard_structural_delete
CREATE OR REPLACE FUNCTION private.guard_structural_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.exercises e WHERE e.id=OLD.exercise_id) THEN
   RETURN OLD;
 END IF;
 IF TG_TABLE_NAME='teams' AND (
   EXISTS(SELECT 1 FROM public.inject_targets x WHERE x.team_id=OLD.id)
   OR EXISTS(SELECT 1 FROM public.submissions x WHERE x.team_id=OLD.id)
   OR EXISTS(SELECT 1 FROM public.messages x WHERE x.team_id=OLD.id OR x.to_team_id=OLD.id)
   OR EXISTS(SELECT 1 FROM public.document_records x WHERE x.team_id=OLD.id)
   OR EXISTS(SELECT 1 FROM public.invitations x WHERE x.team_id=OLD.id AND x.status='pending')
 ) THEN
   RAISE EXCEPTION 'Cannot delete this team: remove inject assignments, decisions, messages, references or pending invitations first';
 END IF;
 IF TG_TABLE_NAME='stages' AND (
   EXISTS(SELECT 1 FROM public.injects x WHERE x.stage_id=OLD.id)
   OR EXISTS(SELECT 1 FROM public.agenda_sessions x WHERE x.stage_id=OLD.id)
   OR EXISTS(SELECT 1 FROM public.exercises x WHERE x.current_stage_id=OLD.id)
 ) THEN RAISE EXCEPTION 'Cannot delete a stage referenced by an inject, session or current exercise stage'; END IF;
 IF TG_TABLE_NAME='agenda_days' AND EXISTS(SELECT 1 FROM public.agenda_sessions x WHERE x.day_id=OLD.id)
 THEN RAISE EXCEPTION 'Cannot delete a training day containing sessions'; END IF;
 IF TG_TABLE_NAME='agenda_sessions' AND (
   EXISTS(SELECT 1 FROM public.slides x WHERE x.session_id=OLD.id)
   OR EXISTS(SELECT 1 FROM public.document_records x WHERE x.session_id=OLD.id)
 ) THEN RAISE EXCEPTION 'Cannot delete a session containing slides or documents'; END IF;
 RETURN OLD;
END;
$function$
;