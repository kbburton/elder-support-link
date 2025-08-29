-- Drop the conflicting policies that reference care group names instead of IDs
DROP POLICY IF EXISTS "Care group members can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Care group members can upload profile pictures" ON storage.objects;  
DROP POLICY IF EXISTS "Care group members can update profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Care group members can delete profile pictures" ON storage.objects;

-- Keep only the consistent policies that use group IDs in folder structure
-- These should already exist:
-- "Users can upload profile pictures for their groups"
-- "Users can update profile pictures for their groups" 
-- "Users can delete profile pictures for their groups"
-- "Anyone can view profile pictures" (for public viewing)

-- Ensure we have the correct policies with proper authentication checks
DROP POLICY IF EXISTS "Users can upload profile pictures for their groups" ON storage.objects;
DROP POLICY IF EXISTS "Users can update profile pictures for their groups" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete profile pictures for their groups" ON storage.objects;

-- Create clean, consistent policies
CREATE POLICY "Authenticated users can upload profile pictures for their groups"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-pictures' 
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM care_group_members cgm 
    WHERE cgm.group_id::text = (storage.foldername(name))[1]
    AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can update profile pictures for their groups"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-pictures'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM care_group_members cgm 
    WHERE cgm.group_id::text = (storage.foldername(name))[1]
    AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can delete profile pictures for their groups"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-pictures'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM care_group_members cgm 
    WHERE cgm.group_id::text = (storage.foldername(name))[1]
    AND cgm.user_id = auth.uid()
  )
);