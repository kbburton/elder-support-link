-- Add kbburton3@hotmail.com to the David Baumgarten care group
INSERT INTO care_group_members (user_id, group_id, relationship_to_recipient, is_admin)
VALUES (
  '4c14e670-2d60-46aa-9dac-d35de25688c4',
  '32628c78-93ce-4962-ad48-9226675982a3',
  'family',
  false
) ON CONFLICT (user_id, group_id) DO NOTHING;

-- Update their last active group
UPDATE profiles 
SET last_active_group_id = '32628c78-93ce-4962-ad48-9226675982a3'
WHERE user_id = '4c14e670-2d60-46aa-9dac-d35de25688c4';