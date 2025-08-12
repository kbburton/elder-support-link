-- Update RLS policies for search_index to be more strict
DROP POLICY IF EXISTS "Users can view search results from their groups" ON search_index;
DROP POLICY IF EXISTS "System can manage search index" ON search_index;

-- Create strict RLS policies based on care group membership
CREATE POLICY "Members can view search results from their groups" 
ON search_index 
FOR SELECT 
TO authenticated
USING (is_user_member_of_group(care_group_id));

CREATE POLICY "Members can insert search results for their groups" 
ON search_index 
FOR INSERT 
TO authenticated
WITH CHECK (is_user_member_of_group(care_group_id));

CREATE POLICY "Members can update search results for their groups" 
ON search_index 
FOR UPDATE 
TO authenticated
USING (is_user_member_of_group(care_group_id))
WITH CHECK (is_user_member_of_group(care_group_id));

CREATE POLICY "Members can delete search results from their groups" 
ON search_index 
FOR DELETE 
TO authenticated
USING (is_user_member_of_group(care_group_id));

-- Update all upsert functions to use SECURITY DEFINER to bypass RLS during automatic indexing
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