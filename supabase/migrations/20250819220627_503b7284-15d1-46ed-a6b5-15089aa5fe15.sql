-- Create security definer function to validate entity existence
-- This bypasses RLS to check if entities exist for association validation
CREATE OR REPLACE FUNCTION public.validate_entity_exists(
  p_entity_type text,
  p_entity_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  CASE p_entity_type
    WHEN 'task' THEN
      RETURN EXISTS (SELECT 1 FROM tasks WHERE id = p_entity_id AND is_deleted = false);
    WHEN 'document' THEN  
      RETURN EXISTS (SELECT 1 FROM documents WHERE id = p_entity_id AND is_deleted = false);
    WHEN 'activity' THEN
      RETURN EXISTS (SELECT 1 FROM activity_logs WHERE id = p_entity_id AND is_deleted = false);
    WHEN 'appointment' THEN
      RETURN EXISTS (SELECT 1 FROM appointments WHERE id = p_entity_id AND is_deleted = false);
    WHEN 'contact' THEN
      RETURN EXISTS (SELECT 1 FROM contacts WHERE id = p_entity_id AND is_deleted = false);
    ELSE
      RETURN false;
  END CASE;
END;
$$;