-- Create validate_entity_exists function for associations
CREATE OR REPLACE FUNCTION public.validate_entity_exists(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean := false;
BEGIN
  -- Check based on entity type, handling both documents and documents_v2
  IF p_entity_type = 'document' THEN
    -- Check both old and new document tables
    SELECT EXISTS (
      SELECT 1 FROM documents WHERE id = p_entity_id AND is_deleted = false
      UNION ALL
      SELECT 1 FROM documents_v2 WHERE id = p_entity_id AND is_deleted = false
    ) INTO v_exists;
  ELSIF p_entity_type = 'task' THEN
    SELECT EXISTS (
      SELECT 1 FROM tasks WHERE id = p_entity_id AND is_deleted = false
    ) INTO v_exists;
  ELSIF p_entity_type = 'activity_log' THEN
    SELECT EXISTS (
      SELECT 1 FROM activity_logs WHERE id = p_entity_id AND is_deleted = false
    ) INTO v_exists;
  ELSIF p_entity_type = 'appointment' THEN
    SELECT EXISTS (
      SELECT 1 FROM appointments WHERE id = p_entity_id AND is_deleted = false
    ) INTO v_exists;
  ELSIF p_entity_type = 'contact' THEN
    SELECT EXISTS (
      SELECT 1 FROM contacts WHERE id = p_entity_id AND is_deleted = false
    ) INTO v_exists;
  END IF;
  
  RETURN v_exists;
END;
$$;

-- Add admin_only_visible column to documents_v2
ALTER TABLE documents_v2 
ADD COLUMN IF NOT EXISTS admin_only_visible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN documents_v2.admin_only_visible IS 'If true, only care group admins can view this document even when shared with group';