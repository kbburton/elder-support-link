-- Update accept_invitation function to only require invitation_id and get user_id from auth.uid()
CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    invitation_record care_group_invitations;
    current_user_id uuid;
    current_user_email text;
BEGIN
    -- Get current authenticated user
    current_user_id := auth.uid();
    if current_user_id is null then
        raise exception 'Not authenticated';
    end if;
    
    -- Get user email from profiles
    SELECT email INTO current_user_email
    FROM profiles 
    WHERE user_id = current_user_id;
    
    -- Get invitation details and validate
    SELECT * INTO invitation_record
    FROM care_group_invitations 
    WHERE id = invitation_id
        AND status = 'pending'
        AND expires_at > now();
    
    if not found then
        raise exception 'Invalid or expired invitation';
    end if;
    
    -- Check if user email matches invitation
    if current_user_email != invitation_record.invited_email then
        raise exception 'Email does not match invitation';
    end if;
    
    -- Check if user is already a member
    if exists(
        select 1 from care_group_members 
        where group_id = invitation_record.group_id 
        and user_id = current_user_id
    ) then
        -- Already a member, just mark invitation as accepted and return group
        UPDATE care_group_invitations 
        SET status = 'accepted', 
            accepted_by_user_id = current_user_id,
            accepted_at = now()
        WHERE id = invitation_id;
        
        return invitation_record.group_id;
    end if;
    
    -- Add user to group
    INSERT INTO care_group_members (group_id, user_id, role, is_admin)
    VALUES (invitation_record.group_id, current_user_id, 'member', false);
    
    -- Mark invitation as accepted
    UPDATE care_group_invitations 
    SET status = 'accepted', 
        accepted_by_user_id = current_user_id,
        accepted_at = now()
    WHERE id = invitation_id;
    
    return invitation_record.group_id;
END;
$function$;