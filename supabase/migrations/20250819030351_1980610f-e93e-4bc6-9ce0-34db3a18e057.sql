-- Add missing foreign key constraints for document associations and group member profiles

-- Add foreign key constraint from task_documents to documents
ALTER TABLE public.task_documents 
ADD CONSTRAINT task_documents_document_id_fkey 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

-- Add foreign key constraint from care_group_members to profiles
ALTER TABLE public.care_group_members 
ADD CONSTRAINT care_group_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add foreign key constraint from appointment_documents to documents (if missing)
ALTER TABLE public.appointment_documents 
ADD CONSTRAINT appointment_documents_document_id_fkey 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

-- Add foreign key constraint from contact_documents to documents (if missing) 
ALTER TABLE public.contact_documents 
ADD CONSTRAINT contact_documents_document_id_fkey 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;