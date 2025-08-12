-- Create platform_admins table
CREATE TABLE public.platform_admins (
    user_id uuid PRIMARY KEY
);

-- Enable RLS on platform_admins
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Only platform admins can manage platform_admins
CREATE POLICY "Platform admins can manage platform_admins" ON public.platform_admins
FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM public.platform_admins)
);

-- Seed platform_admins with kbburton3@gmail.com user_id
-- First, let's find the user_id for kbburton3@gmail.com
INSERT INTO public.platform_admins (user_id)
SELECT id 
FROM auth.users 
WHERE email = 'kbburton3@gmail.com'
LIMIT 1;

-- Create helper function to check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins 
    WHERE user_id = user_uuid
  );
$$;

-- Update feedback_items RLS policies
DROP POLICY IF EXISTS "Users can view all feedback items" ON public.feedback_items;
DROP POLICY IF EXISTS "Users can create feedback items" ON public.feedback_items;
DROP POLICY IF EXISTS "Users can update their own feedback or admins can update any" ON public.feedback_items;
DROP POLICY IF EXISTS "System admins can delete feedback items" ON public.feedback_items;

-- SELECT feedback_items policy
CREATE POLICY "Users can view feedback items" ON public.feedback_items
FOR SELECT USING (
    created_by_user_id = auth.uid() OR
    (care_group_id IS NOT NULL AND is_user_admin_of_group(care_group_id)) OR
    is_platform_admin(auth.uid())
);

-- INSERT feedback_items policy  
CREATE POLICY "Users can create feedback items" ON public.feedback_items
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    (care_group_id IS NULL OR is_user_member_of_group(care_group_id))
);

-- UPDATE feedback_items policy
CREATE POLICY "Users can update feedback items" ON public.feedback_items
FOR UPDATE USING (
    is_platform_admin(auth.uid()) OR
    (care_group_id IS NOT NULL AND is_user_admin_of_group(care_group_id)) OR
    (created_by_user_id = auth.uid())
) WITH CHECK (
    is_platform_admin(auth.uid()) OR
    (care_group_id IS NOT NULL AND is_user_admin_of_group(care_group_id)) OR
    (created_by_user_id = auth.uid())
);

-- DELETE feedback_items policy
CREATE POLICY "Users can delete feedback items" ON public.feedback_items
FOR DELETE USING (
    is_platform_admin(auth.uid()) OR
    (care_group_id IS NOT NULL AND is_user_admin_of_group(care_group_id))
);

-- Update feedback_comments RLS policies
DROP POLICY IF EXISTS "Users can view all feedback comments" ON public.feedback_comments;
DROP POLICY IF EXISTS "Users can create feedback comments" ON public.feedback_comments;
DROP POLICY IF EXISTS "Users can update their own comments or admins can update any" ON public.feedback_comments;
DROP POLICY IF EXISTS "Users can delete their own comments or admins can delete any" ON public.feedback_comments;

-- SELECT feedback_comments policy - can view if can view parent feedback item
CREATE POLICY "Users can view feedback comments" ON public.feedback_comments
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.feedback_items fi
        WHERE fi.id = feedback_comments.feedback_id
        AND (
            fi.created_by_user_id = auth.uid() OR
            (fi.care_group_id IS NOT NULL AND is_user_admin_of_group(fi.care_group_id)) OR
            is_platform_admin(auth.uid())
        )
    )
);

-- INSERT feedback_comments policy - can insert if can view parent feedback item
CREATE POLICY "Users can create feedback comments" ON public.feedback_comments
FOR INSERT WITH CHECK (
    auth.uid() = created_by_user_id AND
    EXISTS (
        SELECT 1 FROM public.feedback_items fi
        WHERE fi.id = feedback_comments.feedback_id
        AND (
            fi.created_by_user_id = auth.uid() OR
            (fi.care_group_id IS NOT NULL AND is_user_admin_of_group(fi.care_group_id)) OR
            is_platform_admin(auth.uid())
        )
    )
);

-- UPDATE feedback_comments policy
CREATE POLICY "Users can update their own comments or admins can update any" ON public.feedback_comments
FOR UPDATE USING (
    auth.uid() = created_by_user_id OR is_platform_admin(auth.uid())
);

-- DELETE feedback_comments policy  
CREATE POLICY "Users can delete their own comments or admins can delete any" ON public.feedback_comments
FOR DELETE USING (
    auth.uid() = created_by_user_id OR is_platform_admin(auth.uid())
);