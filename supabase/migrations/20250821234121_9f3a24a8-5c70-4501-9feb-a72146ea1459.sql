-- Create role history table to track system admin role changes
CREATE TABLE public.role_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role_type TEXT NOT NULL DEFAULT 'system_admin',
  granted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  granted_by_user_id UUID,
  revoked_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analytics data table for tracking page usage
CREATE TABLE public.analytics_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id UUID NOT NULL,
  page_path TEXT NOT NULL,
  login_time TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER,
  referrer_page TEXT,
  bounce BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE public.role_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_data ENABLE ROW LEVEL SECURITY;

-- RLS policies for role_history
CREATE POLICY "Platform admins can view role history" 
ON public.role_history 
FOR SELECT 
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Service role can manage role history" 
ON public.role_history 
FOR ALL 
USING (auth.role() = 'service_role');

-- RLS policies for analytics_data  
CREATE POLICY "Platform admins can view analytics data" 
ON public.analytics_data 
FOR SELECT 
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can insert analytics data" 
ON public.analytics_data 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_role_history_user_id ON public.role_history(user_id);
CREATE INDEX idx_role_history_granted_at ON public.role_history(granted_at);
CREATE INDEX idx_analytics_session_page ON public.analytics_data(session_id, page_path);
CREATE INDEX idx_analytics_created_at ON public.analytics_data(created_at);

-- Create function to automatically log role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Role granted
    INSERT INTO public.role_history (
      user_id, role_type, granted_at, granted_by_user_id
    ) VALUES (
      NEW.user_id, 'system_admin', NOW(), auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Role revoked - update existing record
    UPDATE public.role_history 
    SET revoked_at = NOW(), revoked_by_user_id = auth.uid(), updated_at = NOW()
    WHERE user_id = OLD.user_id 
      AND role_type = 'system_admin' 
      AND revoked_at IS NULL;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to automatically log role changes
CREATE TRIGGER platform_admin_role_changes
  AFTER INSERT OR DELETE ON public.platform_admins
  FOR EACH ROW EXECUTE FUNCTION public.log_role_change();