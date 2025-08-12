-- Create admin roles table
CREATE TABLE public.admin_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('system_admin', 'group_admin')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_user_id UUID,
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Create policies for admin roles
CREATE POLICY "System admins can manage all admin roles"
ON public.admin_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid() 
    AND ar.role = 'system_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid() 
    AND ar.role = 'system_admin'
  )
);

CREATE POLICY "Users can view their own admin roles"
ON public.admin_roles
FOR SELECT
USING (user_id = auth.uid());

-- Create function to check if user is system admin
CREATE OR REPLACE FUNCTION public.is_system_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles 
    WHERE user_id = user_uuid 
    AND role = 'system_admin'
  );
$$;

-- Insert system admin role for wbinport@gmail.com
-- First, get the user_id from profiles table
INSERT INTO public.admin_roles (user_id, role, created_by_user_id)
SELECT p.user_id, 'system_admin', p.user_id
FROM public.profiles p
WHERE p.email = 'wbinport@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;