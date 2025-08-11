-- Add foreign key constraints to activity_logs table for data integrity

-- Add foreign key constraint for group_id
ALTER TABLE public.activity_logs 
ADD CONSTRAINT fk_activity_logs_group_id 
FOREIGN KEY (group_id) REFERENCES public.care_groups(id) ON DELETE CASCADE;

-- Add foreign key constraint for linked_task_id
ALTER TABLE public.activity_logs 
ADD CONSTRAINT fk_activity_logs_linked_task_id 
FOREIGN KEY (linked_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Add foreign key constraint for linked_appointment_id
ALTER TABLE public.activity_logs 
ADD CONSTRAINT fk_activity_logs_linked_appointment_id 
FOREIGN KEY (linked_appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

-- Note: created_by_user_id references auth.users which we cannot directly reference
-- but we can ensure data integrity through RLS policies