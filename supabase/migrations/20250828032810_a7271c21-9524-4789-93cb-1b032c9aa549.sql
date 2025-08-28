-- Make required fields NOT NULL for care groups
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