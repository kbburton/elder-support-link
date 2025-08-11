-- Enable RLS on all tables that don't have it yet
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.care_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies for tables that need them
-- Activity logs - group members can manage
CREATE POLICY "Group members can view activity logs" 
ON public.activity_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = activity_logs.group_id AND cgm.user_id = auth.uid()
));

CREATE POLICY "Group members can manage activity logs" 
ON public.activity_logs 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = activity_logs.group_id AND cgm.user_id = auth.uid()
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = activity_logs.group_id AND cgm.user_id = auth.uid()
));

-- Appointments - group members can manage
CREATE POLICY "Group members can view appointments" 
ON public.appointments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = appointments.group_id AND cgm.user_id = auth.uid()
));

CREATE POLICY "Group members can manage appointments" 
ON public.appointments 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = appointments.group_id AND cgm.user_id = auth.uid()
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = appointments.group_id AND cgm.user_id = auth.uid()
));

-- Care group members - group members can view, only existing members can add new ones
CREATE POLICY "Group members can view care group members" 
ON public.care_group_members 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = care_group_members.group_id AND cgm.user_id = auth.uid()
));

CREATE POLICY "Group members can manage care group members" 
ON public.care_group_members 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = care_group_members.group_id AND cgm.user_id = auth.uid()
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = care_group_members.group_id AND cgm.user_id = auth.uid()
));

-- Care groups - group members can view and edit
CREATE POLICY "Group members can view care groups" 
ON public.care_groups 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = care_groups.id AND cgm.user_id = auth.uid()
));

CREATE POLICY "Group members can manage care groups" 
ON public.care_groups 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = care_groups.id AND cgm.user_id = auth.uid()
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = care_groups.id AND cgm.user_id = auth.uid()
));

-- Documents - group members can manage
CREATE POLICY "Group members can view documents" 
ON public.documents 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = documents.group_id AND cgm.user_id = auth.uid()
));

CREATE POLICY "Group members can manage documents" 
ON public.documents 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = documents.group_id AND cgm.user_id = auth.uid()
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = documents.group_id AND cgm.user_id = auth.uid()
));

-- Users table - users can only see their own data
CREATE POLICY "Users can view their own profile" 
ON public.users 
FOR SELECT 
USING (auth.uid()::text = id::text);

CREATE POLICY "Users can manage their own profile" 
ON public.users 
FOR ALL 
USING (auth.uid()::text = id::text) 
WITH CHECK (auth.uid()::text = id::text);