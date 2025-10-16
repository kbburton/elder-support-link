-- Migrate existing documents with group_id to the junction table
INSERT INTO public.document_v2_group_shares (document_id, group_id, shared_by_user_id)
SELECT 
  id as document_id,
  group_id,
  uploaded_by_user_id as shared_by_user_id
FROM public.documents_v2
WHERE group_id IS NOT NULL 
  AND is_shared_with_group = true
  AND is_deleted = false
ON CONFLICT DO NOTHING;