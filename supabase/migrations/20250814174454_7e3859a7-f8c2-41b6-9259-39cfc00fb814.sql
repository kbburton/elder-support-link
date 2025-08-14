-- Fix the RLS policy to handle new users properly
DROP POLICY IF EXISTS "Users can join groups via invitation" ON public.care_group_members;

CREATE POLICY "Users can join groups via invitation" ON public.care_group_members
FOR INSERT TO authenticated
WITH CHECK (
    -- Allow if user is already a member (for updates)
    (EXISTS (
        SELECT 1 FROM public.care_group_members cgm 
        WHERE cgm.group_id = care_group_members.group_id 
        AND cgm.user_id = auth.uid()
    )) OR
    -- Allow if there's a valid pending invitation for this user's email
    -- Check both the profiles table and auth.users for email matching
    (EXISTS (
        SELECT 1 FROM public.care_group_invitations cgi
        WHERE cgi.group_id = care_group_members.group_id 
        AND cgi.status = 'pending'
        AND cgi.expires_at > now()
        AND auth.uid() = care_group_members.user_id
        AND (
            -- Check profiles table
            (EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.user_id = auth.uid() 
                AND p.email = cgi.invited_email
            ))
            OR
            -- Check auth.users (in case profile doesn't exist yet)
            (auth.email() = cgi.invited_email)
        )
    )) OR
    -- Allow if user is admin of the group (for adding others)
    (EXISTS (
        SELECT 1 FROM public.care_group_members cgm 
        WHERE cgm.group_id = care_group_members.group_id 
        AND cgm.user_id = auth.uid() 
        AND cgm.is_admin = true
    ))
);