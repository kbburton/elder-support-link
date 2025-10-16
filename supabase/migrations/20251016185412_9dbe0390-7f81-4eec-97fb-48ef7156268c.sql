-- Create entity_associations table for unified associations
CREATE TABLE IF NOT EXISTS public.entity_associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_1_id UUID NOT NULL,
  entity_1_type TEXT NOT NULL CHECK (entity_1_type IN ('document', 'task', 'appointment', 'contact', 'activity_log')),
  entity_2_id UUID NOT NULL,
  entity_2_type TEXT NOT NULL CHECK (entity_2_type IN ('document', 'task', 'appointment', 'contact', 'activity_log')),
  group_id UUID NOT NULL REFERENCES public.care_groups(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Simple unique constraint after normalization
  CONSTRAINT unique_association UNIQUE (entity_1_id, entity_1_type, entity_2_id, entity_2_type, group_id),
  
  -- Prevent self-associations
  CONSTRAINT no_self_association CHECK (
    NOT (entity_1_id = entity_2_id AND entity_1_type = entity_2_type)
  )
);

-- Normalization function: Ensure consistent entity ordering
CREATE OR REPLACE FUNCTION public.normalize_entity_association()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Normalize order: put "smaller" entity in position 1
  -- Compare by ID first, then by type if IDs are equal
  IF (NEW.entity_1_id > NEW.entity_2_id) OR 
     (NEW.entity_1_id = NEW.entity_2_id AND NEW.entity_1_type > NEW.entity_2_type) THEN
    -- Swap entities
    DECLARE
      temp_id UUID;
      temp_type TEXT;
    BEGIN
      temp_id := NEW.entity_1_id;
      temp_type := NEW.entity_1_type;
      NEW.entity_1_id := NEW.entity_2_id;
      NEW.entity_1_type := NEW.entity_2_type;
      NEW.entity_2_id := temp_id;
      NEW.entity_2_type := temp_type;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to normalize before insert
CREATE TRIGGER normalize_association_trigger
  BEFORE INSERT ON public.entity_associations
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_entity_association();

-- Create indexes for efficient bidirectional lookups
CREATE INDEX IF NOT EXISTS idx_entity_associations_entity_1 
  ON public.entity_associations (entity_1_id, entity_1_type, group_id);

CREATE INDEX IF NOT EXISTS idx_entity_associations_entity_2 
  ON public.entity_associations (entity_2_id, entity_2_type, group_id);

CREATE INDEX IF NOT EXISTS idx_entity_associations_group 
  ON public.entity_associations (group_id);

-- Enable RLS
ALTER TABLE public.entity_associations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Group members can view associations
CREATE POLICY "Group members can view associations"
  ON public.entity_associations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.care_group_members cgm
      WHERE cgm.group_id = entity_associations.group_id
        AND cgm.user_id = auth.uid()
    )
  );

-- RLS Policies: Group members can create associations
CREATE POLICY "Group members can create associations"
  ON public.entity_associations
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by_user_id
    AND EXISTS (
      SELECT 1 FROM public.care_group_members cgm
      WHERE cgm.group_id = entity_associations.group_id
        AND cgm.user_id = auth.uid()
    )
  );

-- RLS Policies: Group members can delete associations
CREATE POLICY "Group members can delete associations"
  ON public.entity_associations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.care_group_members cgm
      WHERE cgm.group_id = entity_associations.group_id
        AND cgm.user_id = auth.uid()
    )
  );

-- Validation function: Ensure both entities exist and belong to the specified group
CREATE OR REPLACE FUNCTION public.validate_entity_association()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entity_1_group_id UUID;
  entity_2_group_id UUID;
