-- Create appointment_documents table to link appointments with documents
CREATE TABLE public.appointment_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL,
  document_id UUID NOT NULL,
  created_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(appointment_id, document_id)
);

-- Enable RLS on appointment_documents
ALTER TABLE public.appointment_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for appointment_documents
CREATE POLICY "Group members can view appointment documents" 
ON public.appointment_documents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM appointments a
    JOIN care_group_members cgm ON cgm.group_id = a.group_id
    WHERE a.id = appointment_documents.appointment_id 
    AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Group members can manage appointment documents" 
ON public.appointment_documents 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM appointments a
    JOIN care_group_members cgm ON cgm.group_id = a.group_id
    WHERE a.id = appointment_documents.appointment_id 
    AND cgm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM appointments a
    JOIN care_group_members cgm ON cgm.group_id = a.group_id
    WHERE a.id = appointment_documents.appointment_id 
    AND cgm.user_id = auth.uid()
  )
);