-- Create phone number uniqueness constraint across care_groups and profiles tables
-- Function to check phone uniqueness
CREATE OR REPLACE FUNCTION check_phone_uniqueness()
RETURNS TRIGGER AS $$
DECLARE
  phone_exists BOOLEAN := FALSE;
  clean_phone TEXT;
BEGIN
  -- Skip check if phone is NULL or empty
  IF NEW.recipient_phone IS NULL OR TRIM(NEW.recipient_phone) = '' THEN
    -- Check for care_groups table
    IF TG_TABLE_NAME = 'care_groups' THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.phone IS NULL OR TRIM(NEW.phone) = '' THEN
    -- Check for profiles table
    IF TG_TABLE_NAME = 'profiles' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Get the phone number to check based on table
  IF TG_TABLE_NAME = 'care_groups' THEN
    clean_phone := TRIM(NEW.recipient_phone);
    
    -- Check if phone exists in profiles table (excluding current record if updating)
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
$$ LANGUAGE plpgsql;

-- Create triggers for both tables
DROP TRIGGER IF EXISTS check_care_group_phone_uniqueness ON care_groups;
CREATE TRIGGER check_care_group_phone_uniqueness
  BEFORE INSERT OR UPDATE OF recipient_phone ON care_groups
  FOR EACH ROW
  EXECUTE FUNCTION check_phone_uniqueness();

DROP TRIGGER IF EXISTS check_profile_phone_uniqueness ON profiles;
CREATE TRIGGER check_profile_phone_uniqueness
  BEFORE INSERT OR UPDATE OF phone ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_phone_uniqueness();