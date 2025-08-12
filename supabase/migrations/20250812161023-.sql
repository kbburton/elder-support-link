-- Add unique constraints to prevent duplicate contact links
ALTER TABLE contact_activities ADD CONSTRAINT unique_contact_activity UNIQUE (contact_id, activity_log_id);
ALTER TABLE contact_appointments ADD CONSTRAINT unique_contact_appointment UNIQUE (contact_id, appointment_id);
ALTER TABLE contact_tasks ADD CONSTRAINT unique_contact_task UNIQUE (contact_id, task_id);
ALTER TABLE contact_documents ADD CONSTRAINT unique_contact_document UNIQUE (contact_id, document_id);

-- Create function to validate same care group for contact links
CREATE OR REPLACE FUNCTION validate_contact_link_same_group()
RETURNS TRIGGER AS $$
DECLARE
    contact_group_id uuid;
    entity_group_id uuid;
BEGIN
    -- Get contact's care group
    SELECT care_group_id INTO contact_group_id
    FROM contacts 
    WHERE id = NEW.contact_id;
    
    -- Get entity's care group based on table
    IF TG_TABLE_NAME = 'contact_activities' THEN
        SELECT group_id INTO entity_group_id
        FROM activity_logs 
        WHERE id = NEW.activity_log_id;
    ELSIF TG_TABLE_NAME = 'contact_appointments' THEN
        SELECT group_id INTO entity_group_id
        FROM appointments 
        WHERE id = NEW.appointment_id;
    ELSIF TG_TABLE_NAME = 'contact_tasks' THEN
        SELECT group_id INTO entity_group_id
        FROM tasks 
        WHERE id = NEW.task_id;
    ELSIF TG_TABLE_NAME = 'contact_documents' THEN
        SELECT group_id INTO entity_group_id
        FROM documents 
        WHERE id = NEW.document_id;
    END IF;
    
    -- Validate same care group
    IF contact_group_id IS NULL OR entity_group_id IS NULL THEN
        RAISE EXCEPTION 'Contact or entity not found';
    END IF;
    
    IF contact_group_id != entity_group_id THEN
        RAISE EXCEPTION 'Contact and % must belong to the same care group', TG_TABLE_NAME;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to validate same care group
CREATE TRIGGER validate_contact_activity_group
    BEFORE INSERT ON contact_activities
    FOR EACH ROW EXECUTE FUNCTION validate_contact_link_same_group();

CREATE TRIGGER validate_contact_appointment_group
    BEFORE INSERT ON contact_appointments
    FOR EACH ROW EXECUTE FUNCTION validate_contact_link_same_group();

CREATE TRIGGER validate_contact_task_group
    BEFORE INSERT ON contact_tasks
    FOR EACH ROW EXECUTE FUNCTION validate_contact_link_same_group();

CREATE TRIGGER validate_contact_document_group
    BEFORE INSERT ON contact_documents
    FOR EACH ROW EXECUTE FUNCTION validate_contact_link_same_group();