-- Create RPC function to get invitation by token
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(invitation_token text)
RETURNS TABLE (
  id uuid,
  group_id uuid,
  group_name text,
  invited_by_email text,
  message text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    cgi.id,
    cgi.group_id,
    cg.name as group_name,
    p.email as invited_by_email,
    cgi.message
  FROM care_group_invitations cgi
  JOIN care_groups cg ON cg.id = cgi.group_id
  JOIN profiles p ON p.user_id = cgi.invited_by_user_id
  WHERE cgi.token::text = invitation_token
    AND cgi.status = 'pending'
    AND cgi.expires_at > now();
$$;

-- Create RPC function to accept invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_id uuid, user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE care_group_invitations 
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by_user_id = user_id
  WHERE id = invitation_id;
$$;