-- Fix Nathan's care group membership with relationship
INSERT INTO public.care_group_members (group_id, user_id, role, is_admin, relationship_to_recipient)
VALUES (
  '32628c78-93ce-4962-ad48-9226675982a3',
  '20c12f18-4d13-4f0f-8e93-4ba2be9235bf', 
  'member',
  false,
  'child'
)
ON CONFLICT (group_id, user_id) 
DO UPDATE SET relationship_to_recipient = 'child';

-- Update the invitation to mark it as used
UPDATE public.care_group_invitations 
SET used_at = now(), 
    accepted_by = '20c12f18-4d13-4f0f-8e93-4ba2be9235bf',
    status = 'used'
WHERE invited_email = 'nathan.2.burton@gmail.com' 
  AND group_id = '32628c78-93ce-4962-ad48-9226675982a3'
  AND status = 'pending';

-- Update the accept_invitation function to include a default relationship
CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_id uuid, p_relationship_to_recipient text DEFAULT 'family_member')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_group_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Validate the invitation is still usable
  select i.group_id
    into v_group_id
  from public.care_group_invitations i
  where i.id = invitation_id
    and i.used_at is null
    and coalesce(i.expires_at, now() + interval '100 years') > now()
  limit 1;

  if v_group_id is null then
    raise exception 'invalid_or_expired';
  end if;

  -- Add membership (idempotent) with relationship
  insert into public.care_group_members (group_id, user_id, role, is_admin, relationship_to_recipient)
  values (v_group_id, v_uid, 'member', false, p_relationship_to_recipient)
  on conflict (group_id, user_id) do nothing;

  -- Mark invitation as used
  update public.care_group_invitations
  set used_at = now(), accepted_by = v_uid, status = 'used'
  where id = invitation_id;

  return v_group_id;
end;
$function$;