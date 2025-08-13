-- Fix infinite recursion in platform_admins RLS policy
-- The current policy creates infinite recursion when checking if a user is a platform admin
-- Remove RLS from platform_admins since it should only be accessed via:
-- 1. Edge functions (service role bypasses RLS)
-- 2. is_platform_admin() function (SECURITY DEFINER bypasses RLS)

-- Drop the problematic RLS policy
DROP POLICY IF EXISTS "Platform admins can manage platform_admins" ON platform_admins;

-- Disable RLS on platform_admins table
ALTER TABLE platform_admins DISABLE ROW LEVEL SECURITY;