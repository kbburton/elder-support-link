-- Create enums for feedback system
CREATE TYPE public.feedback_type_enum AS ENUM ('defect', 'feature');
CREATE TYPE public.feedback_status_enum AS ENUM ('open', 'in_progress', 'resolved', 'closed', 'duplicate', 'wontfix');
CREATE TYPE public.feedback_severity_enum AS ENUM ('low', 'medium', 'high', 'critical');

-- Create feedback_items table
CREATE TABLE public.feedback_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_group_id uuid NULL REFERENCES public.care_groups(id) ON DELETE SET NULL,
  type public.feedback_type_enum NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  steps_to_reproduce text NULL,
  expected_result text NULL,
  actual_result text NULL,
  severity public.feedback_severity_enum NOT NULL DEFAULT 'medium',
  status public.feedback_status_enum NOT NULL DEFAULT 'open',
  created_by_user_id uuid NOT NULL,
  created_by_email text NOT NULL,
  assigned_to_user_id uuid NULL,
  attachments jsonb NULL,
  votes int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create feedback_comments table
CREATE TABLE public.feedback_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback_items(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by_user_id uuid NOT NULL,
  created_by_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_feedback_items_group_status_severity_created ON public.feedback_items(care_group_id, status, severity, created_at);
CREATE INDEX idx_feedback_items_created_by ON public.feedback_items(created_by_user_id);
CREATE INDEX idx_feedback_comments_feedback_created ON public.feedback_comments(feedback_id, created_at);

-- Create updated_at trigger for feedback_items
CREATE TRIGGER update_feedback_items_updated_at
  BEFORE UPDATE ON public.feedback_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on both tables
ALTER TABLE public.feedback_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for feedback_items
-- Users can create feedback items
CREATE POLICY "Users can create feedback items"
  ON public.feedback_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

-- Users can view all feedback items (feedback should be visible to all users for transparency)
CREATE POLICY "Users can view all feedback items"
  ON public.feedback_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own feedback items, or system admins can update any
CREATE POLICY "Users can update their own feedback or admins can update any"
  ON public.feedback_items
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by_user_id 
    OR is_system_admin(auth.uid())
  );

-- Only system admins can delete feedback items
CREATE POLICY "System admins can delete feedback items"
  ON public.feedback_items
  FOR DELETE
  TO authenticated
  USING (is_system_admin(auth.uid()));

-- RLS policies for feedback_comments
-- Users can create comments on feedback items
CREATE POLICY "Users can create feedback comments"
  ON public.feedback_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

-- Users can view all comments (transparency)
CREATE POLICY "Users can view all feedback comments"
  ON public.feedback_comments
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own comments, or system admins can update any
CREATE POLICY "Users can update their own comments or admins can update any"
  ON public.feedback_comments
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by_user_id 
    OR is_system_admin(auth.uid())
  );

-- Users can delete their own comments, or system admins can delete any
CREATE POLICY "Users can delete their own comments or admins can delete any"
  ON public.feedback_comments
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by_user_id 
    OR is_system_admin(auth.uid())
  );