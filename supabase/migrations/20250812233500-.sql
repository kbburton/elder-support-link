-- Add email field to care_groups table
ALTER TABLE public.care_groups 
ADD COLUMN recipient_email TEXT;