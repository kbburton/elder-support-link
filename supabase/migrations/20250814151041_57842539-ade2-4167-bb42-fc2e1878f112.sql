-- Fix demo_sessions security issue: Remove public access to email addresses
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Demo sessions are publicly accessible" ON public.demo_sessions;

-- Create more restrictive policies that protect email addresses
-- Only allow service role (edge functions) to manage demo sessions
CREATE POLICY "Service role can manage demo sessions" 
ON public.demo_sessions 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Users cannot directly access demo session data
-- All demo session management goes through edge functions
-- This protects email addresses from being harvested by malicious users