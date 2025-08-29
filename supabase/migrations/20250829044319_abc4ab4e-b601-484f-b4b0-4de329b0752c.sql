-- Fix the reindex_row function to use correct column names for appointments
CREATE OR REPLACE FUNCTION reindex_row(p_entity_type text, p_entity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    job_id uuid;
    search_title text;
    search_snippet text;
    search_body text;
    search_url text;
    group_id_val uuid;
    last_job_time timestamptz;
BEGIN
    -- Check for recent duplicate job (de-duplication window of 2 seconds)
    SELECT created_at INTO last_job_time
    FROM admin.search_jobs
    WHERE entity_type = p_entity_type 
      AND entity_id = p_entity_id 
      AND operation = 'reindex'
      AND created_at > now() - interval '2 seconds'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Skip if there's a recent job
    IF last_job_time IS NOT NULL THEN
        RETURN;
    END IF;
    
    -- Create monitoring job
    INSERT INTO admin.search_jobs (entity_type, entity_id, operation)
    VALUES (p_entity_type, p_entity_id, 'reindex')
    RETURNING id INTO job_id;
    
    BEGIN
        -- Handle different entity types
        IF p_entity_type = 'appointment' THEN
            SELECT 
                COALESCE(description, 'Appointment'),
                COALESCE(outcome_notes, ''),
                CONCAT_WS(' ', outcome_notes, street_address, city, state, category),
                '/app/appointments/' || id,
                group_id
            INTO search_title, search_snippet, search_body, search_url, group_id_val
            FROM appointments WHERE id = p_entity_id;
            
        ELSIF p_entity_type = 'task' THEN
            SELECT 
                COALESCE(title, 'Task'),
                LEFT(COALESCE(description, ''), 240),
                COALESCE(description, ''),
                '/app/tasks/' || id,
                group_id
            INTO search_title, search_snippet, search_body, search_url, group_id_val
            FROM tasks WHERE id = p_entity_id;
            
        ELSIF p_entity_type = 'document' THEN
            SELECT 
                COALESCE(title, original_filename, 'Document'),
                COALESCE(summary, ''),
                COALESCE(full_text, ''),
                '/app/documents/' || id,
                group_id
            INTO search_title, search_snippet, search_body, search_url, group_id_val
            FROM documents WHERE id = p_entity_id;
            
        ELSIF p_entity_type = 'activity' THEN
            SELECT 
                COALESCE(title, CONCAT_WS(' ', type, TO_CHAR(date_time, 'YYYY-MM-DD')), 'Activity'),
                LEFT(COALESCE(notes, ''), 240),
                COALESCE(notes, ''),
                '/app/activities/' || id,
                group_id
            INTO search_title, search_snippet, search_body, search_url, group_id_val
            FROM activity_logs WHERE id = p_entity_id;
            
        ELSIF p_entity_type = 'contact' THEN
            SELECT 
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
                )),
                '/app/contacts/' || id,
                care_group_id
            INTO search_title, search_snippet, search_body, search_url, group_id_val
            FROM contacts WHERE id = p_entity_id;
            
        ELSE
            RAISE EXCEPTION 'Unknown entity type: %', p_entity_type;
        END IF;
        
        -- Skip if entity not found
        IF search_title IS NULL THEN
            UPDATE admin.search_jobs 
            SET status = 'failed', error_message = 'Entity not found', updated_at = now()
            WHERE id = job_id;
            RETURN;
        END IF;
        
        -- Upsert into search index
        INSERT INTO search_index (entity_type, entity_id, care_group_id, title, snippet, url_path, fts)
        VALUES (
            p_entity_type,
            p_entity_id,
            group_id_val,
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
        
        -- Mark job as successful
        UPDATE admin.search_jobs 
        SET status = 'success', updated_at = now()
        WHERE id = job_id;
        
    EXCEPTION WHEN OTHERS THEN
        -- Log the error
        UPDATE admin.search_jobs 
        SET status = 'failed', error_message = SQLERRM, updated_at = now()
        WHERE id = job_id;
        
        -- Re-raise the exception
        RAISE;
    END;
END;
$$;