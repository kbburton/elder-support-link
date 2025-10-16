-- Update RLS policies for documents_v2 to respect admin_only_visible

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Members can view documents" ON documents_v2;

-- Create new SELECT policy that respects admin_only_visible
CREATE POLICY "Members can view documents" ON documents_v2
FOR SELECT
USING (
  -- Personal documents: owner can always see
  (is_shared_with_group = false AND uploaded_by_user_id = auth.uid())
  OR
  -- Shared documents: all members can see if not admin-only
  (is_shared_with_group = true AND admin_only_visible = false AND is_user_member_of_group(group_id))
  OR
  -- Admin-only documents: only admins can see
  (is_shared_with_group = true AND admin_only_visible = true AND is_user_admin_of_group(group_id))
);