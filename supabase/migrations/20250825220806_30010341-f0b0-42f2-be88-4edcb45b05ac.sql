-- Add last_login field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN last_login timestamp with time zone;

-- Create or replace function to sync last login from auth.users
CREATE OR REPLACE FUNCTION public.sync_user_last_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the profiles table with the latest last_sign_in_at from auth.users
  UPDATE public.profiles 
  SET last_login = NEW.last_sign_in_at
  WHERE user_id = NEW.id;
  
  -- If no profile exists, this won't create one (handled by existing trigger)
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to update profiles.last_login
DROP TRIGGER IF EXISTS on_auth_user_login_update ON auth.users;
CREATE TRIGGER on_auth_user_login_update
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW 
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.sync_user_last_login();

-- Migrate existing data: populate last_login from auth.users.last_sign_in_at
UPDATE public.profiles 
SET last_login = au.last_sign_in_at
FROM auth.users au
WHERE profiles.user_id = au.id
AND au.last_sign_in_at IS NOT NULL;