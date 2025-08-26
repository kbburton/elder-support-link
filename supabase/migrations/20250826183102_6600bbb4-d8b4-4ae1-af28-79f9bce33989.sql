-- Replace the problematic view with a secure function
-- This approach ensures proper RLS policy enforcement

-- Drop the existing view
DROP VIEW IF EXISTS public.v_group_header;

-- Create a function that returns the same data but with explicit RLS enforcement
CREATE OR REPLACE FUNCTION public.get_group_header_data(p_care_group_id UUID)
RETURNS TABLE(
  care_group_id UUID,
  top_allergy TEXT,
  pinned_preferences JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER  -- This ensures the function runs with the caller's privileges
STABLE
SET search_path = 'public'
AS $$
BEGIN
  -- Ensure the user has access to this group (RLS enforcement)
  IF NOT EXISTS (
    SELECT 1 FROM care_groups cg 
    WHERE cg.id = p_care_group_id 
    AND is_user_member_of_group(cg.id)
  ) THEN
    RAISE EXCEPTION 'Access denied to care group';
  END IF;

  RETURN QUERY
  SELECT 
    p_care_group_id,
    (
      SELECT concat(a.allergen, ' • ', (a.severity)::text)
      FROM allergies a
      WHERE a.care_group_id = p_care_group_id
      ORDER BY
        CASE a.severity
          WHEN 'anaphylaxis'::allergy_severity THEN 4
          WHEN 'severe'::allergy_severity THEN 3
          WHEN 'moderate'::allergy_severity THEN 2
          ELSE 1
        END DESC, a.created_at DESC
      LIMIT 1
    ),
    (
      SELECT json_agg(
        json_build_object(
          'type', p.type, 
          'text', p.text_value, 
          'category', p.category, 
          'id', p.id, 
          'pinned', p.pinned
        ) ORDER BY p.order_index, p.updated_at DESC
      )
      FROM (
        SELECT p2.id, p2.type, p2.text_value, p2.category, p2.pinned, p2.order_index, p2.updated_at
        FROM preferences p2
        WHERE p2.care_group_id = p_care_group_id AND p2.pinned = true
        ORDER BY p2.order_index, p2.updated_at DESC
        LIMIT 3
      ) p
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_group_header_data(UUID) TO anon, authenticated;