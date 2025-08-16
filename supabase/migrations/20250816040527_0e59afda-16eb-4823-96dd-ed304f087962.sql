-- Fix the created_by_user_id field to be NOT NULL to ensure RLS works properly
ALTER TABLE public.care_groups 
ALTER COLUMN created_by_user_id SET NOT NULL;