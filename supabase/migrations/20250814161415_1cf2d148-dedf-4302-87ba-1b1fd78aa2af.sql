-- Add last_active_group_id to profiles table for tracking user's last accessed group
ALTER TABLE public.profiles 
ADD COLUMN last_active_group_id uuid REFERENCES public.care_groups(id);

-- Create group_access_logs table to track first-time access to groups
CREATE TABLE public.group_access_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.care_groups(id) ON DELETE CASCADE,
  first_accessed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id)
);

-- Enable RLS on group_access_logs
ALTER TABLE public.group_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_access_logs
CREATE POLICY "Users can view their own group access logs" 
ON public.group_access_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own group access logs" 
ON public.group_access_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to check if user has accessed a group before
CREATE OR REPLACE FUNCTION public.has_accessed_group_before(p_user_id uuid, p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_access_logs 
    WHERE user_id = p_user_id AND group_id = p_group_id
  );
$$;

-- Create function to log group access
CREATE OR REPLACE FUNCTION public.log_group_access(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.group_access_logs (user_id, group_id)
  VALUES (auth.uid(), p_group_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;
END;
$$;