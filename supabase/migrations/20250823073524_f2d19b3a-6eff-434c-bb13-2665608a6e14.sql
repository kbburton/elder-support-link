-- Create the profile-pictures storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the profile-pictures bucket
-- Allow authenticated users to view all profile pictures (since bucket is public)
CREATE POLICY "Anyone can view profile pictures" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'profile-pictures');

-- Allow authenticated users to upload their own profile pictures
-- Files should be organized by group ID: profile-pictures/{group_id}/{filename}
CREATE POLICY "Users can upload profile pictures for their groups" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'profile-pictures' 
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM care_group_members cgm 
    WHERE cgm.group_id::text = (storage.foldername(name))[1]
    AND cgm.user_id = auth.uid()
  )
);

-- Allow users to update profile pictures for their groups
CREATE POLICY "Users can update profile pictures for their groups" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'profile-pictures' 
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM care_group_members cgm 
    WHERE cgm.group_id::text = (storage.foldername(name))[1]
    AND cgm.user_id = auth.uid()
  )
);

-- Allow users to delete profile pictures for their groups
CREATE POLICY "Users can delete profile pictures for their groups" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'profile-pictures' 
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM care_group_members cgm 
    WHERE cgm.group_id::text = (storage.foldername(name))[1]
    AND cgm.user_id = auth.uid()
  )
);