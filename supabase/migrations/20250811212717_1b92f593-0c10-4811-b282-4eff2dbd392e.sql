-- Fix infinite recursion in RLS policies by creating security definer functions
-- and removing circular references in care_group_members table

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Group members can view care group members" ON care_group_members;
DROP POLICY IF EXISTS "Group members can manage care group members" ON care_group_members;

-- Create a security definer function to check if user is member of a group
CREATE OR REPLACE FUNCTION public.is_user_member_of_group(group_uuid uuid)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM care_group_members 
    WHERE group_id = group_uuid 
    AND user_id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create new policies for care_group_members using the security definer function
CREATE POLICY "Users can view group members where they are members"
ON care_group_members FOR SELECT
USING (public.is_user_member_of_group(group_id));

CREATE POLICY "Users can manage group members where they are members"
ON care_group_members FOR ALL
USING (public.is_user_member_of_group(group_id))
WITH CHECK (public.is_user_member_of_group(group_id));

-- Also update other policies to use this function for consistency
DROP POLICY IF EXISTS "Group members can view care groups" ON care_groups;
DROP POLICY IF EXISTS "Group members can manage care groups" ON care_groups;

CREATE POLICY "Members can view their care groups"
ON care_groups FOR SELECT
USING (public.is_user_member_of_group(id));

CREATE POLICY "Members can manage their care groups"
ON care_groups FOR ALL
USING (public.is_user_member_of_group(id))
WITH CHECK (public.is_user_member_of_group(id));

-- Update other table policies to use the security definer function
DROP POLICY IF EXISTS "Group members can view tasks" ON tasks;
DROP POLICY IF EXISTS "Group members can manage tasks" ON tasks;

CREATE POLICY "Members can view group tasks"
ON tasks FOR SELECT
USING (public.is_user_member_of_group(group_id));

CREATE POLICY "Members can manage group tasks"
ON tasks FOR ALL
USING (public.is_user_member_of_group(group_id))
WITH CHECK (public.is_user_member_of_group(group_id));

-- Update appointments policies
DROP POLICY IF EXISTS "Group members can view appointments" ON appointments;
DROP POLICY IF EXISTS "Group members can manage appointments" ON appointments;

CREATE POLICY "Members can view group appointments"
ON appointments FOR SELECT
USING (public.is_user_member_of_group(group_id));

CREATE POLICY "Members can manage group appointments"
ON appointments FOR ALL
USING (public.is_user_member_of_group(group_id))
WITH CHECK (public.is_user_member_of_group(group_id));

-- Update documents policies
DROP POLICY IF EXISTS "Group members can view documents" ON documents;
DROP POLICY IF EXISTS "Group members can manage documents" ON documents;

CREATE POLICY "Members can view group documents"
ON documents FOR SELECT
USING (public.is_user_member_of_group(group_id));

CREATE POLICY "Members can manage group documents"
ON documents FOR ALL
USING (public.is_user_member_of_group(group_id))
WITH CHECK (public.is_user_member_of_group(group_id));

-- Update activity_logs policies
DROP POLICY IF EXISTS "Group members can view activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Group members can manage activity logs" ON activity_logs;

CREATE POLICY "Members can view group activity logs"
ON activity_logs FOR SELECT
USING (public.is_user_member_of_group(group_id));

CREATE POLICY "Members can manage group activity logs"
ON activity_logs FOR ALL
USING (public.is_user_member_of_group(group_id))
WITH CHECK (public.is_user_member_of_group(group_id));