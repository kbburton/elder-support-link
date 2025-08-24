-- Create documents storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for documents storage bucket
CREATE POLICY "Users can view documents from their groups"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND 
  EXISTS (
    SELECT 1 FROM documents d
    INNER JOIN care_group_members cgm ON d.group_id = cgm.group_id
    WHERE d.file_url = name AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert documents to their groups"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update documents from their groups"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND 
  EXISTS (
    SELECT 1 FROM documents d
    INNER JOIN care_group_members cgm ON d.group_id = cgm.group_id
    WHERE d.file_url = name AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete documents from their groups"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND 
  EXISTS (
    SELECT 1 FROM documents d
    INNER JOIN care_group_members cgm ON d.group_id = cgm.group_id
    WHERE d.file_url = name AND cgm.user_id = auth.uid()
  )
);