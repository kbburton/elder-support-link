-- Create security definer function for contact-appointment associations
CREATE OR REPLACE FUNCTION public.create_contact_appointment_association(p_contact_id uuid, p_appointment_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result_id UUID;
  v_contact_group_id UUID;
  v_appointment_group_id UUID;
BEGIN
  -- Get group IDs for both entities
  SELECT care_group_id INTO v_contact_group_id 
  FROM contacts 
  WHERE id = p_contact_id AND is_deleted = false;
  
  SELECT group_id INTO v_appointment_group_id 
  FROM appointments 
  WHERE id = p_appointment_id AND is_deleted = false;
  
  -- Check if entities exist and belong to same group
  IF v_contact_group_id IS NULL THEN
    RAISE EXCEPTION 'Contact not found or deleted';
  END IF;
  
  IF v_appointment_group_id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found or deleted';
  END IF;
  
  IF v_contact_group_id != v_appointment_group_id THEN
    RAISE EXCEPTION 'Contact and appointment must belong to the same care group';
  END IF;
  
  -- Check if user is member of the group
  IF NOT EXISTS (
    SELECT 1 FROM care_group_members 
    WHERE group_id = v_contact_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User not authorized for this group';
  END IF;
  
  -- Create the association
  INSERT INTO contact_appointments (contact_id, appointment_id)
  VALUES (p_contact_id, p_appointment_id)
  ON CONFLICT (contact_id, appointment_id) DO NOTHING
  RETURNING id INTO v_result_id;
  
  -- If no ID returned, association already exists
  IF v_result_id IS NULL THEN
    SELECT id INTO v_result_id 
    FROM contact_appointments 
    WHERE contact_id = p_contact_id AND appointment_id = p_appointment_id;
  END IF;
  
  RETURN v_result_id;
END;
$function$