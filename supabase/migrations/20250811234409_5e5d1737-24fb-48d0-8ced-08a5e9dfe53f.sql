-- Add created_by_email column to activity_logs table
ALTER TABLE public.activity_logs 
ADD COLUMN created_by_email TEXT;