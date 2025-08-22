-- Update the RLS policy to use auth.users.email instead of profiles.email
DROP POLICY IF EXISTS "Users can join groups via invitation or as group creator" ON public.care_group_members;

CREATE POLICY "Users can join groups via invitation or as group creator" 
ON public.care_group_members
FOR INSERT 
WITH CHECK (
  (user_id = auth.uid()) AND (
    (EXISTS ( 
      SELECT 1 FROM care_groups cg
      WHERE cg.id = care_group_members.group_id 
        AND cg.created_by_user_id = auth.uid()
    )) OR 
    (EXISTS ( 
      SELECT 1 FROM care_group_invitations cgi
      JOIN auth.users au ON au.email = cgi.invited_email
      WHERE cgi.group_id = care_group_members.group_id 
        AND cgi.status = 'pending'
        AND cgi.expires_at > now() 
        AND au.id = auth.uid()
    )) OR 
    (EXISTS ( 
      SELECT 1 FROM care_group_members cgm
      WHERE cgm.group_id = care_group_members.group_id 
        AND cgm.user_id = auth.uid() 
        AND cgm.is_admin = true
    ))
  )
);