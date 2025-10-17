-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job to check for scheduled interviews every 2 minutes
SELECT cron.schedule(
  'initiate-scheduled-interviews',
  '*/2 * * * *', -- Every 2 minutes
  $$
  SELECT
    net.http_post(
        url:='https://yfwgegapmggwywrnzqvg.supabase.co/functions/v1/initiate-scheduled-interviews',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmd2dlZ2FwbWdnd3l3cm56cXZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTAwMjUsImV4cCI6MjA3MDQ2NjAyNX0.YZWYq0S020M_ZPKQoarcz9LczAI_nEk4b3BbCLnSaWs"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);