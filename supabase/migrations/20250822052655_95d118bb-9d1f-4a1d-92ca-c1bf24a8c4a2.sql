-- Force drop the constraint and table with CASCADE
DROP TABLE IF EXISTS public.users CASCADE;

-- Remove the redundant email column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;