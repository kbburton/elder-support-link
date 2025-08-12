-- Documents search index functions and triggers
CREATE OR REPLACE FUNCTION upsert_document_search_index()
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
        DELETE FROM search_index WHERE entity_type = 'document' AND entity_id = OLD.id;
        RETURN OLD;
    END IF;
    
    search_title := COALESCE(NEW.title, NEW.original_filename, 'Document');
    search_snippet := COALESCE(NEW.summary, '');
    search_body := COALESCE(NEW.full_text, '');
    search_url := '/app/documents/' || NEW.id;
    
    INSERT INTO search_index (entity_type, entity_id, care_group_id, title, snippet, url_path, fts)
    VALUES (
        'document',
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

DROP TRIGGER IF EXISTS document_search_trigger ON documents;
CREATE TRIGGER document_search_trigger
    AFTER INSERT OR UPDATE OR DELETE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION upsert_document_search_index();

-- Activity logs search index functions and triggers
CREATE OR REPLACE FUNCTION upsert_activity_log_search_index()
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
        DELETE FROM search_index WHERE entity_type = 'activity' AND entity_id = OLD.id;
        RETURN OLD;
    END IF;
    
    search_title := COALESCE(NEW.title, CONCAT_WS(' ', NEW.type, TO_CHAR(NEW.date_time, 'YYYY-MM-DD')), 'Activity');
    search_snippet := LEFT(COALESCE(NEW.notes, ''), 240);
    search_body := COALESCE(NEW.notes, '');
    search_url := '/app/activities/' || NEW.id;
    
    INSERT INTO search_index (entity_type, entity_id, care_group_id, title, snippet, url_path, fts)
    VALUES (
        'activity',
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

DROP TRIGGER IF EXISTS activity_log_search_trigger ON activity_logs;
CREATE TRIGGER activity_log_search_trigger
    AFTER INSERT OR UPDATE OR DELETE ON activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION upsert_activity_log_search_index();