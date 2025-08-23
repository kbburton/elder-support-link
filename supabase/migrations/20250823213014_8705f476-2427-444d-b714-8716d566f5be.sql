-- Create the generic picklist options table
CREATE TABLE public.picklist_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_type TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(list_type, value)
);

-- Enable RLS on the picklist options table
ALTER TABLE public.picklist_options ENABLE ROW LEVEL SECURITY;

-- Create policies for picklist options
CREATE POLICY "Anyone can view active picklist options"
ON public.picklist_options
FOR SELECT
USING (is_active = true);

CREATE POLICY "Platform admins can manage picklist options"
ON public.picklist_options
FOR ALL
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_picklist_options_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_picklist_options_updated_at
BEFORE UPDATE ON public.picklist_options
FOR EACH ROW
EXECUTE FUNCTION public.update_picklist_options_updated_at();

-- Insert living situation options
INSERT INTO public.picklist_options (list_type, value, label, sort_order) VALUES
('care_groups_living_situation', 'independent_living', 'Independent living', 1),
('care_groups_living_situation', 'assisted_living', 'Assisted living', 2),
('care_groups_living_situation', 'memory_care', 'Memory care', 3),
('care_groups_living_situation', 'nursing_home', 'Nursing home', 4),
('care_groups_living_situation', 'with_family', 'Living with family', 5),
('care_groups_living_situation', 'other', 'Other', 6);