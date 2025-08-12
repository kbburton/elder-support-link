-- Create search_all RPC function
CREATE OR REPLACE FUNCTION search_all(
    q TEXT,
    group_id UUID,
    lim INT DEFAULT 50
)
RETURNS TABLE(
    entity_type TEXT,
    entity_id UUID,
    title TEXT,
    snippet_html TEXT,
    url_path TEXT,
    rank REAL
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    search_query TSQUERY;
    has_fts_results BOOLEAN := FALSE;
BEGIN
    -- Validate inputs
    IF q IS NULL OR TRIM(q) = '' THEN
        RETURN;
    END IF;
    
    IF group_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Create the search query
    BEGIN
        search_query := websearch_to_tsquery('english', unaccent(q));
    EXCEPTION WHEN OTHERS THEN
        -- Fallback to plainto_tsquery if websearch_to_tsquery fails
        search_query := plainto_tsquery('english', unaccent(q));
    END;
    
    -- First, try full-text search
    RETURN QUERY
    SELECT 
        si.entity_type,
        si.entity_id,
        si.title,
        ts_headline(
            'english', 
            unaccent(COALESCE(si.snippet, si.title)), 
            search_query,
            'StartSel=<mark>,StopSel=</mark>,ShortWord=3,MaxFragments=3,MinWords=5,MaxWords=18'
        ) as snippet_html,
        si.url_path,
        ts_rank(si.fts, search_query, 1)::REAL as rank
    FROM search_index si
    WHERE si.care_group_id = group_id
        AND si.fts @@ search_query
    ORDER BY ts_rank(si.fts, search_query, 1) DESC, si.updated_at DESC
    LIMIT lim;
    
    -- Check if we got any FTS results
    GET DIAGNOSTICS has_fts_results = ROW_COUNT;
    
    -- If no FTS results, fallback to ILIKE search
    IF NOT has_fts_results OR has_fts_results = FALSE THEN
        RETURN QUERY
        SELECT 
            si.entity_type,
            si.entity_id,
            si.title,
            COALESCE(si.snippet, '') as snippet_html,
            si.url_path,
            CASE 
                WHEN si.title ILIKE '%' || q || '%' THEN 0.8
                WHEN si.snippet ILIKE '%' || q || '%' THEN 0.6
                ELSE 0.4
            END::REAL as rank
        FROM search_index si
        WHERE si.care_group_id = group_id
            AND (
                si.title ILIKE '%' || q || '%' 
                OR si.snippet ILIKE '%' || q || '%'
            )
        ORDER BY 
            CASE 
                WHEN si.title ILIKE '%' || q || '%' THEN 0.8
                WHEN si.snippet ILIKE '%' || q || '%' THEN 0.6
                ELSE 0.4
            END DESC,
            si.updated_at DESC
        LIMIT lim;
    END IF;
    
    RETURN;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_all(TEXT, UUID, INT) TO authenticated;