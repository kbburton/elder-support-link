-- Add audio_url column to memory_interviews table
ALTER TABLE public.memory_interviews 
ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Add audio_duration_seconds column if not exists (might already be there)
ALTER TABLE public.memory_interviews 
ADD COLUMN IF NOT EXISTS audio_duration_seconds INTEGER;

COMMENT ON COLUMN public.memory_interviews.audio_url IS 'Supabase Storage path for the call recording audio file';
COMMENT ON COLUMN public.memory_interviews.audio_duration_seconds IS 'Duration of the call recording in seconds';