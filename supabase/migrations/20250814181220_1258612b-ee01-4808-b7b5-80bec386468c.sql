-- Simplify the care_group_members RLS policy for invitation acceptance
DROP POLICY IF EXISTS "Users can join groups via invitation" ON care_group_members;

CREATE POLICY "Users can join groups via invitation" ON care_group_members
FOR INSERT 
WITH CHECK (
  -- User can join if they're already a member (shouldn't happen but safe)
  (EXISTS (
    SELECT 1 FROM care_group_members cgm 
    WHERE cgm.group_id = care_group_members.group_id 
    AND cgm.user_id = auth.uid()
  ))
  OR
  -- User can join if there's a valid invitation for their email
  (EXISTS (
    SELECT 1 FROM care_group_invitations cgi 
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE cgi.group_id = care_group_members.group_id 
    AND cgi.status = 'pending'
    AND cgi.expires_at > now()
    AND cgi.invited_email = p.email
    AND auth.uid() = care_group_members.user_id
  ))
  OR
  -- User can join if they're an admin of the group
  (EXISTS (
    SELECT 1 FROM care_group_members cgm 
    WHERE cgm.group_id = care_group_members.group_id 
    AND cgm.user_id = auth.uid() 
    AND cgm.is_admin = true
  ))
);