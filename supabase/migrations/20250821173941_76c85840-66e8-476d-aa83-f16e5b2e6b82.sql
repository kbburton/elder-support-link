-- Add kbburton3@gmail.com as system admin
INSERT INTO public.platform_admins (user_id, created_by_user_id, created_at)
SELECT 
  p.user_id,
  '00000000-0000-0000-0000-000000000000'::uuid, -- system
  now()
FROM public.profiles p 
WHERE p.email = 'kbburton3@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM public.platform_admins pa 
  WHERE pa.user_id = p.user_id
);

-- Add wbinport@gmail.com as group admin for David Baumgarten's care group
UPDATE public.care_group_members 
SET is_admin = true, role = 'admin'
WHERE user_id = (
  SELECT user_id FROM public.profiles WHERE email = 'wbinport@gmail.com'
)
AND group_id = (
  SELECT id FROM public.care_groups WHERE name ILIKE '%david%baumgarten%' LIMIT 1
);

-- Add kbburton3@gmail.com as group admin for Test group
UPDATE public.care_group_members 
SET is_admin = true, role = 'admin'
WHERE user_id = (
  SELECT user_id FROM public.profiles WHERE email = 'kbburton3@gmail.com'  
)
AND group_id = (
  SELECT id FROM public.care_groups WHERE name ILIKE '%test%group%' LIMIT 1
);

-- Create role promotion confirmations table
CREATE TABLE public.role_promotion_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  target_email text NOT NULL,
  promotion_type text NOT NULL CHECK (promotion_type IN ('system_admin', 'group_admin')),
  group_id uuid, -- only for group_admin promotions
  promoted_by_user_id uuid NOT NULL,
  promoted_by_email text NOT NULL,
  confirmation_token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT valid_group_for_group_admin CHECK (
    (promotion_type = 'group_admin' AND group_id IS NOT NULL) OR 
    (promotion_type = 'system_admin' AND group_id IS NULL)
  )
);

-- Enable RLS on role promotion confirmations
ALTER TABLE public.role_promotion_confirmations ENABLE ROW LEVEL SECURITY;

-- RLS policies for role promotion confirmations
CREATE POLICY "System admins can manage role promotions" 
ON public.role_promotion_confirmations 
FOR ALL 
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Group admins can manage their group promotions"
ON public.role_promotion_confirmations
FOR ALL
USING (
  promotion_type = 'group_admin' AND 
  group_id IS NOT NULL AND 
  is_user_admin_of_group(group_id)
)
WITH CHECK (
  promotion_type = 'group_admin' AND 
  group_id IS NOT NULL AND 
  is_user_admin_of_group(group_id)
);

-- Users can view their own pending confirmations
CREATE POLICY "Users can view their pending confirmations"
ON public.role_promotion_confirmations
FOR SELECT
USING (target_user_id = auth.uid());

-- Create function to confirm role promotion
CREATE OR REPLACE FUNCTION public.confirm_role_promotion(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_confirmation record;
  v_result jsonb;
BEGIN
  -- Get confirmation details
  SELECT * INTO v_confirmation
  FROM public.role_promotion_confirmations
  WHERE confirmation_token = p_token
    AND confirmed_at IS NULL
    AND expires_at > now();
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired confirmation token');
  END IF;
  
  -- Apply the role promotion
  IF v_confirmation.promotion_type = 'system_admin' THEN
    -- Add to platform_admins
    INSERT INTO public.platform_admins (user_id, created_by_user_id)
    VALUES (v_confirmation.target_user_id, v_confirmation.promoted_by_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
  ELSIF v_confirmation.promotion_type = 'group_admin' THEN
    -- Update care_group_members
    UPDATE public.care_group_members
    SET is_admin = true, role = 'admin'
    WHERE user_id = v_confirmation.target_user_id 
      AND group_id = v_confirmation.group_id;
  END IF;
  
  -- Mark confirmation as completed
  UPDATE public.role_promotion_confirmations
  SET confirmed_at = now()
  WHERE id = v_confirmation.id;
  
  -- Log the admin action
  PERFORM public.log_admin_action(
    'role_promotion_confirmed',
    v_confirmation.promotion_type,
    v_confirmation.target_user_id,
    jsonb_build_object(
      'target_email', v_confirmation.target_email,
      'group_id', v_confirmation.group_id,
      'confirmed_by', auth.uid()
    )
  );
  
  RETURN jsonb_build_object('success', true, 'promotion_type', v_confirmation.promotion_type);
END;
$$;