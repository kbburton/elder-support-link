-- Drop and recreate the get_invitation_by_token function with correct return type
DROP FUNCTION IF EXISTS public.get_invitation_by_token(uuid);

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(invitation_token uuid)
RETURNS TABLE(
    id uuid, 
    group_id uuid, 
    status text, 
    used_at timestamp with time zone, 
    expires_at timestamp with time zone,
    invited_email text,
    group_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  select 
    i.id, 
    i.group_id, 
    i.status, 
    i.used_at, 
    i.expires_at,
    i.invited_email,
    cg.name as group_name
  from public.care_group_invitations i
  left join public.care_groups cg on cg.id = i.group_id
  where i.id = invitation_token
  limit 1
$function$