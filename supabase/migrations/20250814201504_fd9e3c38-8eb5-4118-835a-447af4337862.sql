-- Clean up duplicate profiles for kbburton3@hotmail.com
-- This will also trigger cascade deletes for related data

DELETE FROM public.profiles 
WHERE email = 'kbburton3@hotmail.com' 
AND user_id IN ('e09f497c-3821-4897-9200-96caeaa22e16', '37d73ab5-a5d7-487a-9399-1e067aa6a940');

-- Also clean up any admin roles for these user IDs (just in case)
DELETE FROM public.admin_roles 
WHERE user_id IN ('e09f497c-3821-4897-9200-96caeaa22e16', '37d73ab5-a5d7-487a-9399-1e067aa6a940');

-- Clean up platform admin entries if any
DELETE FROM public.platform_admins 
WHERE user_id IN ('e09f497c-3821-4897-9200-96caeaa22e16', '37d73ab5-a5d7-487a-9399-1e067aa6a940');

-- Improve the user deletion trigger to ensure complete cleanup
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    -- Clean up profiles table
    DELETE FROM public.profiles WHERE user_id = OLD.id;
    
    -- Clean up care group members
    DELETE FROM public.care_group_members WHERE user_id = OLD.id;
    
    -- Clean up notification preferences
    DELETE FROM public.notification_preferences WHERE user_id = OLD.id;
    
    -- Clean up group access logs
    DELETE FROM public.group_access_logs WHERE user_id = OLD.id;
    
    -- Clean up admin roles
    DELETE FROM public.admin_roles WHERE user_id = OLD.id;
    
    -- Clean up platform admins
    DELETE FROM public.platform_admins WHERE user_id = OLD.id;
    
    -- Clean up any other user-related data
    DELETE FROM public.enhanced_audit_logs WHERE user_id = OLD.id;
    DELETE FROM public.document_access_logs WHERE user_id = OLD.id;
    
    RETURN OLD;
END;
$function$;