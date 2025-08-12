-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create search index table
CREATE TABLE IF NOT EXISTS search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    care_group_id UUID NOT NULL,
    title TEXT NOT NULL,
    snippet TEXT,
    url_path TEXT NOT NULL,
    fts TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_type, entity_id)
);

-- Create GIN index on fts column
CREATE INDEX IF NOT EXISTS idx_search_index_fts ON search_index USING GIN(fts);

-- Create index on care_group_id for filtering
CREATE INDEX IF NOT EXISTS idx_search_index_care_group_id ON search_index(care_group_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_search_index_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS search_index_updated_at_trigger ON search_index;
CREATE TRIGGER search_index_updated_at_trigger
    BEFORE UPDATE ON search_index
    FOR EACH ROW
    EXECUTE FUNCTION update_search_index_updated_at();

-- Helper function to build weighted TSVector
CREATE OR REPLACE FUNCTION build_weighted_tsv(
    title_text TEXT DEFAULT '',
    snippet_text TEXT DEFAULT '',
    body_text TEXT DEFAULT ''
)
RETURNS TSVECTOR
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN 
        setweight(to_tsvector('english', unaccent(COALESCE(title_text, ''))), 'A') ||
        setweight(to_tsvector('english', unaccent(COALESCE(snippet_text, ''))), 'B') ||
        setweight(to_tsvector('english', unaccent(COALESCE(body_text, ''))), 'C');
END;
$$;