-- Create function to get system logs for admin users
CREATE OR REPLACE FUNCTION public.get_system_logs()
RETURNS TABLE(
  id uuid,
  level text,
  message text,
  component text,
  operation text,
  metadata jsonb,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user is system admin
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_roles 
    WHERE user_id = auth.uid() AND role = 'system_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. System admin required.';
  END IF;
  
  RETURN QUERY
  SELECT 
    sl.id,
    sl.level,
    sl.message,
    sl.component,
    sl.operation,
    sl.metadata,
    sl.created_at
  FROM public.system_logs sl
  ORDER BY sl.created_at DESC
  LIMIT 100;
END;
$$;