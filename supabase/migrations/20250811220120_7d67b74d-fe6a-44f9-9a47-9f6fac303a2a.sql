-- Check what foreign key constraints exist on the tasks table
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM 
  information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name='tasks'
  AND tc.table_schema='public';

-- If the constraint points to auth.users, we need to remove it and point to profiles instead
-- since we can't directly reference auth.users from the public schema in inserts

-- Remove the problematic foreign key constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_created_by_user_id_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_primary_owner_id_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_secondary_owner_id_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_completed_by_user_id_fkey;

-- Add foreign key constraints pointing to profiles table instead
ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_created_by_user_id_fkey 
FOREIGN KEY (created_by_user_id) 
REFERENCES public.profiles(user_id) 
ON DELETE SET NULL;

ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_primary_owner_id_fkey 
FOREIGN KEY (primary_owner_id) 
REFERENCES public.profiles(user_id) 
ON DELETE SET NULL;

ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_secondary_owner_id_fkey 
FOREIGN KEY (secondary_owner_id) 
REFERENCES public.profiles(user_id) 
ON DELETE SET NULL;

ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_completed_by_user_id_fkey 
FOREIGN KEY (completed_by_user_id) 
REFERENCES public.profiles(user_id) 
ON DELETE SET NULL;