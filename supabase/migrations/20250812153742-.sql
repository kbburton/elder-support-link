-- Create admin schema for monitoring
CREATE SCHEMA IF NOT EXISTS admin;

-- Create search jobs monitoring table
CREATE TABLE admin.search_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    operation text NOT NULL, -- 'reindex' or 'remove'
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
    error_message text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create index for monitoring queries
CREATE INDEX idx_search_jobs_status_created ON admin.search_jobs(status, created_at DESC);
CREATE INDEX idx_search_jobs_entity ON admin.search_jobs(entity_type, entity_id);

-- Enable RLS on search_jobs
ALTER TABLE admin.search_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: System admins can manage all search jobs
CREATE POLICY "System admins can manage search jobs" 
ON admin.search_jobs 
FOR ALL 
USING (is_system_admin());

-- Function to remove from search index
CREATE OR REPLACE FUNCTION remove_from_index(p_entity_type text, p_entity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    job_id uuid;
BEGIN
    -- Create monitoring job
    INSERT INTO admin.search_jobs (entity_type, entity_id, operation)
    VALUES (p_entity_type, p_entity_id, 'remove')
    RETURNING id INTO job_id;
    
    BEGIN
        -- Remove from search index
        DELETE FROM search_index 
        WHERE entity_type = p_entity_type AND entity_id = p_entity_id;
        
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

-- Function to reindex a single row
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
                CONCAT_WS(' ', outcome_notes, location, category),
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

-- Create triggers for automatic search index updates
-- Note: We'll replace the existing individual trigger functions with new ones that call our centralized functions

-- Appointments trigger
CREATE OR REPLACE FUNCTION trigger_reindex_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM remove_from_index('appointment', OLD.id);
        RETURN OLD;
    ELSE
        PERFORM reindex_row('appointment', NEW.id);
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS upsert_appointment_search_index ON appointments;
CREATE TRIGGER trigger_appointment_search_index
    AFTER INSERT OR UPDATE OR DELETE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_reindex_appointment();

-- Tasks trigger
CREATE OR REPLACE FUNCTION trigger_reindex_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM remove_from_index('task', OLD.id);
        RETURN OLD;
    ELSE
        PERFORM reindex_row('task', NEW.id);
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS upsert_task_search_index ON tasks;
CREATE TRIGGER trigger_task_search_index
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION trigger_reindex_task();

-- Documents trigger
CREATE OR REPLACE FUNCTION trigger_reindex_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM remove_from_index('document', OLD.id);
        RETURN OLD;
    ELSE
        PERFORM reindex_row('document', NEW.id);
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS upsert_document_search_index ON documents;
CREATE TRIGGER trigger_document_search_index
    AFTER INSERT OR UPDATE OR DELETE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION trigger_reindex_document();

-- Activity logs trigger
CREATE OR REPLACE FUNCTION trigger_reindex_activity_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM remove_from_index('activity', OLD.id);
        RETURN OLD;
    ELSE
        PERFORM reindex_row('activity', NEW.id);
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS upsert_activity_log_search_index ON activity_logs;
CREATE TRIGGER trigger_activity_log_search_index
    AFTER INSERT OR UPDATE OR DELETE ON activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_reindex_activity_log();

-- Contacts trigger
CREATE OR REPLACE FUNCTION trigger_reindex_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM remove_from_index('contact', OLD.id);
        RETURN OLD;
    ELSE
        PERFORM reindex_row('contact', NEW.id);
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS upsert_contact_search_index ON contacts;
CREATE TRIGGER trigger_contact_search_index
    AFTER INSERT OR UPDATE OR DELETE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_reindex_contact();

-- Function to retry a failed search job
CREATE OR REPLACE FUNCTION retry_search_job(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    job_record admin.search_jobs;
BEGIN
    -- Get the job details
    SELECT * INTO job_record
    FROM admin.search_jobs
    WHERE id = p_job_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Search job not found';
    END IF;
    
    -- Retry the operation
    IF job_record.operation = 'reindex' THEN
        PERFORM reindex_row(job_record.entity_type, job_record.entity_id);
    ELSIF job_record.operation = 'remove' THEN
        PERFORM remove_from_index(job_record.entity_type, job_record.entity_id);
    ELSE
        RAISE EXCEPTION 'Unknown operation: %', job_record.operation;
    END IF;
END;
$$;