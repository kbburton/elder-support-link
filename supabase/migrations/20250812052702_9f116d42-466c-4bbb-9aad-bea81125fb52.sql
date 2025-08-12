-- Create enums for contacts module
CREATE TYPE public.contact_type_enum AS ENUM ('medical', 'legal', 'family', 'friend', 'other');
CREATE TYPE public.gender_enum AS ENUM ('female', 'male', 'x_or_other', 'prefer_not_to_say');
CREATE TYPE public.emergency_type_enum AS ENUM ('medical', 'legal', 'religious', 'family', 'general');

-- Create contacts table
CREATE TABLE public.contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    care_group_id uuid REFERENCES public.care_groups(id) ON DELETE CASCADE NOT NULL,
    first_name text,
    last_name text,
    organization_name text,
    contact_type contact_type_enum NOT NULL,
    gender gender_enum,
    phone_primary text,
    phone_secondary text,
    email_personal text,
    email_work text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    postal_code text,
    photo_url text,
    preferred_contact_method text CHECK (preferred_contact_method IN ('phone', 'email', 'none')),
    preferred_contact_start_local time,
    preferred_contact_end_local time,
    preferred_contact_start_weekend_local time,
    preferred_contact_end_weekend_local time,
    preferred_contact_timezone text,
    is_emergency_contact boolean DEFAULT false,
    emergency_type emergency_type_enum,
    emergency_notes text,
    notes text,
    created_by_user_id uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CHECK (phone_primary IS NOT NULL OR email_personal IS NOT NULL OR email_work IS NOT NULL)
);

-- Create linking tables
CREATE TABLE public.contact_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
    activity_log_id uuid REFERENCES public.activity_logs(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.contact_appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
    appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.contact_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
    task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.contact_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
    document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_contacts_care_group_name ON public.contacts(care_group_id, last_name, first_name);
CREATE INDEX idx_contacts_care_group_org ON public.contacts(care_group_id, organization_name);
CREATE INDEX idx_contacts_care_group_phone ON public.contacts(care_group_id, phone_primary);
CREATE INDEX idx_contacts_care_group_email ON public.contacts(care_group_id, coalesce(email_personal,''), coalesce(email_work,''));

-- Create trigger for updated_at
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contacts
CREATE POLICY "Members can manage group contacts" 
ON public.contacts 
FOR ALL 
USING (is_user_member_of_group(care_group_id))
WITH CHECK (is_user_member_of_group(care_group_id));

-- Create RLS policies for contact_activities
CREATE POLICY "Members can manage contact activities" 
ON public.contact_activities 
FOR ALL 
USING (EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_activities.contact_id 
    AND is_user_member_of_group(c.care_group_id)
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_activities.contact_id 
    AND is_user_member_of_group(c.care_group_id)
));

-- Create RLS policies for contact_appointments
CREATE POLICY "Members can manage contact appointments" 
ON public.contact_appointments 
FOR ALL 
USING (EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_appointments.contact_id 
    AND is_user_member_of_group(c.care_group_id)
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_appointments.contact_id 
    AND is_user_member_of_group(c.care_group_id)
));

-- Create RLS policies for contact_tasks
CREATE POLICY "Members can manage contact tasks" 
ON public.contact_tasks 
FOR ALL 
USING (EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_tasks.contact_id 
    AND is_user_member_of_group(c.care_group_id)
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_tasks.contact_id 
    AND is_user_member_of_group(c.care_group_id)
));

-- Create RLS policies for contact_documents
CREATE POLICY "Members can manage contact documents" 
ON public.contact_documents 
FOR ALL 
USING (EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_documents.contact_id 
    AND is_user_member_of_group(c.care_group_id)
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_documents.contact_id 
    AND is_user_member_of_group(c.care_group_id)
));