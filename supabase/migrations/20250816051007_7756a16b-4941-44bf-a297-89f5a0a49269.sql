-- Create a secure function to handle care group creation
CREATE OR REPLACE FUNCTION public.create_care_group_with_member(
  p_name TEXT,
  p_recipient_first_name TEXT,
  p_recipient_last_name TEXT,
  p_date_of_birth DATE DEFAULT NULL,
  p_living_situation TEXT DEFAULT NULL,
  p_profile_description TEXT DEFAULT NULL,
  p_special_dates JSONB DEFAULT NULL
)
RETURNS TABLE(
  group_id UUID,
  group_name TEXT,
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_group_id UUID;
  v_group_name TEXT;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'User not authenticated'::TEXT;
    RETURN;
  END IF;
  
  -- Set the group name
  v_group_name := COALESCE(p_name, p_recipient_first_name || ' ' || p_recipient_last_name);
  
  -- Create the care group
  INSERT INTO public.care_groups (
    name,
    recipient_first_name,
    recipient_last_name,
    date_of_birth,
    living_situation,
    profile_description,
    special_dates,
    created_by_user_id
  ) VALUES (
    v_group_name,
    p_recipient_first_name,
    p_recipient_last_name,
    p_date_of_birth,
    p_living_situation,
    p_profile_description,
    p_special_dates,
    v_user_id
  ) RETURNING id INTO v_group_id;
  
  -- Add the user as an admin member
  INSERT INTO public.care_group_members (
    group_id,
    user_id,
    role,
    is_admin
  ) VALUES (
    v_group_id,
    v_user_id,
    'admin',
    TRUE
  );
  
  -- Return success
  RETURN QUERY SELECT v_group_id, v_group_name, TRUE, NULL::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  -- Return error
  RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, SQLERRM::TEXT;
END;
$$;