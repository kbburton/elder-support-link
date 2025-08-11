-- Add foreign key constraints to establish proper relationships

-- Add foreign key from care_group_members to profiles
ALTER TABLE care_group_members 
ADD CONSTRAINT care_group_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- Add foreign key from tasks to profiles for created_by_user_id
ALTER TABLE tasks 
ADD CONSTRAINT tasks_created_by_user_id_fkey 
FOREIGN KEY (created_by_user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;

-- Add foreign key from tasks to profiles for primary_owner_id
ALTER TABLE tasks 
ADD CONSTRAINT tasks_primary_owner_id_fkey 
FOREIGN KEY (primary_owner_id) REFERENCES profiles(user_id) ON DELETE SET NULL;

-- Add foreign key from tasks to profiles for secondary_owner_id
ALTER TABLE tasks 
ADD CONSTRAINT tasks_secondary_owner_id_fkey 
FOREIGN KEY (secondary_owner_id) REFERENCES profiles(user_id) ON DELETE SET NULL;