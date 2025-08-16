-- Fix RLS policy for care_groups table to allow creation of new groups
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Members can manage their care groups" ON public.care_groups;

-- Create separate policies for different operations
-- Allow authenticated users to create new care groups
CREATE POLICY "Users can create care groups" 
ON public.care_groups 
FOR INSERT 
WITH CHECK (auth.uid() = created_by_user_id);

-- Allow members to view their care groups
CREATE POLICY "Members can view their care groups" 
ON public.care_groups 
FOR SELECT 
USING (is_user_member_of_group(id));

-- Allow members to update their care groups
CREATE POLICY "Members can update their care groups" 
ON public.care_groups 
FOR UPDATE 
USING (is_user_member_of_group(id))
WITH CHECK (is_user_member_of_group(id));

-- Allow group admins to delete care groups
CREATE POLICY "Admins can delete care groups" 
ON public.care_groups 
FOR DELETE 
USING (is_user_admin_of_group(id));