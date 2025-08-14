-- Add foreign key constraint between care_group_members and profiles
ALTER TABLE public.care_group_members 
ADD CONSTRAINT care_group_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key constraint between care_group_members and care_groups
ALTER TABLE public.care_group_members 
ADD CONSTRAINT care_group_members_group_id_fkey 
FOREIGN KEY (group_id) REFERENCES public.care_groups(id) ON DELETE CASCADE;