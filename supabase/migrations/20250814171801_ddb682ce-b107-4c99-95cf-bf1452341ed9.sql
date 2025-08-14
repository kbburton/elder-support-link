-- Fix RLS policy for care_group_members to allow invitation acceptance
-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage group members where they are members" ON care_group_members;
DROP POLICY IF EXISTS "Users can view group members where they are members" ON care_group_members;

-- Create new policies that allow invitation acceptance
CREATE POLICY "Members can view group members"
ON care_group_members
FOR SELECT
USING (is_user_member_of_group(group_id));

CREATE POLICY "Members can update group members"
ON care_group_members
FOR UPDATE
USING (is_user_member_of_group(group_id));

CREATE POLICY "Members can delete group members"
ON care_group_members
FOR DELETE
USING (is_user_member_of_group(group_id));

-- Allow users to join groups via invitation
-- This checks if there's a valid pending invitation for the user
CREATE POLICY "Users can join groups via invitation"
ON care_group_members
FOR INSERT
WITH CHECK (
  -- Allow if user is accepting a valid invitation
  EXISTS (
    SELECT 1 
    FROM care_group_invitations cgi
    JOIN profiles p ON p.email = cgi.invited_email
    WHERE cgi.group_id = care_group_members.group_id
      AND p.user_id = care_group_members.user_id
      AND cgi.status = 'pending'
      AND cgi.expires_at > now()
      AND auth.uid() = care_group_members.user_id
  )
  -- OR user is already a member (for admin adding other members)
  OR is_user_member_of_group(care_group_members.group_id)
);