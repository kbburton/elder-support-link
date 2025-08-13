-- Add kbburton3@gmail.com as platform admin for email configuration
-- First get the user ID from auth.users, then insert into platform_admins
INSERT INTO platform_admins (user_id)
SELECT id FROM auth.users 
WHERE email = 'kbburton3@gmail.com'
ON CONFLICT (user_id) DO NOTHING;