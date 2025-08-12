-- Contacts search index functions and triggers
CREATE OR REPLACE FUNCTION upsert_contact_search_index()
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
    contact_name TEXT;
    contact_details TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM search_index WHERE entity_type = 'contact' AND entity_id = OLD.id;
        RETURN OLD;
    END IF;
    
    -- Build contact name
    contact_name := TRIM(CONCAT_WS(' ', NEW.first_name, NEW.last_name));
    IF contact_name = '' OR contact_name IS NULL THEN
        contact_name := NEW.organization_name;
    END IF;
    
    search_title := COALESCE(contact_name, 'Contact');
    
    -- Build snippet with location, phone, and contact type
    contact_details := TRIM(CONCAT_WS(' • ', 
        NULLIF(CONCAT_WS(', ', NEW.city, NEW.state), ''),
        NEW.phone_primary,
        NEW.contact_type::text
    ));
    search_snippet := contact_details;
    
    -- Build body with all searchable text
    search_body := TRIM(CONCAT_WS(' ',
        NEW.email_personal,
        NEW.email_work,
        NEW.phone_primary,
        NEW.phone_secondary,
        NEW.organization_name,
        NEW.notes
    ));
    
    search_url := '/app/contacts/' || NEW.id;
    
    INSERT INTO search_index (entity_type, entity_id, care_group_id, title, snippet, url_path, fts)
    VALUES (
        'contact',
        NEW.id,
        NEW.care_group_id,
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

DROP TRIGGER IF EXISTS contact_search_trigger ON contacts;
CREATE TRIGGER contact_search_trigger
    AFTER INSERT OR UPDATE OR DELETE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION upsert_contact_search_index();

-- Function to rebuild the entire search index (useful for initial population)
CREATE OR REPLACE FUNCTION rebuild_search_index()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Clear existing index
    TRUNCATE search_index;
    
    -- Rebuild from all tables
    INSERT INTO search_index (entity_type, entity_id, care_group_id, title, snippet, url_path, fts)
    SELECT 
        'appointment',
        id,
        group_id,
        COALESCE(description, 'Appointment'),
        COALESCE(outcome_notes, ''),
        '/app/appointments/' || id,
        build_weighted_tsv(
            COALESCE(description, 'Appointment'),
            COALESCE(outcome_notes, ''),
            CONCAT_WS(' ', outcome_notes, location, category)
        )
    FROM appointments
    WHERE group_id IS NOT NULL;
    
    INSERT INTO search_index (entity_type, entity_id, care_group_id, title, snippet, url_path, fts)
    SELECT 
        'task',
        id,
        group_id,
        COALESCE(title, 'Task'),
        LEFT(COALESCE(description, ''), 240),
        '/app/tasks/' || id,
        build_weighted_tsv(
            COALESCE(title, 'Task'),
            LEFT(COALESCE(description, ''), 240),
            COALESCE(description, '')
        )
    FROM tasks
    WHERE group_id IS NOT NULL;
    
    INSERT INTO search_index (entity_type, entity_id, care_group_id, title, snippet, url_path, fts)
    SELECT 
        'document',
        id,
        group_id,
        COALESCE(title, original_filename, 'Document'),
        COALESCE(summary, ''),
        '/app/documents/' || id,
        build_weighted_tsv(
            COALESCE(title, original_filename, 'Document'),
            COALESCE(summary, ''),
            COALESCE(full_text, '')
        )
    FROM documents
    WHERE group_id IS NOT NULL;
    
    INSERT INTO search_index (entity_type, entity_id, care_group_id, title, snippet, url_path, fts)
    SELECT 
        'activity',
        id,
        group_id,
        COALESCE(title, CONCAT_WS(' ', type, TO_CHAR(date_time, 'YYYY-MM-DD')), 'Activity'),
        LEFT(COALESCE(notes, ''), 240),
        '/app/activities/' || id,
        build_weighted_tsv(
            COALESCE(title, CONCAT_WS(' ', type, TO_CHAR(date_time, 'YYYY-MM-DD')), 'Activity'),
            LEFT(COALESCE(notes, ''), 240),
            COALESCE(notes, '')
        )
    FROM activity_logs
    WHERE group_id IS NOT NULL;
    
    INSERT INTO search_index (entity_type, entity_id, care_group_id, title, snippet, url_path, fts)
    SELECT 
        'contact',
        id,
        care_group_id,
        COALESCE(
            NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''),
            organization_name,
            'Contact'
        ),
        TRIM(CONCAT_WS(' • ', 
            NULLIF(CONCAT_WS(', ', city, state), ''),
            phone_primary,
            contact_type::text
        )),
        '/app/contacts/' || id,
        build_weighted_tsv(
            COALESCE(
                NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''),
                organization_name,
                'Contact'
            ),
            TRIM(CONCAT_WS(' • ', 
                NULLIF(CONCAT_WS(', ', city, state), ''),
                phone_primary,
                contact_type::text
            )),
            TRIM(CONCAT_WS(' ',
                email_personal,
                email_work,
                phone_primary,
                phone_secondary,
                organization_name,
                notes
            ))
        )
    FROM contacts
    WHERE care_group_id IS NOT NULL;
    
    RAISE NOTICE 'Search index rebuilt successfully';
END;
$$;