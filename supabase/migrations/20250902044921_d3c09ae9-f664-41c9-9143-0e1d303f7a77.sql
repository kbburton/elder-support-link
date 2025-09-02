-- Add voice PIN and authentication columns to care_groups table
ALTER TABLE public.care_groups 
ADD COLUMN voice_pin TEXT,
ADD COLUMN phone_auth_attempts INTEGER DEFAULT 0,
ADD COLUMN phone_lockout_until TIMESTAMP WITH TIME ZONE;

-- Create index for phone lookups
CREATE INDEX IF NOT EXISTS idx_care_groups_recipient_phone ON public.care_groups(recipient_phone);

-- Add comments for documentation
COMMENT ON COLUMN public.care_groups.voice_pin IS 'Hashed 4-digit PIN for voice authentication';
COMMENT ON COLUMN public.care_groups.phone_auth_attempts IS 'Number of failed PIN attempts for this phone number';
COMMENT ON COLUMN public.care_groups.phone_lockout_until IS 'Timestamp when phone lockout expires (24 hours after 4 failed attempts)';