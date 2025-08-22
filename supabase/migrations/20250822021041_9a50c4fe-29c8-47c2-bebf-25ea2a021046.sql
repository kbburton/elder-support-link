-- Update is_platform_admin function to use admin_roles instead of platform_admins
CREATE OR REPLACE FUNCTION public.is_platform_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles 
    WHERE user_id = user_uuid AND role = 'system_admin'
  );
$$;

-- Add Keith Burton to admin_roles as system_admin
INSERT INTO public.admin_roles (user_id, role, created_by_user_id)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'kbburton3@gmail.com'),
  'system_admin',
  (SELECT id FROM auth.users WHERE email = 'kbburton3@gmail.com')
)
ON CONFLICT (user_id, role) DO NOTHING;