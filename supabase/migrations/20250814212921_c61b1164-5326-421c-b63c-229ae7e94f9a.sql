-- Fix the care_group_members INSERT policy for invitation flow
DROP POLICY IF EXISTS "Users can join groups via invitation" ON public.care_group_members;

-- Create a simpler policy that allows users to join groups they have valid invitations for
CREATE POLICY "Users can join groups via invitation" ON public.care_group_members
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND (
    -- Allow if user already exists as a member (for admin management)
    EXISTS (
      SELECT 1 FROM care_group_members cgm 
      WHERE cgm.group_id = care_group_members.group_id 
      AND cgm.user_id = auth.uid()
    )
    OR
    -- Allow if user has a valid pending invitation for this group
    EXISTS (
      SELECT 1 FROM care_group_invitations cgi
      JOIN profiles p ON p.email = cgi.invited_email
      WHERE cgi.group_id = care_group_members.group_id
      AND cgi.status = 'pending'
      AND cgi.expires_at > now()
      AND p.user_id = auth.uid()
    )
    OR
    -- Allow if user is an admin of the group
    EXISTS (
      SELECT 1 FROM care_group_members cgm
      WHERE cgm.group_id = care_group_members.group_id
      AND cgm.user_id = auth.uid()
      AND cgm.is_admin = true
    )
  )
);