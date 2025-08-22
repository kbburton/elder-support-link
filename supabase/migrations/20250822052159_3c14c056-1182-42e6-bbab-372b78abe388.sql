-- Remove the legacy users table (only has 1 row, no foreign keys)
DROP TABLE IF EXISTS public.users;

-- Remove the redundant email column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;