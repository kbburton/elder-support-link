-- Add only the missing foreign key constraints

-- Add foreign key from tasks to profiles for created_by_user_id (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tasks_created_by_user_id_fkey' 
        AND table_name = 'tasks'
    ) THEN
        ALTER TABLE tasks 
        ADD CONSTRAINT tasks_created_by_user_id_fkey 
        FOREIGN KEY (created_by_user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign key from tasks to profiles for primary_owner_id (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tasks_primary_owner_id_fkey' 
        AND table_name = 'tasks'
    ) THEN
        ALTER TABLE tasks 
        ADD CONSTRAINT tasks_primary_owner_id_fkey 
        FOREIGN KEY (primary_owner_id) REFERENCES profiles(user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign key from tasks to profiles for secondary_owner_id (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tasks_secondary_owner_id_fkey' 
        AND table_name = 'tasks'
    ) THEN
        ALTER TABLE tasks 
        ADD CONSTRAINT tasks_secondary_owner_id_fkey 
        FOREIGN KEY (secondary_owner_id) REFERENCES profiles(user_id) ON DELETE SET NULL;
    END IF;
END $$;