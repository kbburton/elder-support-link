-- Ensure columns exist (using full_text instead of extracted_text to match existing schema)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS full_text text;

-- Add processing status if it doesn't exist
ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending';

-- Create function to automatically process documents
CREATE OR REPLACE FUNCTION trigger_document_processing()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger processing for new documents or when file_url changes
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.file_url IS DISTINCT FROM NEW.file_url) THEN
        -- Set processing status to pending
        NEW.processing_status = 'pending';
        
        -- Note: We'll call the edge function asynchronously from the application
        -- Database triggers can't make HTTP calls directly
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on documents table
DROP TRIGGER IF EXISTS documents_processing_trigger ON documents;
CREATE TRIGGER documents_processing_trigger
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION trigger_document_processing();