-- Clean up orphaned records and add foreign key constraints

-- Remove orphaned task_documents records
DELETE FROM public.task_documents 
WHERE document_id NOT IN (SELECT id FROM public.documents);

-- Remove orphaned appointment_documents records  
DELETE FROM public.appointment_documents 
WHERE document_id NOT IN (SELECT id FROM public.documents);

-- Remove orphaned contact_documents records
DELETE FROM public.contact_documents 
WHERE document_id NOT IN (SELECT id FROM public.documents);

-- Now add the foreign key constraints
ALTER TABLE public.task_documents 
ADD CONSTRAINT task_documents_document_id_fkey 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE public.care_group_members 
ADD CONSTRAINT care_group_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.appointment_documents 
ADD CONSTRAINT appointment_documents_document_id_fkey 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE public.contact_documents 
ADD CONSTRAINT contact_documents_document_id_fkey 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;