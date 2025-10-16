-- Create junction tables for documents_v2 associations

-- Task-Document V2 Junction Table
CREATE TABLE IF NOT EXISTS public.task_documents_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents_v2(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, document_id)
);

ALTER TABLE public.task_documents_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can manage task documents v2"
ON public.task_documents_v2
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN care_group_members cgm ON cgm.group_id = t.group_id
    WHERE t.id = task_documents_v2.task_id AND cgm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN care_group_members cgm ON cgm.group_id = t.group_id
    WHERE t.id = task_documents_v2.task_id AND cgm.user_id = auth.uid()
  )
);

-- Appointment-Document V2 Junction Table
CREATE TABLE IF NOT EXISTS public.appointment_documents_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents_v2(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appointment_id, document_id)
);

ALTER TABLE public.appointment_documents_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can manage appointment documents v2"
ON public.appointment_documents_v2
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM appointments a
    JOIN care_group_members cgm ON cgm.group_id = a.group_id
    WHERE a.id = appointment_documents_v2.appointment_id AND cgm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM appointments a
    JOIN care_group_members cgm ON cgm.group_id = a.group_id
    WHERE a.id = appointment_documents_v2.appointment_id AND cgm.user_id = auth.uid()
  )
);

-- Contact-Document V2 Junction Table
CREATE TABLE IF NOT EXISTS public.contact_documents_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents_v2(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contact_id, document_id)
);

ALTER TABLE public.contact_documents_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can manage contact documents v2"
ON public.contact_documents_v2
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM contacts c
    JOIN care_group_members cgm ON cgm.group_id = c.care_group_id
    WHERE c.id = contact_documents_v2.contact_id AND cgm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM contacts c
    JOIN care_group_members cgm ON cgm.group_id = c.care_group_id
    WHERE c.id = contact_documents_v2.contact_id AND cgm.user_id = auth.uid()
  )
);

-- Activity-Document V2 Junction Table
CREATE TABLE IF NOT EXISTS public.activity_documents_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_log_id uuid NOT NULL REFERENCES public.activity_logs(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents_v2(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(activity_log_id, document_id)
);

ALTER TABLE public.activity_documents_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can manage activity documents v2"
ON public.activity_documents_v2
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM activity_logs al
    JOIN care_group_members cgm ON cgm.group_id = al.group_id
    WHERE al.id = activity_documents_v2.activity_log_id AND cgm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activity_logs al
    JOIN care_group_members cgm ON cgm.group_id = al.group_id
    WHERE al.id = activity_documents_v2.activity_log_id AND cgm.user_id = auth.uid()
  )
);

-- Add same group validation trigger for all v2 junction tables
CREATE OR REPLACE FUNCTION public.validate_same_group_association_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    entity1_group_id uuid;
    entity2_group_id uuid;
    entity1_exists boolean := false;
    entity2_exists boolean := false;
BEGIN
    -- Get group IDs based on the specific junction table, excluding soft-deleted records
    IF TG_TABLE_NAME = 'activity_documents_v2' THEN
        SELECT group_id, true INTO entity1_group_id, entity1_exists FROM activity_logs WHERE id = NEW.activity_log_id AND is_deleted = false;
        SELECT group_id, true INTO entity2_group_id, entity2_exists FROM documents_v2 WHERE id = NEW.document_id AND is_deleted = false;
    ELSIF TG_TABLE_NAME = 'task_documents_v2' THEN
        SELECT group_id, true INTO entity1_group_id, entity1_exists FROM tasks WHERE id = NEW.task_id AND is_deleted = false;
        SELECT group_id, true INTO entity2_group_id, entity2_exists FROM documents_v2 WHERE id = NEW.document_id AND is_deleted = false;
    ELSIF TG_TABLE_NAME = 'appointment_documents_v2' THEN
        SELECT group_id, true INTO entity1_group_id, entity1_exists FROM appointments WHERE id = NEW.appointment_id AND is_deleted = false;
        SELECT group_id, true INTO entity2_group_id, entity2_exists FROM documents_v2 WHERE id = NEW.document_id AND is_deleted = false;
    ELSIF TG_TABLE_NAME = 'contact_documents_v2' THEN
        SELECT care_group_id, true INTO entity1_group_id, entity1_exists FROM contacts WHERE id = NEW.contact_id AND is_deleted = false;
        SELECT group_id, true INTO entity2_group_id, entity2_exists FROM documents_v2 WHERE id = NEW.document_id AND is_deleted = false;
    END IF;
    
    -- Validate both entities exist and belong to same group
    IF entity1_group_id IS NULL OR entity2_group_id IS NULL OR NOT entity1_exists OR NOT entity2_exists THEN
        RAISE EXCEPTION 'One or both entities not found or are deleted';
    END IF;
    
    IF entity1_group_id != entity2_group_id THEN
        RAISE EXCEPTION 'Entities must belong to the same care group';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Add triggers for all v2 junction tables
CREATE TRIGGER validate_task_documents_v2_same_group
  BEFORE INSERT OR UPDATE ON public.task_documents_v2
  FOR EACH ROW EXECUTE FUNCTION public.validate_same_group_association_v2();

CREATE TRIGGER validate_appointment_documents_v2_same_group
  BEFORE INSERT OR UPDATE ON public.appointment_documents_v2
  FOR EACH ROW EXECUTE FUNCTION public.validate_same_group_association_v2();

CREATE TRIGGER validate_contact_documents_v2_same_group
  BEFORE INSERT OR UPDATE ON public.contact_documents_v2
  FOR EACH ROW EXECUTE FUNCTION public.validate_same_group_association_v2();

CREATE TRIGGER validate_activity_documents_v2_same_group
  BEFORE INSERT OR UPDATE ON public.activity_documents_v2
  FOR EACH ROW EXECUTE FUNCTION public.validate_same_group_association_v2();

-- Update validate_entity_exists to check documents_v2 as primary table
CREATE OR REPLACE FUNCTION public.validate_entity_exists(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean := false;
BEGIN
  -- Check based on entity type, prioritizing documents_v2
  IF p_entity_type = 'document' THEN
    -- Check documents_v2 first, then fall back to documents
    SELECT EXISTS (
      SELECT 1 FROM documents_v2 WHERE id = p_entity_id AND is_deleted = false
    ) INTO v_exists;
    
    IF NOT v_exists THEN
      SELECT EXISTS (
        SELECT 1 FROM documents WHERE id = p_entity_id AND is_deleted = false
      ) INTO v_exists;
    END IF;
  ELSIF p_entity_type = 'task' THEN
    SELECT EXISTS (
      SELECT 1 FROM tasks WHERE id = p_entity_id AND is_deleted = false
    ) INTO v_exists;
  ELSIF p_entity_type = 'activity_log' THEN
    SELECT EXISTS (
      SELECT 1 FROM activity_logs WHERE id = p_entity_id AND is_deleted = false
    ) INTO v_exists;
  ELSIF p_entity_type = 'appointment' THEN
    SELECT EXISTS (
      SELECT 1 FROM appointments WHERE id = p_entity_id AND is_deleted = false
    ) INTO v_exists;
  ELSIF p_entity_type = 'contact' THEN
    SELECT EXISTS (
      SELECT 1 FROM contacts WHERE id = p_entity_id AND is_deleted = false
    ) INTO v_exists;
  END IF;
  
  RETURN v_exists;
END;
$$;