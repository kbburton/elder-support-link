-- Fix Security Definer View issue
-- Drop and recreate the v_group_header view to ensure it doesn't use SECURITY DEFINER

-- Drop the existing view
DROP VIEW IF EXISTS public.v_group_header;

-- Recreate the view without SECURITY DEFINER to properly enforce RLS
-- Views inherit RLS policies from their underlying tables
CREATE VIEW public.v_group_header AS
SELECT 
  id AS care_group_id,
  (
    SELECT concat(a.allergen, ' • ', a.severity::text) 
    FROM allergies a 
    WHERE a.care_group_id = cg.id 
    ORDER BY 
      CASE a.severity
        WHEN 'anaphylaxis'::allergy_severity THEN 4
        WHEN 'severe'::allergy_severity THEN 3 
        WHEN 'moderate'::allergy_severity THEN 2
        ELSE 1
      END DESC,
      a.created_at DESC
    LIMIT 1
  ) AS top_allergy,
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
      SELECT p2.id, p2.care_group_id, p2.type, p2.text_value, 
             p2.category, p2.pinned, p2.order_index, p2.created_at, p2.updated_at
      FROM preferences p2 
      WHERE p2.care_group_id = cg.id AND p2.pinned = true
      ORDER BY p2.order_index, p2.updated_at DESC 
      LIMIT 3
    ) p
  ) AS pinned_preferences
FROM care_groups cg;

-- Grant appropriate permissions
GRANT SELECT ON public.v_group_header TO authenticated;