-- Fix foreign key constraints to reference auth.users instead of public.users

-- 1) Drop existing FKs that point to public.users
ALTER TABLE public.care_groups DROP CONSTRAINT IF EXISTS care_groups_created_by_user_id_fkey;
ALTER TABLE public.care_group_members DROP CONSTRAINT IF EXISTS care_group_members_user_id_fkey;

-- 2) Recreate FKs pointing to auth.users(id)
ALTER TABLE public.care_groups
  ADD CONSTRAINT care_groups_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.care_group_members
  ADD CONSTRAINT care_group_members_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;