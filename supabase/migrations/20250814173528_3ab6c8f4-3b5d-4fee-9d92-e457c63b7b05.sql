-- Create a function to clean up user data when a user is deleted
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Clean up profiles table
    DELETE FROM public.profiles WHERE user_id = OLD.id;
    
    -- Clean up care group members
    DELETE FROM public.care_group_members WHERE user_id = OLD.id;
    
    -- Clean up notification preferences
    DELETE FROM public.notification_preferences WHERE user_id = OLD.id;
    
    -- Clean up group access logs
    DELETE FROM public.group_access_logs WHERE user_id = OLD.id;
    
    -- Clean up any other user-related data
    DELETE FROM public.enhanced_audit_logs WHERE user_id = OLD.id;
    DELETE FROM public.document_access_logs WHERE user_id = OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically clean up when user is deleted from auth.users
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_deletion();

-- Also update the care_group_members RLS policy to be more permissive for invitations
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
    (EXISTS (
        SELECT 1 FROM public.care_group_invitations cgi
        JOIN public.profiles p ON p.email = cgi.invited_email
        WHERE cgi.group_id = care_group_members.group_id 
        AND p.user_id = care_group_members.user_id
        AND cgi.status = 'pending'
        AND cgi.expires_at > now()
        AND auth.uid() = care_group_members.user_id
    )) OR
    -- Allow if user is admin of the group (for adding others)
    (EXISTS (
        SELECT 1 FROM public.care_group_members cgm 
        WHERE cgm.group_id = care_group_members.group_id 
        AND cgm.user_id = auth.uid() 
        AND cgm.is_admin = true
    ))
);