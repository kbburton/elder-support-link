-- Create system_logs table for enhanced logging
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
  message text NOT NULL,
  component text NOT NULL,
  operation text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Platform admins can view system logs"
  ON public.system_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "Service role can insert system logs"
  ON public.system_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Create index for performance
CREATE INDEX idx_system_logs_created_at ON public.system_logs (created_at DESC);
CREATE INDEX idx_system_logs_level ON public.system_logs (level);
CREATE INDEX idx_system_logs_component ON public.system_logs (component);