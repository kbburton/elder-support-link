-- Fix the search path for the security definer function
CREATE OR REPLACE FUNCTION public.is_user_member_of_group(group_uuid uuid)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.care_group_members 
    WHERE group_id = group_uuid 
    AND user_id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = 'public';