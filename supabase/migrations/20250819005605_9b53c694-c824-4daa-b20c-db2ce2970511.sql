-- Enable RLS on junction tables that are missing it
ALTER TABLE appointment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_tasks ENABLE ROW LEVEL SECURITY;  
ALTER TABLE appointment_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;