-- Create documents_v2 table (completely separate from old documents)
CREATE TABLE IF NOT EXISTS public.documents_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.care_groups(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL,
  uploaded_by_email TEXT,
  
  -- File information
  title TEXT,
  original_filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  
  -- Categorization
  category_id UUID REFERENCES public.document_categories(id) ON DELETE SET NULL,
  
  -- AI-generated content (using Lovable Cloud AI)
  full_text TEXT,
  summary TEXT,
  ai_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Processing
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error TEXT,
  
  -- Sharing
  is_shared_with_group BOOLEAN DEFAULT true,
  
  -- Soft delete
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by_user_id UUID,
  deleted_by_email TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.documents_v2 ENABLE ROW LEVEL SECURITY;

-- RLS Policies for documents_v2
CREATE POLICY "Members can view shared documents or their own"
ON public.documents_v2
FOR SELECT
USING (
  is_deleted = false AND
  (
    (is_shared_with_group = true AND is_user_member_of_group(group_id)) OR
    (uploaded_by_user_id = auth.uid())
  )
);

CREATE POLICY "Members can insert documents"
ON public.documents_v2
FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by_user_id AND
  is_user_member_of_group(group_id) AND
  is_deleted = false
);

CREATE POLICY "Document owners and admins can update"
ON public.documents_v2
FOR UPDATE
USING (
  (uploaded_by_user_id = auth.uid() OR is_user_admin_of_group(group_id)) AND
  is_deleted = false
);

CREATE POLICY "Admins can view deleted documents"
ON public.documents_v2
FOR SELECT
USING (
  is_deleted = true AND
  is_user_admin_of_group(group_id)
);

-- Indexes for performance
CREATE INDEX idx_documents_v2_group_id ON public.documents_v2(group_id) WHERE is_deleted = false;
CREATE INDEX idx_documents_v2_uploaded_by ON public.documents_v2(uploaded_by_user_id) WHERE is_deleted = false;
CREATE INDEX idx_documents_v2_category ON public.documents_v2(category_id) WHERE is_deleted = false;
CREATE INDEX idx_documents_v2_processing_status ON public.documents_v2(processing_status) WHERE processing_status != 'completed';

-- Trigger to update updated_at
CREATE TRIGGER update_documents_v2_updated_at
  BEFORE UPDATE ON public.documents_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update document_versions to support documents_v2
ALTER TABLE public.document_versions 
ADD COLUMN IF NOT EXISTS document_v2_id UUID REFERENCES public.documents_v2(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_document_versions_v2 ON public.document_versions(document_v2_id);

-- Update document_tag_assignments to support documents_v2
ALTER TABLE public.document_tag_assignments
ADD COLUMN IF NOT EXISTS document_v2_id UUID REFERENCES public.documents_v2(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_document_tag_assignments_v2 ON public.document_tag_assignments(document_v2_id);