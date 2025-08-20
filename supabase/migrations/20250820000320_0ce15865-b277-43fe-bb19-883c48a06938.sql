-- Clean up legacy document_links table since we're using junction tables now
DROP TABLE IF EXISTS public.document_links CASCADE;

-- Add comprehensive logging function for debugging associations
CREATE OR REPLACE FUNCTION public.debug_associations(
  p_entity_type text,
  p_entity_id uuid
) RETURNS TABLE(
  junction_table text,
  associated_type text,
  associated_id uuid,
  associated_title text,
  association_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  debug_info text := '';
BEGIN
  -- Initialize return table
  association_count := 0;
  
  -- Check task_documents
  IF p_entity_type = 'task' THEN
    RETURN QUERY
    SELECT 
      'task_documents'::text as junction_table,
      'document'::text as associated_type,
      d.id as associated_id,
      COALESCE(d.title, d.original_filename, 'Untitled Document') as associated_title,
      (SELECT COUNT(*)::integer FROM task_documents WHERE task_id = p_entity_id) as association_count
    FROM task_documents td
    JOIN documents d ON d.id = td.document_id
    WHERE td.task_id = p_entity_id AND d.is_deleted = false;
    
    RETURN QUERY
    SELECT 
      'task_activities'::text as junction_table,
      'activity'::text as associated_type,
      al.id as associated_id,
      COALESCE(al.title, al.type || ' Activity') as associated_title,
      (SELECT COUNT(*)::integer FROM task_activities WHERE task_id = p_entity_id) as association_count
    FROM task_activities ta
    JOIN activity_logs al ON al.id = ta.activity_log_id
    WHERE ta.task_id = p_entity_id AND al.is_deleted = false;
    
  ELSIF p_entity_type = 'document' THEN
    RETURN QUERY
    SELECT 
      'task_documents'::text as junction_table,
      'task'::text as associated_type,
      t.id as associated_id,
      COALESCE(t.title, 'Untitled Task') as associated_title,
      (SELECT COUNT(*)::integer FROM task_documents WHERE document_id = p_entity_id) as association_count
    FROM task_documents td
    JOIN tasks t ON t.id = td.task_id
    WHERE td.document_id = p_entity_id AND t.is_deleted = false;
    
    RETURN QUERY
    SELECT 
      'activity_documents'::text as junction_table,
      'activity'::text as associated_type,
      al.id as associated_id,
      COALESCE(al.title, al.type || ' Activity') as associated_title,
      (SELECT COUNT(*)::integer FROM activity_documents WHERE document_id = p_entity_id) as association_count
    FROM activity_documents ad
    JOIN activity_logs al ON al.id = ad.activity_log_id
    WHERE ad.document_id = p_entity_id AND al.is_deleted = false;
    
  ELSIF p_entity_type = 'activity' THEN
    RETURN QUERY
    SELECT 
      'task_activities'::text as junction_table,
      'task'::text as associated_type,
      t.id as associated_id,
      COALESCE(t.title, 'Untitled Task') as associated_title,
      (SELECT COUNT(*)::integer FROM task_activities WHERE activity_log_id = p_entity_id) as association_count
    FROM task_activities ta
    JOIN tasks t ON t.id = ta.task_id
    WHERE ta.activity_log_id = p_entity_id AND t.is_deleted = false;
    
    RETURN QUERY
    SELECT 
      'activity_documents'::text as junction_table,
      'document'::text as associated_type,
      d.id as associated_id,
      COALESCE(d.title, d.original_filename, 'Untitled Document') as associated_title,
      (SELECT COUNT(*)::integer FROM activity_documents WHERE activity_log_id = p_entity_id) as association_count
    FROM activity_documents ad
    JOIN documents d ON d.id = ad.document_id
    WHERE ad.activity_log_id = p_entity_id AND d.is_deleted = false;
  END IF;
  
END;
$$;