-- Fix the get_group_members function to only use auth.users for email
CREATE OR REPLACE FUNCTION public.get_group_members(p_group_id uuid)
RETURNS TABLE(user_id uuid, email text, first_name text, last_name text, display_name text, role text, is_admin boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    cgm.user_id,
    COALESCE(au.email, 'unknown@example.com') as email,
    p.first_name,
    p.last_name,
    CASE 
      WHEN p.first_name IS NOT NULL AND p.last_name IS NOT NULL 
      THEN TRIM(p.first_name || ' ' || p.last_name)
      ELSE COALESCE(au.email, 'Unknown User')
    END as display_name,
    cgm.role,
    cgm.is_admin
  FROM public.care_group_members cgm
  LEFT JOIN public.profiles p ON p.user_id = cgm.user_id
  LEFT JOIN auth.users au ON au.id = cgm.user_id
  WHERE cgm.group_id = p_group_id
  ORDER BY p.first_name, p.last_name, au.email;
$function$