-- Create activity_documents table to link activities with documents
CREATE TABLE public.activity_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_log_id uuid NOT NULL,
  document_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by_user_id uuid
);

-- Enable RLS on activity_documents
ALTER TABLE public.activity_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for activity_documents
CREATE POLICY "Group members can view activity documents" 
ON public.activity_documents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM activity_logs al
    JOIN care_group_members cgm ON cgm.group_id = al.group_id
    WHERE al.id = activity_documents.activity_log_id 
    AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Group members can manage activity documents" 
ON public.activity_documents 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM activity_logs al
    JOIN care_group_members cgm ON cgm.group_id = al.group_id
    WHERE al.id = activity_documents.activity_log_id 
    AND cgm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activity_logs al
    JOIN care_group_members cgm ON cgm.group_id = al.group_id
    WHERE al.id = activity_documents.activity_log_id 
    AND cgm.user_id = auth.uid()
  )
);

-- Add unique constraint to prevent duplicate associations
ALTER TABLE public.activity_documents 
ADD CONSTRAINT unique_activity_document UNIQUE (activity_log_id, document_id);

-- Add validation trigger to ensure same care group
CREATE TRIGGER validate_activity_document_same_group
  BEFORE INSERT ON activity_documents
  FOR EACH ROW
  EXECUTE FUNCTION validate_contact_link_same_group();