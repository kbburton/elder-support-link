-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Create RLS policies for document storage
CREATE POLICY "Group members can view documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'documents' AND 
  EXISTS (
    SELECT 1 FROM documents d 
    JOIN care_group_members cgm ON cgm.group_id = d.group_id 
    WHERE d.file_url LIKE '%' || name AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Group members can upload documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Group members can update documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'documents' AND 
  EXISTS (
    SELECT 1 FROM documents d 
    JOIN care_group_members cgm ON cgm.group_id = d.group_id 
    WHERE d.file_url LIKE '%' || name AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Group members can delete documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'documents' AND 
  EXISTS (
    SELECT 1 FROM documents d 
    JOIN care_group_members cgm ON cgm.group_id = d.group_id 
    WHERE d.file_url LIKE '%' || name AND cgm.user_id = auth.uid()
  )
);

-- Update documents table with new fields
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create document access logs table for audit trail
CREATE TABLE IF NOT EXISTS document_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'view', 'download'
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  group_id UUID NOT NULL
);

-- Enable RLS on document access logs
ALTER TABLE document_access_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for document access logs
CREATE POLICY "Group members can view access logs" 
ON document_access_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM care_group_members cgm 
    WHERE cgm.group_id = document_access_logs.group_id AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create access logs" 
ON document_access_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();