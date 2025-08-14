-- Fix care_group_invitations security issue: Remove public access to email addresses
-- Drop the overly permissive policy that makes invitations publicly readable
DROP POLICY IF EXISTS "Invitations can be viewed by token" ON public.care_group_invitations;

-- Create a secure policy for invitation access
-- Only group admins and the service role can directly access invitation data
CREATE POLICY "Only authorized users can view invitations" 
ON public.care_group_invitations 
FOR SELECT 
USING (
  -- Group admins can view invitations for their groups
  (EXISTS ( 
    SELECT 1 FROM care_group_members cgm
    WHERE cgm.group_id = care_group_invitations.group_id 
    AND cgm.user_id = auth.uid() 
    AND cgm.is_admin = true
  ))
  OR
  -- Service role (edge functions) can access for invitation processing
  auth.role() = 'service_role'
);

-- Note: Public invitation access is now handled securely through the 
-- get_invitation_by_token() function which runs with SECURITY DEFINER privileges
-- This prevents direct table access while maintaining invitation functionality