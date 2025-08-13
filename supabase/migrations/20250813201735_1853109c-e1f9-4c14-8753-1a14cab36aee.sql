-- Fix RLS issue for app_settings table
-- Since this table is only accessed by Edge Functions with service role,
-- we enable RLS but don't add any policies (service role bypasses RLS)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;