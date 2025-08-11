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

-- Policies: users can manage their own preferences
create policy if not exists "Users can view their own notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert their own notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update their own notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id);

create policy if not exists "Users can delete their own notification preferences"
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

-- Minimal policies: allow members of the appointment's group to view; creators can manage
-- We need to reference appointments.group_id; expose via join in USING/ CHECK.
-- Allow select for users who are members of the appointment group
create policy if not exists "Members can view appointment notification recipients"
  on public.appointment_notification_recipients for select
  using (
    exists (
      select 1
      from public.appointments a
      join public.care_group_members cgm on cgm.group_id = a.group_id
      where a.id = appointment_id and cgm.user_id = auth.uid()
    )
  );

-- Allow insert/update/delete to the user who is creating/updating an appointment or any member; 
-- To keep it simple: any group member can manage these rows
create policy if not exists "Group members can manage appointment notification recipients"
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
