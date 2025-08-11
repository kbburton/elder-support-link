-- Fix previous error by removing IF NOT EXISTS from CREATE POLICY statements
-- 1) Notification preferences per user per group
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  group_id uuid not null,
  notify_on_new_task boolean not null default false,
  notify_on_new_appointment boolean not null default false,
  notify_on_new_document boolean not null default false,
  notify_on_new_activity_log boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, group_id)
);

alter table public.notification_preferences enable row level security;

create policy "Users can view their own notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id);

create policy "Users can delete their own notification preferences"
  on public.notification_preferences for delete
  using (auth.uid() = user_id);

-- 2) Appointment notification recipients mapping
create table if not exists public.appointment_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null,
  user_id uuid not null,
  days_before integer not null check (days_before in (1,3)),
  created_at timestamptz not null default now()
);

alter table public.appointment_notification_recipients enable row level security;

create policy "Members can view appointment notification recipients"
  on public.appointment_notification_recipients for select
  using (
    exists (
      select 1
      from public.appointments a
      join public.care_group_members cgm on cgm.group_id = a.group_id
      where a.id = appointment_id and cgm.user_id = auth.uid()
    )
  );

create policy "Group members can manage appointment notification recipients"
  on public.appointment_notification_recipients for all
  using (
    exists (
      select 1
      from public.appointments a
      join public.care_group_members cgm on cgm.group_id = a.group_id
      where a.id = appointment_id and cgm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.appointments a
      join public.care_group_members cgm on cgm.group_id = a.group_id
      where a.id = appointment_id and cgm.user_id = auth.uid()
    )
  );

-- 3) Timestamp trigger for updated_at on notification_preferences
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

-- 4) Add email to profiles for notifications
alter table public.profiles add column if not exists email text;

-- 5) Optional: schedule appointment reminder runner hourly (requires pg_cron and pg_net)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Create or replace the schedule
select cron.schedule(
  'notify-appointment-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://yfwgegapmggwywrnzqvg.functions.supabase.co/notify',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmd2dlZ2FwbWdnd3l3cm56cXZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTAwMjUsImV4cCI6MjA3MDQ2NjAyNX0.YZWYq0S020M_ZPKQoarcz9LczAI_nEk4b3BbCLnSaWs"}'::jsonb,
    body := '{"type": "appointment-reminders"}'::jsonb
  );
  $$
);
