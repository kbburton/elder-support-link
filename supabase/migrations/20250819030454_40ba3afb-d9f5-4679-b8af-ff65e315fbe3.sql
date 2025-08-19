-- Clean up orphaned records first
DELETE FROM public.task_documents 
WHERE document_id NOT IN (SELECT id FROM public.documents);

DELETE FROM public.appointment_documents 
WHERE document_id NOT IN (SELECT id FROM public.documents);

DELETE FROM public.contact_documents 
WHERE document_id NOT IN (SELECT id FROM public.documents);

-- Add foreign key constraint for task_documents if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'task_documents_document_id_fkey' 
                   AND table_name = 'task_documents') THEN
        ALTER TABLE public.task_documents 
        ADD CONSTRAINT task_documents_document_id_fkey 
        FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint for appointment_documents if it doesn't exist  
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'appointment_documents_document_id_fkey' 
                   AND table_name = 'appointment_documents') THEN
        ALTER TABLE public.appointment_documents 
        ADD CONSTRAINT appointment_documents_document_id_fkey 
        FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint for contact_documents if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'contact_documents_document_id_fkey' 
                   AND table_name = 'contact_documents') THEN
        ALTER TABLE public.contact_documents 
        ADD CONSTRAINT contact_documents_document_id_fkey 
        FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;
    END IF;
END $$;