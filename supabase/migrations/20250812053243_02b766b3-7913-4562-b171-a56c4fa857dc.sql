-- Drop existing policies to recreate them with stricter access control
DROP POLICY IF EXISTS "Members can manage group contacts" ON public.contacts;
DROP POLICY IF EXISTS "Members can manage contact activities" ON public.contact_activities;
DROP POLICY IF EXISTS "Members can manage contact appointments" ON public.contact_appointments;
DROP POLICY IF EXISTS "Members can manage contact tasks" ON public.contact_tasks;
DROP POLICY IF EXISTS "Members can manage contact documents" ON public.contact_documents;

-- Create strict RLS policies for contacts table
-- Members can view, insert, and update contacts in their care group
CREATE POLICY "Members can view group contacts" 
ON public.contacts 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.care_group_members cgm 
        WHERE cgm.care_group_id = contacts.care_group_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can insert group contacts" 
ON public.contacts 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.care_group_members cgm 
        WHERE cgm.care_group_id = contacts.care_group_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can update group contacts" 
ON public.contacts 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.care_group_members cgm 
        WHERE cgm.care_group_id = contacts.care_group_id 
        AND cgm.user_id = auth.uid()
    )
);

-- Only group admins can delete contacts
CREATE POLICY "Admins can delete group contacts" 
ON public.contacts 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.care_group_members cgm 
        WHERE cgm.care_group_id = contacts.care_group_id 
        AND cgm.user_id = auth.uid()
        AND cgm.is_admin = true
    )
);

-- Create strict RLS policies for contact_activities
-- Access control via activity_logs.care_group_id
CREATE POLICY "Members can view contact activities" 
ON public.contact_activities 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.activity_logs al
        JOIN public.care_group_members cgm ON cgm.care_group_id = al.group_id
        WHERE al.id = contact_activities.activity_log_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can insert contact activities" 
ON public.contact_activities 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.activity_logs al
        JOIN public.care_group_members cgm ON cgm.care_group_id = al.group_id
        WHERE al.id = contact_activities.activity_log_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can update contact activities" 
ON public.contact_activities 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.activity_logs al
        JOIN public.care_group_members cgm ON cgm.care_group_id = al.group_id
        WHERE al.id = contact_activities.activity_log_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can delete contact activities" 
ON public.contact_activities 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.activity_logs al
        JOIN public.care_group_members cgm ON cgm.care_group_id = al.group_id
        WHERE al.id = contact_activities.activity_log_id 
        AND cgm.user_id = auth.uid()
    )
);

-- Create strict RLS policies for contact_appointments
-- Access control via appointments.group_id
CREATE POLICY "Members can view contact appointments" 
ON public.contact_appointments 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.appointments a
        JOIN public.care_group_members cgm ON cgm.care_group_id = a.group_id
        WHERE a.id = contact_appointments.appointment_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can insert contact appointments" 
ON public.contact_appointments 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.appointments a
        JOIN public.care_group_members cgm ON cgm.care_group_id = a.group_id
        WHERE a.id = contact_appointments.appointment_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can update contact appointments" 
ON public.contact_appointments 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.appointments a
        JOIN public.care_group_members cgm ON cgm.care_group_id = a.group_id
        WHERE a.id = contact_appointments.appointment_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can delete contact appointments" 
ON public.contact_appointments 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.appointments a
        JOIN public.care_group_members cgm ON cgm.care_group_id = a.group_id
        WHERE a.id = contact_appointments.appointment_id 
        AND cgm.user_id = auth.uid()
    )
);

-- Create strict RLS policies for contact_tasks
-- Access control via tasks.group_id
CREATE POLICY "Members can view contact tasks" 
ON public.contact_tasks 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.tasks t
        JOIN public.care_group_members cgm ON cgm.care_group_id = t.group_id
        WHERE t.id = contact_tasks.task_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can insert contact tasks" 
ON public.contact_tasks 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tasks t
        JOIN public.care_group_members cgm ON cgm.care_group_id = t.group_id
        WHERE t.id = contact_tasks.task_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can update contact tasks" 
ON public.contact_tasks 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.tasks t
        JOIN public.care_group_members cgm ON cgm.care_group_id = t.group_id
        WHERE t.id = contact_tasks.task_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can delete contact tasks" 
ON public.contact_tasks 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.tasks t
        JOIN public.care_group_members cgm ON cgm.care_group_id = t.group_id
        WHERE t.id = contact_tasks.task_id 
        AND cgm.user_id = auth.uid()
    )
);

-- Create strict RLS policies for contact_documents
-- Access control via documents.group_id
CREATE POLICY "Members can view contact documents" 
ON public.contact_documents 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.documents d
        JOIN public.care_group_members cgm ON cgm.care_group_id = d.group_id
        WHERE d.id = contact_documents.document_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can insert contact documents" 
ON public.contact_documents 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.documents d
        JOIN public.care_group_members cgm ON cgm.care_group_id = d.group_id
        WHERE d.id = contact_documents.document_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can update contact documents" 
ON public.contact_documents 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.documents d
        JOIN public.care_group_members cgm ON cgm.care_group_id = d.group_id
        WHERE d.id = contact_documents.document_id 
        AND cgm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can delete contact documents" 
ON public.contact_documents 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.documents d
        JOIN public.care_group_members cgm ON cgm.care_group_id = d.group_id
        WHERE d.id = contact_documents.document_id 
        AND cgm.user_id = auth.uid()
    )
);