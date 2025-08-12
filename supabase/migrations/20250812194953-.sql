-- Add the missing foreign key relationship between care_group_members and profiles
-- This will resolve the PGRST200 error when trying to join these tables

ALTER TABLE care_group_members 
ADD CONSTRAINT care_group_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;