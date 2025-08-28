-- Update the create_care_group_with_member function to include all required fields
-- and wrap it in a transaction for data integrity

DROP FUNCTION IF EXISTS public.create_care_group_with_member(text, text, text, date, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_care_group_with_member(
  p_name text,
  p_recipient_first_name text,
  p_recipient_last_name text DEFAULT NULL,
  p_recipient_address text,
  p_recipient_city text,
  p_recipient_state text,
  p_recipient_zip text,
  p_recipient_phone text,
  p_recipient_email text,
  p_date_of_birth date,
  p_living_situation text DEFAULT NULL,
  p_profile_description text DEFAULT NULL,
  p_special_dates jsonb DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_other_important_information text DEFAULT NULL,
  p_mobility text DEFAULT NULL,
  p_memory text DEFAULT NULL,
  p_hearing text DEFAULT NULL,
  p_vision text DEFAULT NULL,
  p_mental_health text DEFAULT NULL,
  p_chronic_conditions text DEFAULT NULL,
  p_relationship_to_recipient text
)
RETURNS TABLE(group_id uuid, group_name text, success boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_group_id UUID;
  v_group_name TEXT;
BEGIN
  -- Start transaction
  BEGIN
    -- Get the current user ID
    v_user_id := auth.uid();
    
    -- Check if user is authenticated
    IF v_user_id IS NULL THEN
      RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'User not authenticated'::TEXT;
      RETURN;
    END IF;
    
    -- Set the group name
    v_group_name := COALESCE(p_name, p_recipient_first_name || ' ' || COALESCE(p_recipient_last_name, ''));
    
    -- Create the care group with all fields
    INSERT INTO public.care_groups (
      name,
      recipient_first_name,
      recipient_last_name,
      recipient_address,
      recipient_city,
      recipient_state,
      recipient_zip,
      recipient_phone,
      recipient_email,
      date_of_birth,
      living_situation,
      profile_description,
      special_dates,
      gender,
      other_important_information,
      mobility,
      memory,
      hearing,
      vision,
      mental_health,
      chronic_conditions,
      created_by_user_id
    ) VALUES (
      v_group_name,
      p_recipient_first_name,
      p_recipient_last_name,
      p_recipient_address,
      p_recipient_city,
      p_recipient_state,
      p_recipient_zip,
      p_recipient_phone,
      p_recipient_email,
      p_date_of_birth,
      p_living_situation,
      p_profile_description,
      p_special_dates,
      p_gender,
      p_other_important_information,
      p_mobility,
      p_memory,
      p_hearing,
      p_vision,
      p_mental_health,
      p_chronic_conditions,
      v_user_id
    ) RETURNING id INTO v_group_id;
    
    -- Add the user as an admin member with relationship
    INSERT INTO public.care_group_members (
      group_id,
      user_id,
      role,
      is_admin,
      relationship_to_recipient
    ) VALUES (
      v_group_id,
      v_user_id,
      'admin',
      TRUE,
      p_relationship_to_recipient
    );
    
    -- Return success
    RETURN QUERY SELECT v_group_id, v_group_name, TRUE, NULL::TEXT;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback will happen automatically due to the exception
    -- Return error
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, SQLERRM::TEXT;
  END;
END;
$function$;