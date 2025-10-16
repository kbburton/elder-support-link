-- Create junction table for document-to-care-group sharing
CREATE TABLE IF NOT EXISTS public.document_v2_group_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents_v2(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.care_groups(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, group_id)
);

-- Enable RLS on junction table
ALTER TABLE public.document_v2_group_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_v2_group_shares
CREATE POLICY "Users can view shares for their documents"
ON public.document_v2_group_shares
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM documents_v2 d
    WHERE d.id = document_v2_group_shares.document_id
    AND d.uploaded_by_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM care_group_members cgm
    WHERE cgm.group_id = document_v2_group_shares.group_id
    AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can share their own documents"
ON public.document_v2_group_shares
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents_v2 d
    WHERE d.id = document_v2_group_shares.document_id
    AND d.uploaded_by_user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM care_group_members cgm
    WHERE cgm.group_id = document_v2_group_shares.group_id
    AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can unshare their own documents"
ON public.document_v2_group_shares
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM documents_v2 d
    WHERE d.id = document_v2_group_shares.document_id
    AND d.uploaded_by_user_id = auth.uid()
  )
);

-- RLS Policies for documents_v2 table
CREATE POLICY "Users can view their own documents"
ON public.documents_v2
FOR SELECT
TO authenticated
USING (uploaded_by_user_id = auth.uid());

CREATE POLICY "Group members can view shared documents"
ON public.documents_v2
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM document_v2_group_shares dvgs
    JOIN care_group_members cgm ON cgm.group_id = dvgs.group_id
    WHERE dvgs.document_id = documents_v2.id
    AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own documents"
ON public.documents_v2
FOR INSERT
TO authenticated
WITH CHECK (uploaded_by_user_id = auth.uid());

CREATE POLICY "Users can update their own documents"
ON public.documents_v2
FOR UPDATE
TO authenticated
USING (uploaded_by_user_id = auth.uid())
WITH CHECK (uploaded_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own documents"
ON public.documents_v2
FOR DELETE
TO authenticated
USING (uploaded_by_user_id = auth.uid());

CREATE POLICY "Group admins can view deleted documents"
ON public.documents_v2
FOR SELECT
TO authenticated
USING (
  is_deleted = true
  AND EXISTS (
    SELECT 1 FROM document_v2_group_shares dvgs
    JOIN care_group_members cgm ON cgm.group_id = dvgs.group_id
    WHERE dvgs.document_id = documents_v2.id
    AND cgm.user_id = auth.uid()
    AND cgm.is_admin = true
  )
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_document_v2_group_shares_document_id 
ON public.document_v2_group_shares(document_id);

CREATE INDEX IF NOT EXISTS idx_document_v2_group_shares_group_id 
ON public.document_v2_group_shares(group_id);