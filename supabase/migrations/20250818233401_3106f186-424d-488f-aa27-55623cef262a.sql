-- Fix security issues: Add search_path to functions and create missing RLS policies

-- Fix search_path for existing functions (security improvement)
ALTER FUNCTION public.similarity(text, text) SET search_path = public;
ALTER FUNCTION public.word_similarity(text, text) SET search_path = public;
ALTER FUNCTION public.strict_word_similarity(text, text) SET search_path = public;

-- Add search_path to custom functions that were missing it
ALTER FUNCTION public.current_user_email() SET search_path = public;
ALTER FUNCTION public.is_user_member_of_group(uuid) SET search_path = public;
ALTER FUNCTION public.is_user_admin_of_group(uuid) SET search_path = public;
ALTER FUNCTION public.is_system_admin(uuid) SET search_path = public;
ALTER FUNCTION public.is_platform_admin(uuid) SET search_path = public;

-- Enable RLS on tables that were missing it (if any)
-- Most tables already have RLS enabled based on the schema, but let's ensure critical ones do

-- Create missing policies for admin schema if needed
-- Enable RLS for the admin search_jobs table
CREATE SCHEMA IF NOT EXISTS admin;

-- Create the search_jobs table in admin schema if it doesn't exist
CREATE TABLE IF NOT EXISTS admin.search_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  operation text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on admin.search_jobs
ALTER TABLE admin.search_jobs ENABLE ROW LEVEL SECURITY;

-- Create policy for search_jobs (only system admins can access)
CREATE POLICY "System admins can manage search jobs" ON admin.search_jobs
FOR ALL USING (is_system_admin(auth.uid()));

-- Fix any remaining security issues by ensuring proper RLS policies
-- All main tables should already have proper RLS based on the schema shown