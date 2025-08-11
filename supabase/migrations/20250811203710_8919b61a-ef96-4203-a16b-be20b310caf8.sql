-- Add created_by_email column to appointments for displaying creator email
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS created_by_email text;