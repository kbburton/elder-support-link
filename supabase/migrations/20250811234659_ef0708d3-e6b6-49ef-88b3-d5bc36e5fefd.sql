-- Remove the incorrect foreign key constraint that references the wrong users table
ALTER TABLE public.activity_logs 
DROP CONSTRAINT IF EXISTS activity_logs_created_by_user_id_fkey;

-- Since we cannot directly reference auth.users, we'll rely on RLS policies 
-- and application-level validation instead of foreign key constraints for user references

-- Check if other constraints already exist before adding them
DO $$
BEGIN
    -- Add group_id foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_activity_logs_group_id' 
        AND table_name = 'activity_logs'
    ) THEN
        ALTER TABLE public.activity_logs 
        ADD CONSTRAINT fk_activity_logs_group_id 
        FOREIGN KEY (group_id) REFERENCES public.care_groups(id) ON DELETE CASCADE;
    END IF;

    -- Add linked_task_id foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_activity_logs_linked_task_id' 
        AND table_name = 'activity_logs'
    ) THEN
        ALTER TABLE public.activity_logs 
        ADD CONSTRAINT fk_activity_logs_linked_task_id 
        FOREIGN KEY (linked_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
    END IF;

    -- Add linked_appointment_id foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_activity_logs_linked_appointment_id' 
        AND table_name = 'activity_logs'
    ) THEN
        ALTER TABLE public.activity_logs 
        ADD CONSTRAINT fk_activity_logs_linked_appointment_id 
        FOREIGN KEY (linked_appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;
    END IF;
END $$;