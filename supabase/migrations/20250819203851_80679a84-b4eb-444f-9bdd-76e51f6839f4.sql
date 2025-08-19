-- Fix the critical RLS security issue by enabling RLS on any public tables that don't have it
-- First, let's check what table needs RLS enabled

-- Enable RLS on any tables in public schema that don't have it enabled
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND rowsecurity = false
          AND tablename NOT LIKE 'pg_%'
          AND tablename NOT LIKE 'sql_%'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.tablename);
    END LOOP;
END $$;

-- Fix the function search path security warning for the new function
CREATE OR REPLACE FUNCTION public.validate_same_group_association()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;