-- Fix RLS policy to work during registration without depending on profiles table
DROP POLICY IF EXISTS "Users can join groups via invitation" ON care_group_members;

CREATE POLICY "Users can join groups via invitation" 
ON care_group_members 
FOR INSERT 
WITH CHECK (
  -- Allow if user is already a member (existing functionality)
  (EXISTS ( SELECT 1
     FROM care_group_members cgm
    WHERE ((cgm.group_id = care_group_members.group_id) AND (cgm.user_id = auth.uid())))) 
  OR 
  -- Allow if there's a pending invitation for this group and the insert matches the user
  (care_group_members.user_id = auth.uid() AND EXISTS ( SELECT 1
     FROM care_group_invitations cgi
    WHERE ((cgi.group_id = care_group_members.group_id) 
           AND (cgi.status = 'pending'::text) 
           AND (cgi.expires_at > now()))))
  OR 
  -- Allow if current user is an admin of the group (existing functionality)
  (EXISTS ( SELECT 1
     FROM care_group_members cgm
    WHERE ((cgm.group_id = care_group_members.group_id) AND (cgm.user_id = auth.uid()) AND (cgm.is_admin = true))))
);