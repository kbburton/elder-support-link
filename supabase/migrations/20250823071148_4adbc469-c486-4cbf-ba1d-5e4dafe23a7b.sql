-- Add gender and profile_picture_url fields to care_groups table
ALTER TABLE public.care_groups 
ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female', 'other')),
ADD COLUMN profile_picture_url TEXT;

-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile-pictures', 'profile-pictures', true);

-- Create RLS policies for profile pictures bucket
CREATE POLICY "Care group members can view profile pictures" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'profile-pictures' AND
  EXISTS (
    SELECT 1 FROM care_groups cg 
    JOIN care_group_members cgm ON cgm.group_id = cg.id 
    WHERE cg.id::text = (storage.foldername(name))[1] 
    AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Care group members can upload profile pictures" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  EXISTS (
    SELECT 1 FROM care_groups cg 
    JOIN care_group_members cgm ON cgm.group_id = cg.id 
    WHERE cg.id::text = (storage.foldername(name))[1] 
    AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Care group members can update profile pictures" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'profile-pictures' AND
  EXISTS (
    SELECT 1 FROM care_groups cg 
    JOIN care_group_members cgm ON cgm.group_id = cg.id 
    WHERE cg.id::text = (storage.foldername(name))[1] 
    AND cgm.user_id = auth.uid()
  )
);

CREATE POLICY "Care group members can delete profile pictures" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'profile-pictures' AND
  EXISTS (
    SELECT 1 FROM care_groups cg 
    JOIN care_group_members cgm ON cgm.group_id = cg.id 
    WHERE cg.id::text = (storage.foldername(name))[1] 
    AND cgm.user_id = auth.uid()
  )
);