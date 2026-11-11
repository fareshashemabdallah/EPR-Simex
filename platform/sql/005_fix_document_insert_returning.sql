-- Permit authorized document managers to read a just-inserted document row
-- during INSERT ... RETURNING; preserve existing recipient-specific visibility.
drop policy if exists doc_select on public.document_records;
create policy doc_select on public.document_records for select to authenticated using (
  public.can_manage_doc_scope(org_id,exercise_id) or public.can_view_document(id)
);