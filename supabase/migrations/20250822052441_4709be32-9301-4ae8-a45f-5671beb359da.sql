-- Now we can safely remove the users table and profiles email column
DROP TABLE IF EXISTS public.users;

-- Remove the redundant email column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;