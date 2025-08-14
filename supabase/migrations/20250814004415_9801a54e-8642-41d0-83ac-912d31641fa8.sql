-- Add RLS policies for app_settings table to allow platform admins to access it
CREATE POLICY "Platform admins can view app settings" 
ON public.app_settings 
FOR SELECT 
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage app settings" 
ON public.app_settings 
FOR ALL 
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));