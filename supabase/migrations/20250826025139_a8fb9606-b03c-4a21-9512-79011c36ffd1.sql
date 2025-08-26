-- Targeted fix for Security Definer View linter issue
-- Focus only on public schema views to avoid system schema complications

DO $$
DECLARE
    view_record RECORD;
    view_def TEXT;
    notice_msg TEXT := '';
BEGIN
    -- Check only public schema views for SECURITY DEFINER
    FOR view_record IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
    LOOP
        -- Get the view definition safely
        BEGIN
            SELECT pg_get_viewdef(format('%I.%I', view_record.schemaname, view_record.viewname)) INTO view_def;
            
            -- If it contains SECURITY DEFINER, log it
            IF view_def ILIKE '%security definer%' THEN
                notice_msg := format('Found SECURITY DEFINER view: %s.%s', view_record.schemaname, view_record.viewname);
                RAISE NOTICE '%', notice_msg;
                
                -- Drop and recreate without SECURITY DEFINER
                EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', view_record.schemaname, view_record.viewname);
                
                -- Remove SECURITY DEFINER from definition and recreate
                view_def := regexp_replace(view_def, '\s*SECURITY\s+DEFINER\s*', '', 'gi');
                EXECUTE format('CREATE VIEW %I.%I AS %s', view_record.schemaname, view_record.viewname, view_def);
                
                -- Grant permissions
                EXECUTE format('GRANT SELECT ON %I.%I TO authenticated', view_record.schemaname, view_record.viewname);
                
                RAISE NOTICE 'Fixed view %s.%s', view_record.schemaname, view_record.viewname;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Skip problematic views and continue
            RAISE NOTICE 'Skipped view %s.%s due to error: %s', view_record.schemaname, view_record.viewname, SQLERRM;
        END;
    END LOOP;
    
    -- Final verification: ensure v_group_header is correct
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_group_header') THEN
        SELECT pg_get_viewdef('public.v_group_header') INTO view_def;
        
        IF view_def ILIKE '%security definer%' THEN
            RAISE NOTICE 'v_group_header still has SECURITY DEFINER - this should not happen';
        ELSE
            RAISE NOTICE 'v_group_header is correctly configured without SECURITY DEFINER';
        END IF;
    END IF;
    
    RAISE NOTICE 'Security Definer View cleanup completed';
    
END $$;