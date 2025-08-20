-- Add company field to contacts table for person contacts (separate from organization_name)
ALTER TABLE public.contacts 
ADD COLUMN company TEXT;

-- Add comment to clarify the difference
COMMENT ON COLUMN public.contacts.company IS 'Company field for person contacts (different from organization_name which is for org contacts)';
COMMENT ON COLUMN public.contacts.organization_name IS 'Organization name for organization-type contacts only';