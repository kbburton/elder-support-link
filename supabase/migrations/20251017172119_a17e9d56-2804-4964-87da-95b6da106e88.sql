-- Add recipient_phone column to memory_interviews table
ALTER TABLE public.memory_interviews 
ADD COLUMN IF NOT EXISTS recipient_phone text;

-- Add index for faster phone number lookups
CREATE INDEX IF NOT EXISTS idx_memory_interviews_recipient_phone 
ON public.memory_interviews(recipient_phone);

-- Add comment explaining the column
COMMENT ON COLUMN public.memory_interviews.recipient_phone IS 'Phone number for webhook matching and routing';