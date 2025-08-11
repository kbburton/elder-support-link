-- Add original_filename column to documents table
ALTER TABLE public.documents 
ADD COLUMN original_filename TEXT;