-- Add voice PIN and authentication fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS voice_pin TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_auth_attempts INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_lockout_until TIMESTAMP WITH TIME ZONE;