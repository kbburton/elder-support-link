-- Fix failing inserts due to invalid FK to public.users
-- Drop the foreign key constraint on appointments.created_by_user_id that references public.users
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_created_by_user_id_fkey;

-- Note: We intentionally do not add a new FK right now to avoid blocking inserts
-- if a corresponding profile row does not exist yet. We can later migrate this
-- to reference public.profiles(user_id) after ensuring profiles are created for all users.