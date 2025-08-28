-- Update existing records to have default values for all required fields
UPDATE public.care_groups 
SET 
  recipient_phone = COALESCE(recipient_phone, ''),
  recipient_email = COALESCE(recipient_email, ''),
  recipient_address = COALESCE(recipient_address, ''),
  recipient_city = COALESCE(recipient_city, ''),
  recipient_state = COALESCE(recipient_state, ''),
  recipient_zip = COALESCE(recipient_zip, ''),
  date_of_birth = COALESCE(date_of_birth, '1900-01-01'::date)
WHERE 
  recipient_phone IS NULL OR
  recipient_email IS NULL OR 
  recipient_address IS NULL OR
  recipient_city IS NULL OR
  recipient_state IS NULL OR
  recipient_zip IS NULL OR
  date_of_birth IS NULL;

-- Update existing care_group_members to have default relationship
UPDATE public.care_group_members 
SET relationship_to_recipient = 'Other'
WHERE relationship_to_recipient IS NULL;

-- Now make required fields NOT NULL for care groups
ALTER TABLE public.care_groups 
ALTER COLUMN name SET NOT NULL,
ALTER COLUMN recipient_first_name SET NOT NULL,
ALTER COLUMN recipient_phone SET NOT NULL,
ALTER COLUMN recipient_email SET NOT NULL,
ALTER COLUMN date_of_birth SET NOT NULL,
ALTER COLUMN recipient_address SET NOT NULL,
ALTER COLUMN recipient_city SET NOT NULL,
ALTER COLUMN recipient_state SET NOT NULL,
ALTER COLUMN recipient_zip SET NOT NULL;

-- Make relationship_to_recipient required in care_group_members
ALTER TABLE public.care_group_members 
ALTER COLUMN relationship_to_recipient SET NOT NULL;