-- Create document_notes table
CREATE TABLE IF NOT EXISTS public.document_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  care_group_id UUID,
  owner_user_id UUID,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_edited_by_user_id UUID,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_by_user_id UUID,
  locked_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT document_notes_context_check CHECK (
    (care_group_id IS NOT NULL AND owner_user_id IS NULL) OR 
    (care_group_id IS NULL AND owner_user_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.document_notes ENABLE ROW LEVEL SECURITY;

-- Index for performance
CREATE INDEX idx_document_notes_document_id ON public.document_notes(document_id);
CREATE INDEX idx_document_notes_care_group_id ON public.document_notes(care_group_id) WHERE care_group_id IS NOT NULL;
CREATE INDEX idx_document_notes_owner_user_id ON public.document_notes(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX idx_document_notes_updated_at ON public.document_notes(updated_at DESC);

-- RLS Policies for group notes (care_group_id is set)
CREATE POLICY "Group members can view group notes"
  ON public.document_notes
  FOR SELECT
  USING (
    care_group_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.care_group_members cgm
      WHERE cgm.group_id = document_notes.care_group_id
        AND cgm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create group notes"
  ON public.document_notes
  FOR INSERT
  WITH CHECK (
    care_group_id IS NOT NULL AND
    owner_user_id IS NULL AND
    created_by_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.care_group_members cgm
      WHERE cgm.group_id = document_notes.care_group_id
        AND cgm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can update group notes"
  ON public.document_notes
  FOR UPDATE
  USING (
    care_group_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.care_group_members cgm
      WHERE cgm.group_id = document_notes.care_group_id
        AND cgm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can delete group notes"
  ON public.document_notes
  FOR DELETE
  USING (
    care_group_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.care_group_members cgm
      WHERE cgm.group_id = document_notes.care_group_id
        AND cgm.user_id = auth.uid()
    )
  );

-- RLS Policies for personal notes (owner_user_id is set)
CREATE POLICY "Owners can view personal notes"
  ON public.document_notes
  FOR SELECT
  USING (
    owner_user_id IS NOT NULL AND
    owner_user_id = auth.uid()
  );

CREATE POLICY "Owners can create personal notes"
  ON public.document_notes
  FOR INSERT
  WITH CHECK (
    owner_user_id IS NOT NULL AND
    care_group_id IS NULL AND
    owner_user_id = auth.uid() AND
    created_by_user_id = auth.uid()
  );

CREATE POLICY "Owners can update personal notes"
  ON public.document_notes
  FOR UPDATE
  USING (
    owner_user_id IS NOT NULL AND
    owner_user_id = auth.uid()
  );

CREATE POLICY "Owners can delete personal notes"
  ON public.document_notes
  FOR DELETE
  USING (
    owner_user_id IS NOT NULL AND
    owner_user_id = auth.uid()
  );

-- Function to auto-release stale locks (after 5 minutes)
CREATE OR REPLACE FUNCTION public.release_stale_note_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.document_notes
  SET is_locked = false,
      locked_by_user_id = NULL,
      locked_at = NULL
  WHERE is_locked = true
    AND locked_at < now() - interval '5 minutes';
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_document_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_document_notes_updated_at_trigger
  BEFORE UPDATE ON public.document_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_document_notes_updated_at();