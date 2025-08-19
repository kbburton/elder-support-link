-- Fix the validation function to handle soft-deleted entities and add debugging
CREATE OR REPLACE FUNCTION public.validate_same_group_association()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    entity1_group_id uuid;
    entity2_group_id uuid;
    entity1_exists boolean := false;
    entity2_exists boolean := false;
BEGIN
    -- Get group IDs based on the specific junction table, excluding soft-deleted records
    IF TG_TABLE_NAME = 'activity_documents' THEN
        SELECT group_id, true INTO entity1_group_id, entity1_exists FROM activity_logs WHERE id = NEW.activity_log_id AND is_deleted = false;
        SELECT group_id, true INTO entity2_group_id, entity2_exists FROM documents WHERE id = NEW.document_id AND is_deleted = false;
    ELSIF TG_TABLE_NAME = 'task_documents' THEN
        SELECT group_id, true INTO entity1_group_id, entity1_exists FROM tasks WHERE id = NEW.task_id AND is_deleted = false;
        SELECT group_id, true INTO entity2_group_id, entity2_exists FROM documents WHERE id = NEW.document_id AND is_deleted = false;
    ELSIF TG_TABLE_NAME = 'task_activities' THEN
        SELECT group_id, true INTO entity1_group_id, entity1_exists FROM tasks WHERE id = NEW.task_id AND is_deleted = false;
        SELECT group_id, true INTO entity2_group_id, entity2_exists FROM activity_logs WHERE id = NEW.activity_log_id AND is_deleted = false;
    ELSIF TG_TABLE_NAME = 'appointment_documents' THEN
        SELECT group_id, true INTO entity1_group_id, entity1_exists FROM appointments WHERE id = NEW.appointment_id AND is_deleted = false;
        SELECT group_id, true INTO entity2_group_id, entity2_exists FROM documents WHERE id = NEW.document_id AND is_deleted = false;
    ELSIF TG_TABLE_NAME = 'appointment_tasks' THEN
        SELECT group_id, true INTO entity1_group_id, entity1_exists FROM appointments WHERE id = NEW.appointment_id AND is_deleted = false;
        SELECT group_id, true INTO entity2_group_id, entity2_exists FROM tasks WHERE id = NEW.task_id AND is_deleted = false;
    ELSIF TG_TABLE_NAME = 'appointment_activities' THEN
        SELECT group_id, true INTO entity1_group_id, entity1_exists FROM appointments WHERE id = NEW.appointment_id AND is_deleted = false;
        SELECT group_id, true INTO entity2_group_id, entity2_exists FROM activity_logs WHERE id = NEW.activity_log_id AND is_deleted = false;
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