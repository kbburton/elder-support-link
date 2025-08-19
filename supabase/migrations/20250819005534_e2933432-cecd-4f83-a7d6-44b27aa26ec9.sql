-- Clean up invalid data in appointment_documents table
DELETE FROM appointment_documents 
WHERE document_id NOT IN (SELECT id FROM documents);

-- Only add foreign key constraints for appointment_documents if they don't exist
DO $$
BEGIN
    -- Check and add appointment_documents_appointment_id_fkey
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'appointment_documents_appointment_id_fkey'
    ) THEN
        ALTER TABLE appointment_documents 
        ADD CONSTRAINT appointment_documents_appointment_id_fkey 
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;
    END IF;

    -- Check and add appointment_documents_document_id_fkey
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'appointment_documents_document_id_fkey'
    ) THEN
        ALTER TABLE appointment_documents 
        ADD CONSTRAINT appointment_documents_document_id_fkey 
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
    END IF;
END $$;