BEGIN
  -- Validate entity 1 exists and get its group_id
  CASE NEW.entity_1_type
    WHEN 'document' THEN
      SELECT dgs.group_id INTO entity_1_group_id
      FROM public.document_v2_group_shares dgs
      WHERE dgs.document_id = NEW.entity_1_id
        AND dgs.group_id = NEW.group_id
      LIMIT 1;
    WHEN 'task' THEN
      SELECT t.group_id INTO entity_1_group_id
      FROM public.tasks t
      WHERE t.id = NEW.entity_1_id AND t.is_deleted = false;
    WHEN 'appointment' THEN
      SELECT a.group_id INTO entity_1_group_id
      FROM public.appointments a
      WHERE a.id = NEW.entity_1_id AND a.is_deleted = false;
    WHEN 'contact' THEN
      SELECT c.care_group_id INTO entity_1_group_id
      FROM public.contacts c
      WHERE c.id = NEW.entity_1_id AND c.is_deleted = false;
    WHEN 'activity_log' THEN
      SELECT al.group_id INTO entity_1_group_id
      FROM public.activity_logs al
      WHERE al.id = NEW.entity_1_id AND al.is_deleted = false;
  END CASE;

  -- Validate entity 2 exists and get its group_id
  CASE NEW.entity_2_type
    WHEN 'document' THEN
      SELECT dgs.group_id INTO entity_2_group_id
      FROM public.document_v2_group_shares dgs
      WHERE dgs.document_id = NEW.entity_2_id
        AND dgs.group_id = NEW.group_id
      LIMIT 1;
    WHEN 'task' THEN
      SELECT t.group_id INTO entity_2_group_id
      FROM public.tasks t
      WHERE t.id = NEW.entity_2_id AND t.is_deleted = false;
    WHEN 'appointment' THEN
      SELECT a.group_id INTO entity_2_group_id
      FROM public.appointments a
      WHERE a.id = NEW.entity_2_id AND a.is_deleted = false;
    WHEN 'contact' THEN
      SELECT c.care_group_id INTO entity_2_group_id
      FROM public.contacts c
      WHERE c.id = NEW.entity_2_id AND c.is_deleted = false;
    WHEN 'activity_log' THEN
      SELECT al.group_id INTO entity_2_group_id
      FROM public.activity_logs al
      WHERE al.id = NEW.entity_2_id AND al.is_deleted = false;
  END CASE;

  -- Ensure both entities exist
  IF entity_1_group_id IS NULL THEN
    RAISE EXCEPTION 'Entity 1 (%, %) not found or not accessible in group %', 
      NEW.entity_1_type, NEW.entity_1_id, NEW.group_id;
  END IF;

  IF entity_2_group_id IS NULL THEN
    RAISE EXCEPTION 'Entity 2 (%, %) not found or not accessible in group %', 
      NEW.entity_2_type, NEW.entity_2_id, NEW.group_id;
  END IF;

  -- Ensure both entities belong to the same group as the association
  IF entity_1_group_id != NEW.group_id THEN
    RAISE EXCEPTION 'Entity 1 does not belong to group %', NEW.group_id;
  END IF;

  IF entity_2_group_id != NEW.group_id THEN
    RAISE EXCEPTION 'Entity 2 does not belong to group %', NEW.group_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to validate associations after normalization but before insert
CREATE TRIGGER validate_entity_association_trigger
  BEFORE INSERT ON public.entity_associations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_entity_association();

-- Cleanup function: Remove associations when document is unshared from a group
CREATE OR REPLACE FUNCTION public.cleanup_document_associations_on_unshare()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete all associations involving this document in this group
  DELETE FROM public.entity_associations
  WHERE group_id = OLD.group_id
    AND (
      (entity_1_type = 'document' AND entity_1_id = OLD.document_id)
      OR (entity_2_type = 'document' AND entity_2_id = OLD.document_id)
    );

  RETURN OLD;
END;
$$;

-- Trigger to cleanup associations when document is unshared
CREATE TRIGGER cleanup_associations_on_document_unshare
  AFTER DELETE ON public.document_v2_group_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_document_associations_on_unshare();