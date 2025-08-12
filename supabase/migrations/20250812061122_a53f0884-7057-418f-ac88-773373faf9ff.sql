-- Appointments search index functions and triggers
CREATE OR REPLACE FUNCTION upsert_appointment_search_index()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    search_title TEXT;
    search_snippet TEXT;
    search_body TEXT;
    search_url TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM search_index WHERE entity_type = 'appointment' AND entity_id = OLD.id;
        RETURN OLD;
    END IF;
    
    search_title := COALESCE(NEW.description, 'Appointment');
    search_snippet := COALESCE(NEW.outcome_notes, '');
    search_body := CONCAT_WS(' ', NEW.outcome_notes, NEW.location, NEW.category);
    search_url := '/app/appointments/' || NEW.id;
    
    INSERT INTO search_index (entity_type, entity_id, care_group_id, title, snippet, url_path, fts)
    VALUES (
        'appointment',
        NEW.id,
        NEW.group_id,
        search_title,
        search_snippet,
        search_url,
        build_weighted_tsv(search_title, search_snippet, search_body)
    )
    ON CONFLICT (entity_type, entity_id) 
    DO UPDATE SET
        care_group_id = EXCLUDED.care_group_id,
        title = EXCLUDED.title,
        snippet = EXCLUDED.snippet,
        url_path = EXCLUDED.url_path,
        fts = EXCLUDED.fts,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointment_search_trigger ON appointments;
CREATE TRIGGER appointment_search_trigger
    AFTER INSERT OR UPDATE OR DELETE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION upsert_appointment_search_index();

-- Tasks search index functions and triggers
CREATE OR REPLACE FUNCTION upsert_task_search_index()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    search_title TEXT;
    search_snippet TEXT;
    search_body TEXT;
    search_url TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM search_index WHERE entity_type = 'task' AND entity_id = OLD.id;
        RETURN OLD;
    END IF;
    
    search_title := COALESCE(NEW.title, 'Task');
    search_snippet := LEFT(COALESCE(NEW.description, ''), 240);
    search_body := COALESCE(NEW.description, '');
    search_url := '/app/tasks/' || NEW.id;
    
    INSERT INTO search_index (entity_type, entity_id, care_group_id, title, snippet, url_path, fts)
    VALUES (
        'task',
        NEW.id,
        NEW.group_id,
        search_title,
        search_snippet,
        search_url,
        build_weighted_tsv(search_title, search_snippet, search_body)
    )
    ON CONFLICT (entity_type, entity_id) 
    DO UPDATE SET
        care_group_id = EXCLUDED.care_group_id,
        title = EXCLUDED.title,
        snippet = EXCLUDED.snippet,
        url_path = EXCLUDED.url_path,
        fts = EXCLUDED.fts,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_search_trigger ON tasks;
CREATE TRIGGER task_search_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION upsert_task_search_index();