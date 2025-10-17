-- Create memory interviews table
CREATE TABLE public.memory_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_group_id UUID NOT NULL REFERENCES public.care_groups(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'failed', 'cancelled')),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  phone_number TEXT NOT NULL,
  interview_type TEXT NOT NULL DEFAULT 'one_time' CHECK (interview_type IN ('one_time', 'recurring')),
  recurring_frequency TEXT CHECK (recurring_frequency IN ('weekly', 'biweekly', 'monthly') OR recurring_frequency IS NULL),
  recurring_total_count INTEGER CHECK (recurring_total_count > 0 OR recurring_total_count IS NULL),
  recurring_completed_count INTEGER DEFAULT 0,
  selected_question_id UUID,
  custom_instructions TEXT,
  is_test BOOLEAN DEFAULT false,
  twilio_call_sid TEXT,
  duration_seconds INTEGER,
  failure_reason TEXT,
  voicemail_detected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create memory stories table
CREATE TABLE public.memory_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.memory_interviews(id) ON DELETE CASCADE,
  care_group_id UUID NOT NULL REFERENCES public.care_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  story_text TEXT NOT NULL,
  memory_facts JSONB,
  audio_url TEXT,
  transcript_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'published')),
  reviewed_by_user_id UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  flagged_content JSONB,
  pii_redacted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create memory story versions table (for edit history)
CREATE TABLE public.memory_story_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.memory_stories(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  story_text TEXT NOT NULL,
  edited_by_user_id UUID NOT NULL,
  edit_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(story_id, version_number)
);

-- Create interview questions table
CREATE TABLE public.interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('childhood_family', 'life_milestones', 'relationships_love', 'career_achievements', 'challenges_resilience', 'legacy_wisdom')),
  question_text TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create interview question usage tracking table
CREATE TABLE public.interview_question_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_group_id UUID NOT NULL REFERENCES public.care_groups(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.interview_questions(id) ON DELETE CASCADE,
  interview_id UUID NOT NULL REFERENCES public.memory_interviews(id) ON DELETE CASCADE,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(care_group_id, question_id, interview_id)
);

-- Create indexes for performance
CREATE INDEX idx_memory_interviews_care_group ON public.memory_interviews(care_group_id);
CREATE INDEX idx_memory_interviews_status ON public.memory_interviews(status);
CREATE INDEX idx_memory_interviews_scheduled_at ON public.memory_interviews(scheduled_at);
CREATE INDEX idx_memory_stories_care_group ON public.memory_stories(care_group_id);
CREATE INDEX idx_memory_stories_status ON public.memory_stories(status);
CREATE INDEX idx_memory_stories_interview ON public.memory_stories(interview_id);
CREATE INDEX idx_question_usage_care_group ON public.interview_question_usage(care_group_id);

-- Enable RLS
ALTER TABLE public.memory_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_story_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_question_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for memory_interviews
CREATE POLICY "Members can view group interviews"
  ON public.memory_interviews FOR SELECT
  USING (is_user_member_of_group(care_group_id));

CREATE POLICY "Members can create group interviews"
  ON public.memory_interviews FOR INSERT
  WITH CHECK (is_user_member_of_group(care_group_id) AND created_by_user_id = auth.uid());

CREATE POLICY "Members can update group interviews"
  ON public.memory_interviews FOR UPDATE
  USING (is_user_member_of_group(care_group_id));

CREATE POLICY "Service role can manage interviews"
  ON public.memory_interviews FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for memory_stories
CREATE POLICY "Members can view group stories"
  ON public.memory_stories FOR SELECT
  USING (is_user_member_of_group(care_group_id));

CREATE POLICY "Admins can update group stories"
  ON public.memory_stories FOR UPDATE
  USING (is_user_admin_of_group(care_group_id));

CREATE POLICY "Service role can manage stories"
  ON public.memory_stories FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for memory_story_versions
CREATE POLICY "Members can view story versions"
  ON public.memory_story_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memory_stories ms
    WHERE ms.id = memory_story_versions.story_id
    AND is_user_member_of_group(ms.care_group_id)
  ));

CREATE POLICY "Admins can create story versions"
  ON public.memory_story_versions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.memory_stories ms
    WHERE ms.id = memory_story_versions.story_id
    AND is_user_admin_of_group(ms.care_group_id)
  ) AND edited_by_user_id = auth.uid());

-- RLS Policies for interview_questions
CREATE POLICY "Authenticated users can view questions"
  ON public.interview_questions FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Service role can manage questions"
  ON public.interview_questions FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for interview_question_usage
