-- Add kbburton3@gmail.com to the David Baumgarten care group
INSERT INTO public.care_group_members (user_id, group_id, is_admin, role, relationship_to_recipient)
SELECT 
  p.user_id,
  '32628c78-93ce-4962-ad48-9226675982a3'::uuid,
  false,
  'member',
  'other_relative'
FROM public.profiles p
WHERE p.email = 'kbburton3@gmail.com'
ON CONFLICT (user_id, group_id) DO NOTHING;