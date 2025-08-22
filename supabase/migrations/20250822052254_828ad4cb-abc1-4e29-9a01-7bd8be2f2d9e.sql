-- First, drop the foreign key constraint that's blocking us
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_attending_user_id_fkey;

-- Remove the legacy users table 
DROP TABLE IF EXISTS public.users;

-- Remove the redundant email column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;