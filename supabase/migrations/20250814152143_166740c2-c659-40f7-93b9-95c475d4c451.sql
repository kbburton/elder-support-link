-- Security improvements: Enhanced audit logging and validation functions
-- Skip C function modifications due to permission restrictions

-- Add admin action audit logging table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on admin audit logs
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view admin audit logs
CREATE POLICY "Platform admins can view admin audit logs" 
ON public.admin_audit_logs 
FOR SELECT 
USING (is_platform_admin(auth.uid()));

-- Service role can insert audit logs
CREATE POLICY "Service role can insert admin audit logs" 
ON public.admin_audit_logs 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Expand document access logging to include more operations
CREATE TABLE IF NOT EXISTS public.enhanced_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  group_id UUID NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on enhanced audit logs
ALTER TABLE public.enhanced_audit_logs ENABLE ROW LEVEL SECURITY;

-- Group members can view audit logs for their groups
CREATE POLICY "Group members can view enhanced audit logs" 
ON public.enhanced_audit_logs 
FOR SELECT 
USING (is_user_member_of_group(group_id));

-- Users can create audit logs for groups they're members of
CREATE POLICY "Users can create enhanced audit logs" 
ON public.enhanced_audit_logs 
FOR INSERT 
WITH CHECK (is_user_member_of_group(group_id) AND auth.uid() = user_id);

-- Function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_email TEXT;
BEGIN
  -- Get user email from profiles
  SELECT email INTO current_user_email
  FROM profiles
  WHERE user_id = auth.uid();
  
  -- Insert audit log (this will be called by edge functions with service role)
  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    auth.uid(),
    COALESCE(current_user_email, 'unknown'),
    p_action,
    p_target_type,
    p_target_id,
    p_details
  );
END;
$$;

-- Function to log enhanced audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_group_id UUID,
  p_details JSONB DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_email TEXT;
BEGIN
  -- Get user email from profiles
  SELECT email INTO current_user_email
  FROM profiles
  WHERE user_id = auth.uid();
  
  -- Insert enhanced audit log
  INSERT INTO enhanced_audit_logs (
    user_id,
    user_email,
    action,
    resource_type,
    resource_id,
    group_id,
    details
  ) VALUES (
    auth.uid(),
    COALESCE(current_user_email, 'unknown'),
    p_action,
    p_resource_type,
    p_resource_id,
    p_group_id,
    p_details
  );
END;
$$;

-- Input validation function for enhanced security
CREATE OR REPLACE FUNCTION public.sanitize_input(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Return NULL for null input
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Basic XSS prevention: remove script tags and javascript: protocols
  -- This is a basic implementation - more sophisticated validation should be done client-side
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(input_text, '<script[^>]*>.*?</script>', '', 'gi'),
      'javascript:', '', 'gi'
    ),
    'on\w+\s*=', '', 'gi'
  );
END;
$$;