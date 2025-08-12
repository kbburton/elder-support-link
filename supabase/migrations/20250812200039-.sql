-- Create enum types for tasks
DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('Open', 'InProgress', 'Completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('High', 'Medium', 'Low');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add priority column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE tasks ADD COLUMN priority task_priority DEFAULT 'Medium';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add a temporary new_status column with the enum type
ALTER TABLE tasks ADD COLUMN new_status task_status;

-- Update the new_status column with mapped values
UPDATE tasks SET new_status = 
    CASE 
        WHEN status = 'open' THEN 'Open'::task_status
        WHEN status = 'in_progress' THEN 'InProgress'::task_status  
        WHEN status = 'completed' THEN 'Completed'::task_status
        ELSE 'Open'::task_status  -- default fallback
    END;

-- Set the new column to NOT NULL
ALTER TABLE tasks ALTER COLUMN new_status SET NOT NULL;

-- Drop the old status column and rename the new one
ALTER TABLE tasks DROP COLUMN status;
ALTER TABLE tasks RENAME COLUMN new_status TO status;

-- Set default value for the status column
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'Open';

-- Create indexes for better query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_status_due_date ON tasks (status, due_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_priority_due_date ON tasks (priority, due_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_primary_owner_id ON tasks (primary_owner_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_due_date ON tasks (due_date);