-- Create care_group_invitations table
CREATE TABLE public.care_group_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.care_groups(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by_email TEXT NOT NULL,
  message TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'failed')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.care_group_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view invitations for groups they admin" 
ON public.care_group_invitations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.care_group_members cgm 
    WHERE cgm.group_id = care_group_invitations.group_id 
    AND cgm.user_id = auth.uid() 
    AND cgm.is_admin = true
  )
);

CREATE POLICY "Users can create invitations for groups they admin" 
ON public.care_group_invitations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.care_group_members cgm 
    WHERE cgm.group_id = care_group_invitations.group_id 
    AND cgm.user_id = auth.uid() 
    AND cgm.is_admin = true
  )
);

CREATE POLICY "Users can update invitations for groups they admin" 
ON public.care_group_invitations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.care_group_members cgm 
    WHERE cgm.group_id = care_group_invitations.group_id 
    AND cgm.user_id = auth.uid() 
    AND cgm.is_admin = true
  )
);

CREATE POLICY "Users can delete invitations for groups they admin" 
ON public.care_group_invitations 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.care_group_members cgm 
    WHERE cgm.group_id = care_group_invitations.group_id 
    AND cgm.user_id = auth.uid() 
    AND cgm.is_admin = true
  )
);

-- Anyone can read invitations by token (for accepting invitations)
CREATE POLICY "Anyone can read invitation by token" 
ON public.care_group_invitations 
FOR SELECT 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_care_group_invitations_updated_at
BEFORE UPDATE ON public.care_group_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_care_group_invitations_token ON public.care_group_invitations(token);
CREATE INDEX idx_care_group_invitations_group_id ON public.care_group_invitations(group_id);
CREATE INDEX idx_care_group_invitations_status ON public.care_group_invitations(status);