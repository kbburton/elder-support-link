-- Create RPC function to accept invitation by token directly
CREATE OR REPLACE FUNCTION public.accept_invitation_by_token(invitation_token UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    invitation_record RECORD;
    group_uuid UUID;
    user_uuid UUID;
BEGIN
    -- Get current user
    SELECT auth.uid() INTO user_uuid;
    
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    -- Get invitation details and verify it's valid
    SELECT id, group_id, invited_email, status, expires_at
    INTO invitation_record
    FROM public.care_group_invitations
    WHERE token = invitation_token
    AND status = 'pending'
    AND expires_at > NOW();

    -- Check if invitation exists and is valid
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invitation';
    END IF;

    -- Get user's email for verification
    SELECT raw_user_meta_data->>'email' INTO group_uuid
    FROM auth.users
    WHERE id = user_uuid;

    -- Optional: Verify email matches (uncomment if needed)
    -- IF invitation_record.invited_email != group_uuid THEN
    --     RAISE EXCEPTION 'Email does not match invitation';
    -- END IF;

    -- Check if user is already a member
    IF EXISTS (
        SELECT 1 FROM public.care_group_members
        WHERE group_id = invitation_record.group_id
        AND user_id = user_uuid
    ) THEN
        -- User already a member, just return the group ID
        RETURN invitation_record.group_id;
    END IF;

    -- Add user to the group
    INSERT INTO public.care_group_members (group_id, user_id, is_admin)
    VALUES (invitation_record.group_id, user_uuid, false);

    -- Mark invitation as accepted
    UPDATE public.care_group_invitations
    SET status = 'accepted',
        accepted_at = NOW(),
        accepted_by_user_id = user_uuid
    WHERE id = invitation_record.id;

    -- Update user's last active group
    INSERT INTO public.profiles (user_id, last_active_group_id)
    VALUES (user_uuid, invitation_record.group_id)
    ON CONFLICT (user_id)
    DO UPDATE SET last_active_group_id = invitation_record.group_id;

    -- Return the group ID
    RETURN invitation_record.group_id;
END;
$$;