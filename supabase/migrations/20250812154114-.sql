-- Create RPC function to get search jobs from admin schema
CREATE OR REPLACE FUNCTION public.get_search_jobs()
RETURNS TABLE(
  id uuid,
  entity_type text,
  entity_id uuid,
  operation text,
  status text,
  error_message text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user is system admin
  IF NOT is_system_admin() THEN
    RAISE EXCEPTION 'Access denied. System admin required.';
  END IF;
  
  RETURN QUERY
  SELECT 
    sj.id,
    sj.entity_type,
    sj.entity_id,
    sj.operation,
    sj.status,
    sj.error_message,
    sj.created_at,
    sj.updated_at
  FROM admin.search_jobs sj
  ORDER BY sj.created_at DESC
  LIMIT 100;
END;
$function$;