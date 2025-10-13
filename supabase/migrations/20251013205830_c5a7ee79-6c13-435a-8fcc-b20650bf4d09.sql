-- Fix the check_phone_uniqueness trigger to check table name first
CREATE OR REPLACE FUNCTION public.check_phone_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  phone_exists BOOLEAN := FALSE;
  clean_phone TEXT;
BEGIN
  -- Check table name FIRST, then handle phone validation for that specific table
  IF TG_TABLE_NAME = 'care_groups' THEN
    -- Skip check if phone is NULL or empty for care_groups
    IF NEW.recipient_phone IS NULL OR TRIM(NEW.recipient_phone) = '' THEN
      RETURN NEW;
    END IF;
    
    clean_phone := TRIM(NEW.recipient_phone);
    
    -- Check if phone exists in profiles table
    SELECT EXISTS (
      SELECT 1 FROM profiles 
      WHERE TRIM(phone) = clean_phone 
      AND phone IS NOT NULL 
      AND TRIM(phone) != ''
    ) INTO phone_exists;
    
    -- If updating, also check other care_groups
    IF TG_OP = 'UPDATE' THEN
      IF NOT phone_exists THEN
        SELECT EXISTS (
          SELECT 1 FROM care_groups 
          WHERE TRIM(recipient_phone) = clean_phone 
          AND recipient_phone IS NOT NULL 
          AND TRIM(recipient_phone) != ''
          AND id != NEW.id
        ) INTO phone_exists;
      END IF;
    ELSE
      -- For INSERT, check care_groups too
      IF NOT phone_exists THEN
        SELECT EXISTS (
          SELECT 1 FROM care_groups 
          WHERE TRIM(recipient_phone) = clean_phone 
          AND recipient_phone IS NOT NULL 
          AND TRIM(recipient_phone) != ''
        ) INTO phone_exists;
      END IF;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    -- Skip check if phone is NULL or empty for profiles
    IF NEW.phone IS NULL OR TRIM(NEW.phone) = '' THEN
      RETURN NEW;
    END IF;
    
    clean_phone := TRIM(NEW.phone);
    
    -- Check if phone exists in care_groups table
    SELECT EXISTS (
      SELECT 1 FROM care_groups 
      WHERE TRIM(recipient_phone) = clean_phone 
      AND recipient_phone IS NOT NULL 
      AND TRIM(recipient_phone) != ''
    ) INTO phone_exists;
    
    -- If updating, also check other profiles
    IF TG_OP = 'UPDATE' THEN
      IF NOT phone_exists THEN
        SELECT EXISTS (
          SELECT 1 FROM profiles 
          WHERE TRIM(phone) = clean_phone 
          AND phone IS NOT NULL 
          AND TRIM(phone) != ''
          AND user_id != NEW.user_id
        ) INTO phone_exists;
      END IF;
    ELSE
      -- For INSERT, check profiles too
      IF NOT phone_exists THEN
        SELECT EXISTS (
          SELECT 1 FROM profiles 
          WHERE TRIM(phone) = clean_phone 
          AND phone IS NOT NULL 
          AND TRIM(phone) != ''
        ) INTO phone_exists;
      END IF;
    END IF;
  END IF;

  -- Raise exception if phone number already exists
  IF phone_exists THEN
    RAISE EXCEPTION 'PHONE_DUPLICATE: That phone number is already in use. Please choose another number.' 
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;