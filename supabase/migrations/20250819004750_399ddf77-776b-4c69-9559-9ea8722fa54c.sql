-- Create junction tables for appointment-task and appointment-activity associations

-- Appointment-Task junction table
CREATE TABLE public.appointment_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_user_id UUID,
  UNIQUE(appointment_id, task_id)
);

-- Appointment-Activity junction table
CREATE TABLE public.appointment_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  activity_log_id UUID NOT NULL REFERENCES public.activity_logs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_user_id UUID,
  UNIQUE(appointment_id, activity_log_id)
);

-- Task-Activity junction table
CREATE TABLE public.task_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  activity_log_id UUID NOT NULL REFERENCES public.activity_logs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_user_id UUID,
  UNIQUE(task_id, activity_log_id)
);

-- Enable RLS on the new tables
ALTER TABLE public.appointment_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for appointment_tasks
CREATE POLICY "Group members can manage appointment tasks" ON public.appointment_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.appointments a 
      JOIN public.care_group_members cgm ON cgm.group_id = a.group_id
      WHERE a.id = appointment_tasks.appointment_id AND cgm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments a 
      JOIN public.care_group_members cgm ON cgm.group_id = a.group_id
      WHERE a.id = appointment_tasks.appointment_id AND cgm.user_id = auth.uid()
    )
  );

-- Create RLS policies for appointment_activities
CREATE POLICY "Group members can manage appointment activities" ON public.appointment_activities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.appointments a 
      JOIN public.care_group_members cgm ON cgm.group_id = a.group_id
      WHERE a.id = appointment_activities.appointment_id AND cgm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments a 
      JOIN public.care_group_members cgm ON cgm.group_id = a.group_id
      WHERE a.id = appointment_activities.appointment_id AND cgm.user_id = auth.uid()
    )
  );

-- Create RLS policies for task_activities
CREATE POLICY "Group members can manage task activities" ON public.task_activities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.care_group_members cgm ON cgm.group_id = t.group_id
      WHERE t.id = task_activities.task_id AND cgm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.care_group_members cgm ON cgm.group_id = t.group_id
      WHERE t.id = task_activities.task_id AND cgm.user_id = auth.uid()
    )
  );