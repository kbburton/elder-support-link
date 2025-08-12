-- Enable RLS on search_index table
ALTER TABLE search_index ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for search_index
CREATE POLICY "Users can view search results from their groups" 
ON search_index 
FOR SELECT 
USING (is_user_member_of_group(care_group_id));

CREATE POLICY "System can manage search index" 
ON search_index 
FOR ALL 
USING (true) 
WITH CHECK (true);