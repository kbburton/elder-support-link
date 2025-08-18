-- Fix RLS policies that are blocking soft delete operations

-- Drop the conflicting policy that prevents setting is_deleted = true
DROP POLICY IF EXISTS "Members manage (not deleted)" ON public.appointments;

-- Create separate policies for different operations to avoid conflicts
CREATE POLICY "Members can insert appointments" 
ON public.appointments 
FOR INSERT 
WITH CHECK (is_user_member_of_group(group_id) AND is_deleted = false);

CREATE POLICY "Members can update appointments" 
ON public.appointments 
FOR UPDATE 
USING (is_user_member_of_group(group_id));

CREATE POLICY "Members can view non-deleted appointments" 
ON public.appointments 
FOR SELECT 
USING (is_user_member_of_group(group_id) AND is_deleted = false);

-- Also fix similar issues for other entity types

-- Fix contacts policies
DROP POLICY IF EXISTS "Members manage (not deleted)" ON public.contacts;

CREATE POLICY "Members can insert contacts" 
ON public.contacts 
FOR INSERT 
WITH CHECK (is_user_member_of_group(care_group_id) AND is_deleted = false);

CREATE POLICY "Members can update contacts" 
ON public.contacts 
FOR UPDATE 
USING (is_user_member_of_group(care_group_id));

-- Fix tasks policies  
DROP POLICY IF EXISTS "Members manage (not deleted)" ON public.tasks;

CREATE POLICY "Members can insert tasks" 
ON public.tasks 
FOR INSERT 
WITH CHECK (is_user_member_of_group(group_id) AND is_deleted = false);

CREATE POLICY "Members can update tasks" 
ON public.tasks 
FOR UPDATE 
USING (is_user_member_of_group(group_id));

-- Fix activity_logs policies
DROP POLICY IF EXISTS "Members manage (not deleted)" ON public.activity_logs;

CREATE POLICY "Members can insert activities" 
ON public.activity_logs 
FOR INSERT 
WITH CHECK (is_user_member_of_group(group_id) AND is_deleted = false);

CREATE POLICY "Members can update activities" 
ON public.activity_logs 
FOR UPDATE 
USING (is_user_member_of_group(group_id));

-- Fix documents policies
DROP POLICY IF EXISTS "Members manage (not deleted)" ON public.documents;

CREATE POLICY "Members can insert documents" 
ON public.documents 
FOR INSERT 
WITH CHECK (is_user_member_of_group(group_id) AND is_deleted = false);

CREATE POLICY "Members can update documents" 
ON public.documents 
FOR UPDATE 
USING (is_user_member_of_group(group_id));