CREATE POLICY "Members can view question usage"
  ON public.interview_question_usage FOR SELECT
  USING (is_user_member_of_group(care_group_id));

CREATE POLICY "Service role can manage question usage"
  ON public.interview_question_usage FOR ALL
  USING (auth.role() = 'service_role');

-- Seed interview questions (30 questions across 6 categories)
INSERT INTO public.interview_questions (category, question_text, display_order) VALUES
  -- Childhood & Family Origins (5 questions)
  ('childhood_family', 'What are your earliest childhood memories?', 1),
  ('childhood_family', 'Tell me about your parents and what they were like.', 2),
  ('childhood_family', 'What was your childhood home like? Can you describe it?', 3),
  ('childhood_family', 'What family traditions did you have growing up?', 4),
  ('childhood_family', 'Who was the most influential person in your childhood and why?', 5),
  
  -- Life Milestones & Transitions (5 questions)
  ('life_milestones', 'What was your first job and what did you learn from it?', 6),
  ('life_milestones', 'Tell me about a time when you moved to a new place. What was that like?', 7),
  ('life_milestones', 'What was the most important decision you ever made?', 8),
  ('life_milestones', 'Describe a moment when you felt truly proud of yourself.', 9),
  ('life_milestones', 'What was the biggest adventure you ever had?', 10),
  
  -- Relationships & Love (5 questions)
  ('relationships_love', 'How did you meet your spouse or significant other?', 11),
  ('relationships_love', 'Tell me about your closest friendship. How did it begin?', 12),
  ('relationships_love', 'What did you learn about love from your parents or grandparents?', 13),
  ('relationships_love', 'Describe a moment when someone showed you unexpected kindness.', 14),
  ('relationships_love', 'What does family mean to you?', 15),
  
  -- Career & Achievements (5 questions)
  ('career_achievements', 'What work are you most proud of in your career?', 16),
  ('career_achievements', 'Tell me about a challenge you overcame at work.', 17),
  ('career_achievements', 'What skills or talents did you develop over your lifetime?', 18),
  ('career_achievements', 'Who was a mentor or role model in your professional life?', 19),
  ('career_achievements', 'If you could describe your life''s work in one sentence, what would it be?', 20),
  
  -- Challenges & Resilience (5 questions)
  ('challenges_resilience', 'Tell me about a difficult time in your life and how you got through it.', 21),
  ('challenges_resilience', 'What gave you strength during hard times?', 22),
  ('challenges_resilience', 'Describe a mistake you made and what you learned from it.', 23),
  ('challenges_resilience', 'How did you cope with loss or grief?', 24),
  ('challenges_resilience', 'What would you tell your younger self about facing challenges?', 25),
  
  -- Legacy & Wisdom (5 questions)
  ('legacy_wisdom', 'What do you hope people will remember about you?', 26),
  ('legacy_wisdom', 'What advice would you give to future generations?', 27),
  ('legacy_wisdom', 'What are you most grateful for in your life?', 28),
  ('legacy_wisdom', 'If you could leave one message for your family, what would it be?', 29),
  ('legacy_wisdom', 'What brings you the most joy in life?', 30);

-- Create storage buckets for audio and transcripts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('memory-interview-audio', 'memory-interview-audio', false, 524288000, ARRAY['audio/mpeg', 'audio/wav', 'audio/webm']),
  ('memory-interview-transcripts', 'memory-interview-transcripts', false, 10485760, ARRAY['text/plain', 'application/json'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for audio
CREATE POLICY "Members can view group audio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'memory-interview-audio' 
    AND EXISTS (
      SELECT 1 FROM public.memory_stories ms
      WHERE ms.audio_url = storage.objects.name
      AND is_user_member_of_group(ms.care_group_id)
    )
  );

CREATE POLICY "Service role can manage audio"
  ON storage.objects FOR ALL
  USING (bucket_id = 'memory-interview-audio' AND auth.role() = 'service_role');

-- Storage policies for transcripts
CREATE POLICY "Members can view group transcripts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'memory-interview-transcripts'
    AND EXISTS (
      SELECT 1 FROM public.memory_stories ms
      WHERE ms.transcript_url = storage.objects.name
      AND is_user_member_of_group(ms.care_group_id)
    )
  );

CREATE POLICY "Service role can manage transcripts"
  ON storage.objects FOR ALL
  USING (bucket_id = 'memory-interview-transcripts' AND auth.role() = 'service_role');