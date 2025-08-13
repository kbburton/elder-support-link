-- Add duration field to appointments table
ALTER TABLE appointments 
ADD COLUMN duration_minutes integer;