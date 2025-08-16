-- Fix the circular RLS policy on care_group_members
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can join groups via invitation" ON public.care_group_members;

-- Create a simpler policy that allows users to add themselves to groups they created
CREATE POLICY "Users can join groups via invitation or as group creator" 
ON public.care_group_members 
FOR INSERT 
WITH CHECK (
  (user_id = auth.uid()) AND (
    -- Allow if user created the group
    EXISTS (
      SELECT 1 FROM care_groups cg 
      WHERE cg.id = care_group_members.group_id 
      AND cg.created_by_user_id = auth.uid()
    )
    -- OR if user has a valid invitation
    OR EXISTS (
      SELECT 1 FROM care_group_invitations cgi
      JOIN profiles p ON p.email = cgi.invited_email
      WHERE cgi.group_id = care_group_members.group_id 
      AND cgi.status = 'pending'
      AND cgi.expires_at > now()
      AND p.user_id = auth.uid()
    )
    -- OR if user is already an admin (for existing groups)
    OR EXISTS (
      SELECT 1 FROM care_group_members cgm
      WHERE cgm.group_id = care_group_members.group_id 
      AND cgm.user_id = auth.uid() 
      AND cgm.is_admin = true
    )
  )
);