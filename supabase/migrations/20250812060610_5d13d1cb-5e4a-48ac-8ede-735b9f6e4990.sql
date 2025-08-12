-- Fix the security warning by setting search_path
CREATE OR REPLACE FUNCTION trigger_document_processing()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
$$;