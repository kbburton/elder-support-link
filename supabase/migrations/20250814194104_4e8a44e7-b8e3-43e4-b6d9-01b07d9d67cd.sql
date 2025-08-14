-- Clean up duplicate profiles with same email
DELETE FROM profiles a USING profiles b 
WHERE a.user_id < b.user_id 
AND a.email = b.email;