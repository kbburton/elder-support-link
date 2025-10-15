-- Ensure RLS is enabled on documents_v2 (no-op if already enabled)
ALTER TABLE public.documents_v2 ENABLE ROW LEVEL SECURITY;

-- Allow group members to update group documents and owners to update personal documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'documents_v2' 
      AND policyname = 'Members can update documents_v2'
  ) THEN
    CREATE POLICY "Members can update documents_v2"
    ON public.documents_v2
    FOR UPDATE
    USING (
      (group_id IS NOT NULL AND is_user_member_of_group(group_id))
      OR (group_id IS NULL AND uploaded_by_user_id = auth.uid())
    )
    WITH CHECK (
      (group_id IS NOT NULL AND is_user_member_of_group(group_id))
      OR (group_id IS NULL AND uploaded_by_user_id = auth.uid())
    );
  END IF;
END$$;