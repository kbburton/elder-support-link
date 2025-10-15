-- Add notes column to documents_v2
ALTER TABLE documents_v2 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_documents_v2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_updated_at ON documents_v2;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON documents_v2
    FOR EACH ROW
    EXECUTE FUNCTION update_documents_v2_updated_at();