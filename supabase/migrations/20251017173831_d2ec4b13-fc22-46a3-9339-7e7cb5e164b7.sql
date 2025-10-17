-- Normalize existing phone numbers in memory_interviews table
-- This ensures they match the format expected by the webhook (digits and + only)

-- Update recipient_phone by removing all non-digit characters except +
UPDATE public.memory_interviews
SET recipient_phone = regexp_replace(recipient_phone, '[^\d+]', '', 'g')
WHERE recipient_phone IS NOT NULL
  AND recipient_phone ~ '[^\d+]'; -- Only update if contains non-digit/non-+ chars

-- Also normalize phone_number for consistency
UPDATE public.memory_interviews
SET phone_number = regexp_replace(phone_number, '[^\d+]', '', 'g')
WHERE phone_number ~ '[^\d+]'; -- Only update if contains non-digit/non-+ chars

-- Add comment explaining the normalization
COMMENT ON COLUMN public.memory_interviews.recipient_phone IS 'Phone number normalized to E.164 format (digits and + only) for webhook matching';