-- Fix infinite recursion in document_v2_group_shares RLS policies

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view shares for their documents" ON document_v2_group_shares;
DROP POLICY IF EXISTS "Users can share their own documents" ON document_v2_group_shares;
DROP POLICY IF EXISTS "Users can unshare their own documents" ON document_v2_group_shares;

-- Create security definer functions to break recursion
CREATE OR REPLACE FUNCTION public.is_document_owner(
  _document_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM documents_v2
    WHERE id = _document_id
      AND uploaded_by_user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(
  _group_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM care_group_members
    WHERE group_id = _group_id
      AND user_id = _user_id
  );
$$;

-- Create new RLS policies using security definer functions
CREATE POLICY "Users can view shares for their documents or groups"
  ON document_v2_group_shares
  FOR SELECT
  USING (
    public.is_document_owner(document_id, auth.uid())
    OR public.is_group_member(group_id, auth.uid())
  );

CREATE POLICY "Users can share their own documents to groups they belong to"
  ON document_v2_group_shares
  FOR INSERT
  WITH CHECK (
    public.is_document_owner(document_id, auth.uid())
    AND public.is_group_member(group_id, auth.uid())
  );

CREATE POLICY "Users can unshare their own documents"
  ON document_v2_group_shares
  FOR DELETE
  USING (
    public.is_document_owner(document_id, auth.uid())
  );

CREATE POLICY "Group members can unshare documents from their groups"
  ON document_v2_group_shares
  FOR DELETE
  USING (
    public.is_group_member(group_id, auth.uid())
  );