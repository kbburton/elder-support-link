-- Create profiles table to store user registration details
create table if not exists public.profiles (
  user_id uuid primary key,
  address text,
  state text,
  zip text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Policies: owner can read/write their own profile
create policy "Profiles are viewable by owner"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Profiles can be inserted by owner"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Profiles can be updated by owner"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Profiles can be deleted by owner"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Timestamp trigger for updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.update_updated_at_column();