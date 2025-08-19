-- Update document_links constraint to allow activity_log for activities
ALTER TABLE public.document_links 
DROP CONSTRAINT IF EXISTS document_links_linked_item_type_check;

ALTER TABLE public.document_links 
ADD CONSTRAINT document_links_linked_item_type_check 
CHECK (linked_item_type = ANY (ARRAY['task'::text, 'appointment'::text, 'activity_log'::text]));