-- Create story_generation_prompts table
CREATE TABLE public.story_generation_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL UNIQUE,
  prompt_text TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for default lookup
CREATE INDEX idx_story_prompts_default ON public.story_generation_prompts(is_default);

-- Enable RLS
ALTER TABLE public.story_generation_prompts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view prompts
CREATE POLICY "Authenticated users can view story prompts"
  ON public.story_generation_prompts
  FOR SELECT
  TO authenticated
  USING (true);

-- Only system admins can insert prompts
CREATE POLICY "System admins can insert story prompts"
  ON public.story_generation_prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));

-- Only system admins can update prompts
CREATE POLICY "System admins can update story prompts"
  ON public.story_generation_prompts
  FOR UPDATE
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- Only system admins can delete prompts
CREATE POLICY "System admins can delete story prompts"
  ON public.story_generation_prompts
  FOR DELETE
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- Add tracking columns to memory_stories
ALTER TABLE public.memory_stories 
  ADD COLUMN prompt_id UUID REFERENCES public.story_generation_prompts(id) ON DELETE SET NULL,
  ADD COLUMN prompt_text_used TEXT;

-- Add tracking to memory_story_versions
ALTER TABLE public.memory_story_versions
  ADD COLUMN prompt_id UUID REFERENCES public.story_generation_prompts(id) ON DELETE SET NULL,
  ADD COLUMN prompt_text_used TEXT;

-- Add prompt selection to memory_interviews
ALTER TABLE public.memory_interviews 
  ADD COLUMN prompt_id UUID REFERENCES public.story_generation_prompts(id) ON DELETE SET NULL;

-- Insert default prompt
INSERT INTO public.story_generation_prompts (title, prompt_text, is_default, created_by_user_id)
VALUES (
  'Warm Family Biography (Default)',
  'You are a factual family biographer who writes short third-person vignettes about a person''s life based on interview transcripts with an AI interviewer.

Your job:
- Write an engaging short story that feels human, warm, and vivid but always grounded in facts stated or logically inferred from the transcript.
- You may infer timing and context (e.g., if he was six in 1942, mention wartime life), but you must not invent fictional people, dialogue, or events.
- Treat each story as part of a larger biography but make it self-contained.
- Never begin with birth details unless relevant to that vignette.
- Maintain a consistent, respectful tone suitable for a family storybook.
- If details are missing, write naturally around the gaps rather than fabricating content.
- The narrator''s voice is third-person.

Return your response as a JSON object with this structure:
{
  "title": "A short, evocative title for the story",
  "story": "The complete story text",
  "memory_facts": ["fact1", "fact2", "fact3"]
}',
  true,
  NULL
);

-- Create trigger to ensure only one default prompt
CREATE OR REPLACE FUNCTION ensure_single_default_prompt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.story_generation_prompts
    SET is_default = false
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_prompt
  AFTER INSERT OR UPDATE ON public.story_generation_prompts
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_prompt();