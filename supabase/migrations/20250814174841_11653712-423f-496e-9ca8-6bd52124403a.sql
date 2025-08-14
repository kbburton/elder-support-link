-- Clean up orphaned profiles that don't exist in auth.users anymore
-- This will help prevent conflicts with duplicate emails

-- First, let's clean up any profiles for deleted users
-- We'll use a more direct approach since we can't easily reference auth.users

-- Delete duplicate profiles for kbburton3@hotmail.com, keeping only the most recent one
DELETE FROM public.profiles 
WHERE email = 'kbburton3@hotmail.com' 
AND user_id IN (
    'e21ffaf6-8e90-4b57-a44c-fd459c3f0af9',
    'afef42ff-beed-4f0e-8acb-1cace8c691a1',
    'e09f497c-3821-4897-9200-96caeaa22e16'
);

-- Clean up any care group memberships for these deleted users
DELETE FROM public.care_group_members 
WHERE user_id IN (
    'e21ffaf6-8e90-4b57-a44c-fd459c3f0af9',
    'afef42ff-beed-4f0e-8acb-1cace8c691a1',
    'e09f497c-3821-4897-9200-96caeaa22e16'
);

-- Clean up notification preferences for these users
DELETE FROM public.notification_preferences 
WHERE user_id IN (
    'e21ffaf6-8e90-4b57-a44c-fd459c3f0af9',
    'afef42ff-beed-4f0e-8acb-1cace8c691a1',
    'e09f497c-3821-4897-9200-96caeaa22e16'
);

-- Clean up other related data
DELETE FROM public.group_access_logs 
WHERE user_id IN (
    'e21ffaf6-8e90-4b57-a44c-fd459c3f0af9',
    'afef42ff-beed-4f0e-8acb-1cace8c691a1',
    'e09f497c-3821-4897-9200-96caeaa22e16'
);

DELETE FROM public.enhanced_audit_logs 
WHERE user_id IN (
    'e21ffaf6-8e90-4b57-a44c-fd459c3f0af9',
    'afef42ff-beed-4f0e-8acb-1cace8c691a1',
    'e09f497c-3821-4897-9200-96caeaa22e16'
);

DELETE FROM public.document_access_logs 
WHERE user_id IN (
    'e21ffaf6-8e90-4b57-a44c-fd459c3f0af9',
    'afef42ff-beed-4f0e-8acb-1cace8c691a1',
    'e09f497c-3821-4897-9200-96caeaa22e16'
);