-- Add missing foreign key constraints for appointment_documents table
ALTER TABLE appointment_documents 
ADD CONSTRAINT appointment_documents_appointment_id_fkey 
FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

ALTER TABLE appointment_documents 
ADD CONSTRAINT appointment_documents_document_id_fkey 
FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;

-- Also add missing foreign keys for other junction tables if not already present
ALTER TABLE appointment_tasks 
ADD CONSTRAINT appointment_tasks_appointment_id_fkey 
FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

ALTER TABLE appointment_tasks 
ADD CONSTRAINT appointment_tasks_task_id_fkey 
FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

ALTER TABLE appointment_activities 
ADD CONSTRAINT appointment_activities_appointment_id_fkey 
FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

ALTER TABLE appointment_activities 
ADD CONSTRAINT appointment_activities_activity_log_id_fkey 
FOREIGN KEY (activity_log_id) REFERENCES activity_logs(id) ON DELETE CASCADE;

ALTER TABLE task_activities 
ADD CONSTRAINT task_activities_task_id_fkey 
FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

ALTER TABLE task_activities 
ADD CONSTRAINT task_activities_activity_log_id_fkey 
FOREIGN KEY (activity_log_id) REFERENCES activity_logs(id) ON DELETE CASCADE;