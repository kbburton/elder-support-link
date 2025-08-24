-- Drop and recreate the function to fix parameter naming issue
DROP FUNCTION IF EXISTS public.can_access_group(uuid);

CREATE OR REPLACE FUNCTION public.can_access_group(target_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.care_group_members 
    WHERE group_id = target_group_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure RLS is enabled and policies are correct
ALTER TABLE public.allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "allergies_select" ON public.allergies;
DROP POLICY IF EXISTS "allergies_write" ON public.allergies;
DROP POLICY IF EXISTS "preferences_select" ON public.preferences;
DROP POLICY IF EXISTS "preferences_write" ON public.preferences;

CREATE POLICY "allergies_select" ON public.allergies
  FOR SELECT USING (can_access_group(care_group_id));

CREATE POLICY "allergies_write" ON public.allergies
  FOR ALL USING (can_access_group(care_group_id))
  WITH CHECK (can_access_group(care_group_id));

CREATE POLICY "preferences_select" ON public.preferences
  FOR SELECT USING (can_access_group(care_group_id));

CREATE POLICY "preferences_write" ON public.preferences
  FOR ALL USING (can_access_group(care_group_id))
  WITH CHECK (can_access_group(care_group_id));