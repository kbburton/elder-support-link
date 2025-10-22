-- Enable RLS and allow group members to view their memory stories
ALTER TABLE public.memory_stories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'memory_stories'
      AND policyname = 'Members can view memory stories'
  ) THEN
    CREATE POLICY "Members can view memory stories"
    ON public.memory_stories
    FOR SELECT
    USING (is_user_member_of_group(care_group_id));
  END IF;
END
$$;