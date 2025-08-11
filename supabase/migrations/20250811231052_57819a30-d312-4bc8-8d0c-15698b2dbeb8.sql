-- Create document_links table for linking documents to tasks and appointments
CREATE TABLE public.document_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  linked_item_id UUID NOT NULL,
  linked_item_type TEXT NOT NULL CHECK (linked_item_type IN ('task', 'appointment')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(document_id, linked_item_id, linked_item_type)
);

-- Enable RLS
ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

-- Create policies for document_links
CREATE POLICY "Users can view document links in their groups" 
ON public.document_links 
FOR SELECT 
USING (
  -- Check if user has access to the document
  EXISTS (
    SELECT 1 FROM public.documents d 
    WHERE d.id = document_links.document_id 
    AND public.is_user_member_of_group(d.group_id)
  )
);

CREATE POLICY "Users can create document links in their groups" 
ON public.document_links 
FOR INSERT 
WITH CHECK (
  -- Check if user has access to the document
  EXISTS (
    SELECT 1 FROM public.documents d 
    WHERE d.id = document_links.document_id 
    AND public.is_user_member_of_group(d.group_id)
  )
);

CREATE POLICY "Users can delete document links in their groups" 
ON public.document_links 
FOR DELETE 
USING (
  -- Check if user has access to the document
  EXISTS (
    SELECT 1 FROM public.documents d 
    WHERE d.id = document_links.document_id 
    AND public.is_user_member_of_group(d.group_id)
  )
);

-- Create index for better performance
CREATE INDEX idx_document_links_item ON public.document_links(linked_item_id, linked_item_type);
CREATE INDEX idx_document_links_document ON public.document_links(document_id);