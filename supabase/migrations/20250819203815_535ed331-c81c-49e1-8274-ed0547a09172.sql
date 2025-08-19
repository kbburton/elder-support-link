-- Remove incorrect trigger that expects contact_id on activity_documents table
DROP TRIGGER IF EXISTS validate_activity_document_same_group ON public.activity_documents;

-- Create proper validation function for non-contact junction tables
CREATE OR REPLACE FUNCTION public.validate_same_group_association()
RETURNS TRIGGER AS $$
DECLARE
    entity1_group_id uuid;
    entity2_group_id uuid;
BEGIN
    -- Get group IDs based on the specific junction table
    IF TG_TABLE_NAME = 'activity_documents' THEN
        SELECT group_id INTO entity1_group_id FROM activity_logs WHERE id = NEW.activity_log_id;
        SELECT group_id INTO entity2_group_id FROM documents WHERE id = NEW.document_id;
    ELSIF TG_TABLE_NAME = 'task_documents' THEN
        SELECT group_id INTO entity1_group_id FROM tasks WHERE id = NEW.task_id;
        SELECT group_id INTO entity2_group_id FROM documents WHERE id = NEW.document_id;
    ELSIF TG_TABLE_NAME = 'task_activities' THEN
        SELECT group_id INTO entity1_group_id FROM tasks WHERE id = NEW.task_id;
        SELECT group_id INTO entity2_group_id FROM activity_logs WHERE id = NEW.activity_log_id;
    ELSIF TG_TABLE_NAME = 'appointment_documents' THEN
        SELECT group_id INTO entity1_group_id FROM appointments WHERE id = NEW.appointment_id;
        SELECT group_id INTO entity2_group_id FROM documents WHERE id = NEW.document_id;
    ELSIF TG_TABLE_NAME = 'appointment_tasks' THEN
        SELECT group_id INTO entity1_group_id FROM appointments WHERE id = NEW.appointment_id;
        SELECT group_id INTO entity2_group_id FROM tasks WHERE id = NEW.task_id;
    ELSIF TG_TABLE_NAME = 'appointment_activities' THEN
        SELECT group_id INTO entity1_group_id FROM appointments WHERE id = NEW.appointment_id;
        SELECT group_id INTO entity2_group_id FROM activity_logs WHERE id = NEW.activity_log_id;
    END IF;
    
    -- Validate both entities exist and belong to same group
    IF entity1_group_id IS NULL OR entity2_group_id IS NULL THEN
        RAISE EXCEPTION 'One or both entities not found';
    END IF;
    
    IF entity1_group_id != entity2_group_id THEN
        RAISE EXCEPTION 'Entities must belong to the same care group';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add proper triggers for non-contact junction tables
CREATE TRIGGER validate_activity_document_same_group
    BEFORE INSERT ON public.activity_documents
    FOR EACH ROW EXECUTE FUNCTION validate_same_group_association();

CREATE TRIGGER validate_task_document_same_group
    BEFORE INSERT ON public.task_documents
    FOR EACH ROW EXECUTE FUNCTION validate_same_group_association();

CREATE TRIGGER validate_task_activity_same_group  
    BEFORE INSERT ON public.task_activities
    FOR EACH ROW EXECUTE FUNCTION validate_same_group_association();

-- Remove any other incorrect triggers that might exist
DROP TRIGGER IF EXISTS validate_task_document_same_group ON public.task_documents;
DROP TRIGGER IF EXISTS validate_task_activity_same_group ON public.task_activities;

-- Re-add the correct triggers
CREATE TRIGGER validate_task_document_same_group
    BEFORE INSERT ON public.task_documents
    FOR EACH ROW EXECUTE FUNCTION validate_same_group_association();

CREATE TRIGGER validate_task_activity_same_group  
    BEFORE INSERT ON public.task_activities
    FOR EACH ROW EXECUTE FUNCTION validate_same_group_association();