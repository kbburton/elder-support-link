-- Phase 1: Documents V2 - Database Schema & Configuration (Fixed v2)

-- Document Categories (hierarchical structure)
CREATE TABLE IF NOT EXISTS public.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  parent_id uuid REFERENCES public.document_categories(id) ON DELETE CASCADE,
  care_group_id uuid REFERENCES public.care_groups(id) ON DELETE CASCADE,
  is_default boolean DEFAULT false NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  created_by_user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT unique_category_name_per_group UNIQUE (name, care_group_id, parent_id)
);

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

-- Document Tags (flexible metadata)
CREATE TABLE IF NOT EXISTS public.document_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text,
  care_group_id uuid REFERENCES public.care_groups(id) ON DELETE CASCADE NOT NULL,
  created_by_user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT unique_tag_name_per_group UNIQUE (name, care_group_id)
);

ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;

-- Document-Tag Junction Table
CREATE TABLE IF NOT EXISTS public.document_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES public.document_tags(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT unique_document_tag UNIQUE (document_id, tag_id)
);

ALTER TABLE public.document_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Document Versions (version control)
CREATE TABLE IF NOT EXISTS public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  file_type text,
  notes text,
  created_by_user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT unique_document_version UNIQUE (document_id, version_number)
);

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- Add new columns to existing documents table
ALTER TABLE public.documents 
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.document_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_shared_with_group boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS current_version integer DEFAULT 1 NOT NULL;

-- RLS Policies for document_categories
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'document_categories' AND policyname = 'Group members can view categories'
  ) THEN
    CREATE POLICY "Group members can view categories"
      ON public.document_categories
      FOR SELECT
      USING (
        care_group_id IS NULL OR
        is_user_member_of_group(care_group_id)
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'document_categories' AND policyname = 'Admins can manage categories'
  ) THEN
    CREATE POLICY "Admins can manage categories"
      ON public.document_categories
      FOR ALL
      USING (
        (care_group_id IS NULL AND is_platform_admin(auth.uid())) OR
        (care_group_id IS NOT NULL AND is_user_admin_of_group(care_group_id))
      )
      WITH CHECK (
        (care_group_id IS NULL AND is_platform_admin(auth.uid())) OR
        (care_group_id IS NOT NULL AND is_user_admin_of_group(care_group_id))
      );
  END IF;
END $$;

-- RLS Policies for document_tags
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'document_tags' AND policyname = 'Group members can view tags'
  ) THEN
    CREATE POLICY "Group members can view tags"
      ON public.document_tags
      FOR SELECT
      USING (is_user_member_of_group(care_group_id));
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'document_tags' AND policyname = 'Admins can manage tags'
  ) THEN
    CREATE POLICY "Admins can manage tags"
      ON public.document_tags
      FOR ALL
      USING (is_user_admin_of_group(care_group_id))
      WITH CHECK (is_user_admin_of_group(care_group_id));
  END IF;
END $$;

-- RLS Policies for document_tag_assignments
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'document_tag_assignments' AND policyname = 'Users can view document tags'
  ) THEN
    CREATE POLICY "Users can view document tags"
      ON public.document_tag_assignments
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.id = document_tag_assignments.document_id
          AND (
            d.uploaded_by_user_id = auth.uid() OR
            (d.is_shared_with_group = true AND is_user_member_of_group(d.group_id))
          )
        )
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'document_tag_assignments' AND policyname = 'Document owners can manage tags'
  ) THEN
    CREATE POLICY "Document owners can manage tags"
      ON public.document_tag_assignments
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.id = document_tag_assignments.document_id
          AND d.uploaded_by_user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.id = document_tag_assignments.document_id
          AND d.uploaded_by_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- RLS Policies for document_versions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'document_versions' AND policyname = 'Users can view document versions'
  ) THEN
    CREATE POLICY "Users can view document versions"
      ON public.document_versions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.id = document_versions.document_id
          AND (
            d.uploaded_by_user_id = auth.uid() OR
            (d.is_shared_with_group = true AND is_user_member_of_group(d.group_id))
          )
        )
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'document_versions' AND policyname = 'Document owners can create versions'
  ) THEN
    CREATE POLICY "Document owners can create versions"
      ON public.document_versions
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.id = document_versions.document_id
          AND d.uploaded_by_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Helper function to validate category hierarchy limits
CREATE OR REPLACE FUNCTION public.validate_category_limits()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  custom_category_count integer;
  subgroup_count integer;
BEGIN
  IF NEW.parent_id IS NULL AND NOT NEW.is_default THEN
    SELECT COUNT(*) INTO custom_category_count
    FROM public.document_categories
    WHERE care_group_id = NEW.care_group_id
    AND parent_id IS NULL
    AND is_default = false
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF custom_category_count >= 10 THEN
      RAISE EXCEPTION 'Maximum of 10 custom categories allowed per care group';
    END IF;
  END IF;
  
  IF NEW.parent_id IS NOT NULL THEN
    SELECT COUNT(*) INTO subgroup_count
    FROM public.document_categories
    WHERE parent_id = NEW.parent_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF subgroup_count >= 20 THEN
      RAISE EXCEPTION 'Maximum of 20 subgroups allowed per category';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_category_limits_trigger ON public.document_categories;
CREATE TRIGGER validate_category_limits_trigger
  BEFORE INSERT OR UPDATE ON public.document_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_category_limits();

-- Insert default app setting for documents v2 feature flag
INSERT INTO public.app_settings (key, value)
VALUES ('documents_v2_enabled_for_all', 'false')
ON CONFLICT (key) DO NOTHING;

-- Insert default document categories
INSERT INTO public.document_categories (name, description, is_default, display_order, created_by_user_id, care_group_id)
VALUES
  ('Medical Records', 'Medical documents, lab results, prescriptions', true, 1, '00000000-0000-0000-0000-000000000000'::uuid, NULL),
  ('Legal Documents', 'Wills, power of attorney, legal agreements', true, 2, '00000000-0000-0000-0000-000000000000'::uuid, NULL),
  ('Financial', 'Insurance policies, bank statements, financial records', true, 3, '00000000-0000-0000-0000-000000000000'::uuid, NULL),
  ('Personal Care', 'Care plans, medication schedules, dietary information', true, 4, '00000000-0000-0000-0000-000000000000'::uuid, NULL),
  ('General', 'Miscellaneous documents', true, 5, '00000000-0000-0000-0000-000000000000'::uuid, NULL)
ON CONFLICT DO NOTHING;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_categories_group ON public.document_categories(care_group_id);
CREATE INDEX IF NOT EXISTS idx_document_categories_parent ON public.document_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_group ON public.document_tags(care_group_id);
CREATE INDEX IF NOT EXISTS idx_document_tag_assignments_document ON public.document_tag_assignments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tag_assignments_tag ON public.document_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_document ON public.document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON public.documents(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_documents_shared ON public.documents(is_shared_with_group, group_id) WHERE is_shared_with_group = true;