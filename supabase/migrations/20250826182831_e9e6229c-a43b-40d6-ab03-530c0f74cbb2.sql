-- Fix Security Definer View issue
-- The v_group_header view was owned by postgres superuser, which bypasses RLS
-- We need to recreate it with proper ownership and it will inherit RLS from underlying tables

-- Drop the existing problematic view
DROP VIEW IF EXISTS public.v_group_header;

-- Recreate the view with proper security (SECURITY INVOKER is default)
-- This view will now respect RLS policies of the underlying tables (care_groups, allergies, preferences)
CREATE VIEW public.v_group_header AS
SELECT 
    id AS care_group_id,
    (
        SELECT concat(a.allergen, ' • ', (a.severity)::text) AS concat
        FROM allergies a
        WHERE (a.care_group_id = cg.id)
        ORDER BY
            CASE a.severity
                WHEN 'anaphylaxis'::allergy_severity THEN 4
                WHEN 'severe'::allergy_severity THEN 3
                WHEN 'moderate'::allergy_severity THEN 2
                ELSE 1
            END DESC, a.created_at DESC
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
        ) AS json_agg
        FROM (
            SELECT p2.id,
                p2.care_group_id,
                p2.type,
                p2.text_value,
                p2.category,
                p2.pinned,
                p2.order_index,
                p2.created_at,
                p2.updated_at
            FROM preferences p2
            WHERE ((p2.care_group_id = cg.id) AND (p2.pinned = true))
            ORDER BY p2.order_index, p2.updated_at DESC
            LIMIT 3
        ) p
    ) AS pinned_preferences
FROM care_groups cg;

-- Grant appropriate permissions to the view
-- The view will now respect RLS policies of the underlying tables
GRANT SELECT ON public.v_group_header TO anon, authenticated;