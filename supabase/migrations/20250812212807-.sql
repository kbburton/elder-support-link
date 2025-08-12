-- Add missing foreign key constraint between task_recurrence_rules and tasks
ALTER TABLE task_recurrence_rules 
ADD CONSTRAINT task_recurrence_rules_task_id_fkey 
FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;