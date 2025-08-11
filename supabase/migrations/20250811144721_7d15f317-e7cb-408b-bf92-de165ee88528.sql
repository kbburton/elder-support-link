-- Add recipient location and DOB fields to care_groups
ALTER TABLE public.care_groups
  ADD COLUMN IF NOT EXISTS recipient_city text,
  ADD COLUMN IF NOT EXISTS recipient_state text,
  ADD COLUMN IF NOT EXISTS recipient_zip text,
  ADD COLUMN IF NOT EXISTS date_of_birth date;