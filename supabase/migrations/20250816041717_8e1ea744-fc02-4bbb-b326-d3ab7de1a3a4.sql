-- Re-enable RLS on care_groups now that the real issue is fixed
ALTER TABLE public.care_groups ENABLE ROW LEVEL SECURITY;