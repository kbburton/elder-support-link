-- Reset lockout for phone 5037241256
UPDATE profiles 
SET phone_auth_attempts = 0, 
    phone_lockout_until = NULL 
WHERE phone = '5037241256';

-- Also check care_groups table for any lockouts
UPDATE care_groups 
SET phone_auth_attempts = 0, 
    phone_lockout_until = NULL 
WHERE recipient_phone = '5037241256';