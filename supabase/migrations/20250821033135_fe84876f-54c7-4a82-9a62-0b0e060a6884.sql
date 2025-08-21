-- Fix the validate_entity_exists function to handle 'activity_log' instead of 'activity'
CREATE OR REPLACE FUNCTION public.validate_entity_exists(
  p_entity_type TEXT,
  p_entity_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  CASE p_entity_type
    WHEN 'task' THEN
      RETURN EXISTS (SELECT 1 FROM tasks WHERE id = p_entity_id AND is_deleted = false);
    WHEN 'document' THEN  
      RETURN EXISTS (SELECT 1 FROM documents WHERE id = p_entity_id AND is_deleted = false);
    WHEN 'activity_log' THEN
      RETURN EXISTS (SELECT 1 FROM activity_logs WHERE id = p_entity_id AND is_deleted = false);
    WHEN 'appointment' THEN
      RETURN EXISTS (SELECT 1 FROM appointments WHERE id = p_entity_id AND is_deleted = false);
    WHEN 'contact' THEN
      RETURN EXISTS (SELECT 1 FROM contacts WHERE id = p_entity_id AND is_deleted = false);
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;