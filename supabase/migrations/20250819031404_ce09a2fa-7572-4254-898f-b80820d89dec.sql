-- Create a function to get group members with their profile information
CREATE OR REPLACE FUNCTION public.get_group_members(p_group_id uuid)
RETURNS TABLE(
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  display_name text,
  role text,
  is_admin boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cgm.user_id,
    p.email,
    p.first_name,
    p.last_name,
    CASE 
      WHEN p.first_name IS NOT NULL AND p.last_name IS NOT NULL 
      THEN TRIM(p.first_name || ' ' || p.last_name)
      ELSE COALESCE(p.email, 'Unknown User')
    END as display_name,
    cgm.role,
    cgm.is_admin
  FROM public.care_group_members cgm
  LEFT JOIN public.profiles p ON p.user_id = cgm.user_id
  WHERE cgm.group_id = p_group_id
  ORDER BY p.first_name, p.last_name, p.email;
$$;