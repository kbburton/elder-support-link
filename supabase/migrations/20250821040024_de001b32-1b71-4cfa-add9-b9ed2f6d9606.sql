-- Create security definer functions that can work around auth context issues
-- Function to create activity-appointment associations
CREATE OR REPLACE FUNCTION public.create_appointment_activity_association(
  p_appointment_id UUID,
  p_activity_log_id UUID,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_result_id UUID;
  v_appointment_group_id UUID;
  v_activity_group_id UUID;
BEGIN
  -- Get group IDs for both entities
  SELECT group_id INTO v_appointment_group_id 
  FROM appointments 
  WHERE id = p_appointment_id AND is_deleted = false;
  
  SELECT group_id INTO v_activity_group_id 
  FROM activity_logs 
  WHERE id = p_activity_log_id AND is_deleted = false;
  
  -- Check if entities exist and belong to same group
  IF v_appointment_group_id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found or deleted';
  END IF;
  
  IF v_activity_group_id IS NULL THEN
    RAISE EXCEPTION 'Activity not found or deleted';
  END IF;
  
  IF v_appointment_group_id != v_activity_group_id THEN
    RAISE EXCEPTION 'Entities must belong to the same care group';
  END IF;
  
  -- Check if user is member of the group
  IF NOT EXISTS (
    SELECT 1 FROM care_group_members 
    WHERE group_id = v_appointment_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User not authorized for this group';
  END IF;
  
  -- Create the association
  INSERT INTO appointment_activities (appointment_id, activity_log_id, created_by_user_id)
  VALUES (p_appointment_id, p_activity_log_id, p_user_id)
  ON CONFLICT (appointment_id, activity_log_id) DO NOTHING
  RETURNING id INTO v_result_id;
  
  -- If no ID returned, association already exists
  IF v_result_id IS NULL THEN
    SELECT id INTO v_result_id 
    FROM appointment_activities 
    WHERE appointment_id = p_appointment_id AND activity_log_id = p_activity_log_id;
  END IF;
  
  RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create activity-contact associations  
CREATE OR REPLACE FUNCTION public.create_contact_activity_association(
  p_contact_id UUID,
  p_activity_log_id UUID,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_result_id UUID;
  v_contact_group_id UUID;
  v_activity_group_id UUID;
BEGIN
  -- Get group IDs for both entities
  SELECT care_group_id INTO v_contact_group_id 
  FROM contacts 
  WHERE id = p_contact_id AND is_deleted = false;
  
  SELECT group_id INTO v_activity_group_id 
  FROM activity_logs 
  WHERE id = p_activity_log_id AND is_deleted = false;
  
  -- Check if entities exist and belong to same group
  IF v_contact_group_id IS NULL THEN
    RAISE EXCEPTION 'Contact not found or deleted';
  END IF;
  
  IF v_activity_group_id IS NULL THEN
    RAISE EXCEPTION 'Activity not found or deleted';  
  END IF;
  
  IF v_contact_group_id != v_activity_group_id THEN
    RAISE EXCEPTION 'Entities must belong to the same care group';
  END IF;
  
  -- Check if user is member of the group
  IF NOT EXISTS (
    SELECT 1 FROM care_group_members 
    WHERE group_id = v_contact_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User not authorized for this group';
  END IF;
  
  -- Create the association
  INSERT INTO contact_activities (contact_id, activity_log_id)
  VALUES (p_contact_id, p_activity_log_id)
  ON CONFLICT (contact_id, activity_log_id) DO NOTHING
  RETURNING id INTO v_result_id;
  
  -- If no ID returned, association already exists
  IF v_result_id IS NULL THEN
    SELECT id INTO v_result_id 
    FROM contact_activities 
    WHERE contact_id = p_contact_id AND activity_log_id = p_activity_log_id;
  END IF;
  
  RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create activity-task associations
CREATE OR REPLACE FUNCTION public.create_task_activity_association(
  p_task_id UUID,
  p_activity_log_id UUID,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_result_id UUID;
  v_task_group_id UUID;
  v_activity_group_id UUID;
BEGIN
  -- Get group IDs for both entities
  SELECT group_id INTO v_task_group_id 
  FROM tasks 
  WHERE id = p_task_id AND is_deleted = false;
  
  SELECT group_id INTO v_activity_group_id 
  FROM activity_logs 
  WHERE id = p_activity_log_id AND is_deleted = false;
  
  -- Check if entities exist and belong to same group
  IF v_task_group_id IS NULL THEN
    RAISE EXCEPTION 'Task not found or deleted';
  END IF;
  
  IF v_activity_group_id IS NULL THEN
    RAISE EXCEPTION 'Activity not found or deleted';
  END IF;
  
  IF v_task_group_id != v_activity_group_id THEN
    RAISE EXCEPTION 'Entities must belong to the same care group';
  END IF;
  
  -- Check if user is member of the group
  IF NOT EXISTS (
    SELECT 1 FROM care_group_members 
    WHERE group_id = v_task_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User not authorized for this group';
  END IF;
  
  -- Create the association
  INSERT INTO task_activities (task_id, activity_log_id, created_by_user_id)
  VALUES (p_task_id, p_activity_log_id, p_user_id)
  ON CONFLICT (task_id, activity_log_id) DO NOTHING
  RETURNING id INTO v_result_id;
  
  -- If no ID returned, association already exists
  IF v_result_id IS NULL THEN
    SELECT id INTO v_result_id 
    FROM task_activities 
    WHERE task_id = p_task_id AND activity_log_id = p_activity_log_id;
  END IF;
  
  RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;