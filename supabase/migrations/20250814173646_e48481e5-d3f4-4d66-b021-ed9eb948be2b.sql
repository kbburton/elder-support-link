-- Fix the search path security issue for the user deletion function
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
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
$$;