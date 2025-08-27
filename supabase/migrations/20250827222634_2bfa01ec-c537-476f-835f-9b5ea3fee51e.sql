-- Add index for efficient duplicate filename detection within care groups
CREATE INDEX CONCURRENTLY idx_documents_filename_group_detection 
ON public.documents (group_id, original_filename);