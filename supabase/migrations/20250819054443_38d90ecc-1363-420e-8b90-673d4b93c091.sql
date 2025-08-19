-- Create task_documents junction table following the uniform pattern
CREATE TABLE IF NOT EXISTS public.task_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(task_id, document_id)
);

-- Enable RLS
ALTER TABLE public.task_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for task_documents
CREATE POLICY "Group members can manage task documents" 
ON public.task_documents 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.care_group_members cgm ON cgm.group_id = t.group_id
    WHERE t.id = task_documents.task_id AND cgm.user_id = auth.uid()
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.care_group_members cgm ON cgm.group_id = t.group_id
    WHERE t.id = task_documents.task_id AND cgm.user_id = auth.uid()
  )
);

-- Update document_links constraint to allow activity_log for activities
ALTER TABLE public.document_links 
DROP CONSTRAINT IF EXISTS document_links_linked_item_type_check;

ALTER TABLE public.document_links 
ADD CONSTRAINT document_links_linked_item_type_check 
CHECK (linked_item_type = ANY (ARRAY['task'::text, 'appointment'::text, 'activity_log'::text]));

-- Create activity_documents table if it doesn't exist (for consistency)
CREATE TABLE IF NOT EXISTS public.activity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_log_id uuid NOT NULL REFERENCES public.activity_logs(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(activity_log_id, document_id)
);

-- Enable RLS for activity_documents
ALTER TABLE public.activity_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for activity_documents
CREATE POLICY "Group members can manage activity documents" 
ON public.activity_documents 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.activity_logs al
    JOIN public.care_group_members cgm ON cgm.group_id = al.group_id
    WHERE al.id = activity_documents.activity_log_id AND cgm.user_id = auth.uid()
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.activity_logs al
    JOIN public.care_group_members cgm ON cgm.group_id = al.group_id
    WHERE al.id = activity_documents.activity_log_id AND cgm.user_id = auth.uid()
  )
);