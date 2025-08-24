-- Create allergies table if it doesn't exist (idempotent)
CREATE TABLE IF NOT EXISTS public.allergies (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  care_group_id UUID NOT NULL REFERENCES public.care_groups(id) ON DELETE CASCADE,
  allergen TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  severity TEXT NOT NULL DEFAULT 'mild',
  reaction TEXT,
  has_epipen BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create preferences table if it doesn't exist (idempotent)
CREATE TABLE IF NOT EXISTS public.preferences (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  care_group_id UUID NOT NULL REFERENCES public.care_groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'like',
  text_value TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  pinned BOOLEAN NOT NULL DEFAULT false,
  order_index SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE public.allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

-- Create helper function for checking group access (idempotent)
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

-- RLS policies for allergies
DROP POLICY IF EXISTS "allergies_select" ON public.allergies;
CREATE POLICY "allergies_select" ON public.allergies
  FOR SELECT USING (can_access_group(care_group_id));

DROP POLICY IF EXISTS "allergies_write" ON public.allergies;
CREATE POLICY "allergies_write" ON public.allergies
  FOR ALL USING (can_access_group(care_group_id))
  WITH CHECK (can_access_group(care_group_id));

-- RLS policies for preferences
DROP POLICY IF EXISTS "preferences_select" ON public.preferences;
CREATE POLICY "preferences_select" ON public.preferences
  FOR SELECT USING (can_access_group(care_group_id));

DROP POLICY IF EXISTS "preferences_write" ON public.preferences;
CREATE POLICY "preferences_write" ON public.preferences
  FOR ALL USING (can_access_group(care_group_id))
  WITH CHECK (can_access_group(care_group_id));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_allergies_care_group_id ON public.allergies(care_group_id);
CREATE INDEX IF NOT EXISTS idx_preferences_care_group_id ON public.preferences(care_group_id);
CREATE INDEX IF NOT EXISTS idx_preferences_pinned ON public.preferences(care_group_id, pinned) WHERE pinned = true;