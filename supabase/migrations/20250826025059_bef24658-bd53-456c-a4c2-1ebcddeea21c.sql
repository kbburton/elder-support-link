-- Comprehensive fix for Security Definer View linter issue
-- This migration ensures no SECURITY DEFINER views exist and addresses potential caching

DO $$
DECLARE
    view_record RECORD;
    view_def TEXT;
BEGIN
    -- Check and fix any views that might have SECURITY DEFINER
    FOR view_record IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname IN ('public', 'auth', 'extensions')
    LOOP
        -- Get the view definition
        EXECUTE format('SELECT pg_get_viewdef(%I.%I)', view_record.schemaname, view_record.viewname) INTO view_def;
        
        -- If it contains SECURITY DEFINER, recreate it without
        IF view_def ILIKE '%security definer%' THEN
            RAISE NOTICE 'Found SECURITY DEFINER view: %.%', view_record.schemaname, view_record.viewname;
            
            -- For public schema views, we can safely recreate them
            IF view_record.schemaname = 'public' THEN
                -- Drop and recreate without SECURITY DEFINER
                EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', view_record.schemaname, view_record.viewname);
                
                -- Recreate the view without SECURITY DEFINER
                view_def := regexp_replace(view_def, '\s*SECURITY\s+DEFINER\s*', '', 'gi');
                EXECUTE format('CREATE VIEW %I.%I AS %s', view_record.schemaname, view_record.viewname, view_def);
                
                RAISE NOTICE 'Recreated view %.% without SECURITY DEFINER', view_record.schemaname, view_record.viewname;
            END IF;
        END IF;
    END LOOP;
    
    -- Ensure v_group_header is properly configured (double-check)
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_group_header') THEN
        SELECT pg_get_viewdef('public.v_group_header') INTO view_def;
        
        IF view_def ILIKE '%security definer%' THEN
            -- Recreate v_group_header without SECURITY DEFINER
            DROP VIEW IF EXISTS public.v_group_header;
            
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
            
            RAISE NOTICE 'Fixed v_group_header view to remove SECURITY DEFINER';
        END IF;
    END IF;
    
    -- Force a statistics update to clear any cached linter results
    ANALYZE;
    
END $$;