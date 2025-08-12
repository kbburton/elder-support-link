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

-- Update existing status values to match new enum values
UPDATE tasks SET status = 'Open' WHERE status = 'open';
UPDATE tasks SET status = 'InProgress' WHERE status = 'in_progress';
UPDATE tasks SET status = 'Completed' WHERE status = 'completed';

-- Convert status column to use enum type
ALTER TABLE tasks ALTER COLUMN status DROP DEFAULT;
ALTER TABLE tasks ALTER COLUMN status TYPE task_status USING status::task_status;
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'Open';

-- Create indexes for better query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_status_due_date ON tasks (status, due_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_priority_due_date ON tasks (priority, due_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_primary_owner_id ON tasks (primary_owner_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_due_date ON tasks (due_date);