-- Ensure first_name and last_name exist on profiles, and add updated_at trigger (idempotent)
-- 1) Add columns if missing
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- 2) Ensure updated_at column exists (some schemas include it already)
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3) Create or replace timestamp update function exists already in project
-- Skipping redefinition of public.update_updated_at_column()

-- 4) Drop and recreate trigger to avoid duplicates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    DROP TRIGGER update_profiles_updated_at ON public.profiles;
  END IF;
END $$;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();