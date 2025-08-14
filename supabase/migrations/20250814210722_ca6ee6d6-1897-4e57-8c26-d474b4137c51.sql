-- Fix RLS policy for care_group_members to allow registration flow
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
  -- Allow if user has a pending invitation with matching email AND they're inserting their own user_id
  (EXISTS ( SELECT 1
     FROM (care_group_invitations cgi
       JOIN profiles p ON ((p.user_id = care_group_members.user_id)))
    WHERE ((cgi.group_id = care_group_members.group_id) 
           AND (cgi.status = 'pending'::text) 
           AND (cgi.expires_at > now()) 
           AND (cgi.invited_email = p.email))))
  OR 
  -- Allow if current user is an admin of the group (existing functionality)
  (EXISTS ( SELECT 1
     FROM care_group_members cgm
    WHERE ((cgm.group_id = care_group_members.group_id) AND (cgm.user_id = auth.uid()) AND (cgm.is_admin = true))))
);