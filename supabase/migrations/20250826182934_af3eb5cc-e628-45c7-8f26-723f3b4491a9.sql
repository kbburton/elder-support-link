-- Change ownership of the view from postgres to the authenticated role
-- This will ensure the view doesn't run with elevated privileges

-- Change the owner of the view to the authenticated role
ALTER VIEW public.v_group_header OWNER TO authenticated;

-- Ensure the view respects RLS by removing any excessive permissions
REVOKE ALL ON public.v_group_header FROM PUBLIC;
GRANT SELECT ON public.v_group_header TO anon, authenticated;