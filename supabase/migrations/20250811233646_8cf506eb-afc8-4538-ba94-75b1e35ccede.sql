-- Create activity_log_comments table for comment feature
CREATE TABLE public.activity_log_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_log_id UUID NOT NULL,
  comment_text TEXT NOT NULL,
  created_by_user_id UUID NOT NULL,
  created_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_log_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for activity log comments
CREATE POLICY "Members can view activity log comments"
ON public.activity_log_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM activity_logs al
    WHERE al.id = activity_log_comments.activity_log_id
    AND is_user_member_of_group(al.group_id)
  )
);

CREATE POLICY "Members can create activity log comments"
ON public.activity_log_comments
FOR INSERT
WITH CHECK (
  auth.uid() = created_by_user_id
  AND EXISTS (
    SELECT 1 FROM activity_logs al
    WHERE al.id = activity_log_comments.activity_log_id
    AND is_user_member_of_group(al.group_id)
  )
);

CREATE POLICY "Users can update their own comments"
ON public.activity_log_comments
FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own comments"
ON public.activity_log_comments
FOR DELETE
USING (auth.uid() = created_by_user_id);

-- Create trigger for updating timestamps
CREATE TRIGGER update_activity_log_comments_updated_at
BEFORE UPDATE ON public.activity_log_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();