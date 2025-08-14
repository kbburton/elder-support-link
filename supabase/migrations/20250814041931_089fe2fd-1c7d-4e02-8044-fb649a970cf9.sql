-- Create demo sessions table for tracking
CREATE TABLE public.demo_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_accessed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_count INTEGER NOT NULL DEFAULT 1
);

-- Create demo analytics table for page tracking
CREATE TABLE public.demo_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES demo_sessions(id),
  page_path TEXT NOT NULL,
  entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies for demo sessions (public access needed for demo)
CREATE POLICY "Demo sessions are publicly accessible" 
ON public.demo_sessions 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Demo analytics are publicly accessible" 
ON public.demo_analytics 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_demo_sessions_email ON demo_sessions(email);
CREATE INDEX idx_demo_analytics_session_id ON demo_analytics(session_id);
CREATE INDEX idx_demo_analytics_page_path ON demo_analytics(page_path);

-- Create unique constraint to prevent duplicate emails
CREATE UNIQUE INDEX idx_demo_sessions_unique_email ON demo_sessions(email);