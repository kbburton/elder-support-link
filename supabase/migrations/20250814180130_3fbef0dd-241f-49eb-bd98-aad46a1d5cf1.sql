-- Fix the get_invitation_by_token function to include invited_email
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(invitation_token text)
 RETURNS TABLE(id uuid, group_id uuid, group_name text, invited_by_email text, invited_email text, message text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    cgi.id,
    cgi.group_id,
    cg.name as group_name,
    p.email as invited_by_email,
    cgi.invited_email,
    cgi.message
  FROM care_group_invitations cgi
  JOIN care_groups cg ON cg.id = cgi.group_id
  JOIN profiles p ON p.user_id = cgi.invited_by_user_id
  WHERE cgi.token::text = invitation_token
    AND cgi.status = 'pending'
    AND cgi.expires_at > now();
$function$