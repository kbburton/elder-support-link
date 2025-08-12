-- Add missing columns to care_groups table for better recipient information
ALTER TABLE public.care_groups 
ADD COLUMN IF NOT EXISTS recipient_first_name text,
ADD COLUMN IF NOT EXISTS recipient_last_name text,
ADD COLUMN IF NOT EXISTS living_situation text;

-- Update existing groups to populate first/last name from existing name if available
UPDATE public.care_groups 
SET 
  recipient_first_name = SPLIT_PART(name, ' ', 1),
  recipient_last_name = CASE 
    WHEN ARRAY_LENGTH(string_to_array(name, ' '), 1) > 1 
    THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
    ELSE ''
  END
WHERE recipient_first_name IS NULL;