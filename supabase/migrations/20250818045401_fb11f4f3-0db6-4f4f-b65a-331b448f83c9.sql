-- Fix soft_delete_appointment function by removing updated_at reference
CREATE OR REPLACE FUNCTION public.soft_delete_appointment(
  p_by_email        text,
  p_by_user_id      uuid,
  p_appointment_id  uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_updated  uuid;
BEGIN
  -- Find the group for audit
  SELECT group_id
    INTO v_group_id
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Appointment % not found', p_appointment_id
      USING errcode = 'P0001';
  END IF;

  -- Soft delete (removed updated_at reference)
  UPDATE public.appointments
     SET is_deleted         = true,
         deleted_at         = now(),
         deleted_by_user_id = p_by_user_id,
         deleted_by_email   = p_by_email
   WHERE id = p_appointment_id
     AND is_deleted = false
   RETURNING id INTO v_updated;

  IF v_updated IS NULL THEN
    RAISE EXCEPTION 'Appointment % was already deleted or update blocked', p_appointment_id
      USING errcode = 'P0001';
  END IF;

  -- Audit trail
  PERFORM public.log_deletion_action(
    'appointment',
    p_appointment_id,
    v_group_id,
    p_by_user_id,
    p_by_email,
    'soft_delete',
    null
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_appointment(text, uuid, uuid)
  TO anon, authenticated;

-- Fix restore_appointment function by removing updated_at reference  
CREATE OR REPLACE FUNCTION public.restore_appointment(
  p_by_email        text,
  p_by_user_id      uuid,
  p_appointment_id  uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_updated  uuid;
BEGIN
  SELECT group_id
    INTO v_group_id
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Appointment % not found', p_appointment_id
      USING errcode = 'P0001';
  END IF;

  UPDATE public.appointments
     SET is_deleted         = false,
         deleted_at         = null,
         deleted_by_user_id = null,
         deleted_by_email   = null
   WHERE id = p_appointment_id
     AND is_deleted = true
   RETURNING id INTO v_updated;

  IF v_updated IS NULL THEN
    RAISE EXCEPTION 'Appointment % is not soft-deleted or restore blocked', p_appointment_id
      USING errcode = 'P0001';
  END IF;

  PERFORM public.log_deletion_action(
    'appointment',
    p_appointment_id,
    v_group_id,
    p_by_user_id,
    p_by_email,
    'restore',
    null
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_appointment(text, uuid, uuid)
  TO anon, authenticated;