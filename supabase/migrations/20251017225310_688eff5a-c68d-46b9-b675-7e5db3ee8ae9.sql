-- Add raw_transcript column to memory_interviews table
ALTER TABLE public.memory_interviews 
ADD COLUMN IF NOT EXISTS raw_transcript TEXT;