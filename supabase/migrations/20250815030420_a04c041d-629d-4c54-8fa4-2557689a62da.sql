-- One-time nonce used between the "begin" and "finalize" steps
create table if not exists public.invitation_nonces (
  nonce uuid primary key,
  invitation_id uuid not null
    references public.care_group_invitations(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

-- Lock it down: functions will use the Service Role and bypass RLS
alter table public.invitation_nonces enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'invitation_nonces'
      and policyname = 'deny all invitation_nonces'
  ) then
    create policy "deny all invitation_nonces"
      on public.invitation_nonces
      for all
      using (false)
      with check (false);
  end if;
end$$;