-- Clean up invalid data in appointment_documents table
DELETE FROM appointment_documents 
WHERE document_id NOT IN (SELECT id FROM documents);

-- Clean up invalid data in other junction tables if any
DELETE FROM appointment_tasks 
WHERE task_id NOT IN (SELECT id FROM tasks) 
   OR appointment_id NOT IN (SELECT id FROM appointments);

DELETE FROM appointment_activities 
WHERE activity_log_id NOT IN (SELECT id FROM activity_logs) 
   OR appointment_id NOT IN (SELECT id FROM appointments);

DELETE FROM task_activities 
WHERE task_id NOT IN (SELECT id FROM tasks) 
   OR activity_log_id NOT IN (SELECT id FROM activity_logs);

-- Now add the foreign key constraints
ALTER TABLE appointment_documents 
ADD CONSTRAINT appointment_documents_appointment_id_fkey 
FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

ALTER TABLE appointment_documents 
ADD CONSTRAINT appointment_documents_document_id_fkey 
FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;

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