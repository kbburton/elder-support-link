-- Add missing fields to tasks table
ALTER TABLE public.tasks 
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN completed_by_user_id UUID,
ADD COLUMN completed_by_email TEXT,
ADD COLUMN created_by_email TEXT;

-- Update status enum to include in-progress
ALTER TABLE public.tasks 
ALTER COLUMN status SET DEFAULT 'open',
ADD CONSTRAINT tasks_status_check CHECK (status IN ('open', 'in_progress', 'completed'));

-- Create task_updates table for comments/updates
CREATE TABLE public.task_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task_documents linking table
CREATE TABLE public.task_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  document_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_user_id UUID,
  UNIQUE(task_id, document_id)
);

-- Enable RLS on new tables
ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for task_updates
CREATE POLICY "Group members can view task updates" 
ON public.task_updates 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM tasks t 
  JOIN care_group_members cgm ON cgm.group_id = t.group_id 
  WHERE t.id = task_updates.task_id AND cgm.user_id = auth.uid()
));

CREATE POLICY "Group members can create task updates" 
ON public.task_updates 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM tasks t 
  JOIN care_group_members cgm ON cgm.group_id = t.group_id 
  WHERE t.id = task_updates.task_id AND cgm.user_id = auth.uid()
) AND auth.uid() = user_id);

CREATE POLICY "Users can update their own task updates" 
ON public.task_updates 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task updates" 
ON public.task_updates 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for task_documents
CREATE POLICY "Group members can view task documents" 
ON public.task_documents 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM tasks t 
  JOIN care_group_members cgm ON cgm.group_id = t.group_id 
  WHERE t.id = task_documents.task_id AND cgm.user_id = auth.uid()
));

CREATE POLICY "Group members can manage task documents" 
ON public.task_documents 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM tasks t 
  JOIN care_group_members cgm ON cgm.group_id = t.group_id 
  WHERE t.id = task_documents.task_id AND cgm.user_id = auth.uid()
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM tasks t 
  JOIN care_group_members cgm ON cgm.group_id = t.group_id 
  WHERE t.id = task_documents.task_id AND cgm.user_id = auth.uid()
));

-- Add RLS policies for tasks table
CREATE POLICY "Group members can view tasks" 
ON public.tasks 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = tasks.group_id AND cgm.user_id = auth.uid()
));

CREATE POLICY "Group members can manage tasks" 
ON public.tasks 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = tasks.group_id AND cgm.user_id = auth.uid()
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM care_group_members cgm 
  WHERE cgm.group_id = tasks.group_id AND cgm.user_id = auth.uid()
));

-- Create trigger for updated_at on task_updates
CREATE TRIGGER update_task_updates_updated_at
BEFORE UPDATE ON public.task_updates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();