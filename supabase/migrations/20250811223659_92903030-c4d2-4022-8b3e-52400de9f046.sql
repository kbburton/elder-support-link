-- Remove foreign key constraint on uploaded_by_user_id if it exists
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_uploaded_by_user_id_fkey;

-- Remove foreign key constraint on created_by_user_id if it exists  
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_created_by_user_id_fkey;

-- Ensure columns are nullable since we're storing auth.uid() directly
ALTER TABLE documents ALTER COLUMN uploaded_by_user_id DROP NOT NULL;

-- Remove foreign key constraint on user_id in care_group_members if it exists
ALTER TABLE care_group_members DROP CONSTRAINT IF EXISTS care_group_members_user_id_fkey;