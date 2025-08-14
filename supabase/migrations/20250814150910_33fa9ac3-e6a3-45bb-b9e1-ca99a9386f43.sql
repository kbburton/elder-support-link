-- Enable Row Level Security on platform_admins table
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Create policy for platform admins to view the table (only other platform admins can see who's an admin)
CREATE POLICY "Platform admins can view platform admin list" 
ON public.platform_admins 
FOR SELECT 
USING (is_platform_admin(auth.uid()));

-- Create policy for inserting new platform admins (only existing platform admins can add new ones)
CREATE POLICY "Platform admins can manage platform admin list" 
ON public.platform_admins 
FOR ALL 
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));