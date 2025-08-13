-- Drop the restrictive profile view policy
DROP POLICY IF EXISTS "Profiles are viewable by owner" ON public.profiles;

-- Create new policies that allow group members to see each other's profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Group members can view each other's profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM care_group_members cgm1
    JOIN care_group_members cgm2 ON cgm1.group_id = cgm2.group_id
    WHERE cgm1.user_id = auth.uid() 
    AND cgm2.user_id = profiles.user_id
  )
);