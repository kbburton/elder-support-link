-- Fix RLS policies for junction tables to work properly with auth context
-- Update appointment_activities RLS policy
DROP POLICY IF EXISTS "Group members can manage appointment activities" ON appointment_activities;
CREATE POLICY "Group members can manage appointment activities" 
ON appointment_activities FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM appointments a
    JOIN care_group_members cgm ON cgm.group_id = a.group_id
    WHERE a.id = appointment_activities.appointment_id 
    AND cgm.user_id = auth.uid()
    AND a.is_deleted = false
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM appointments a
    JOIN care_group_members cgm ON cgm.group_id = a.group_id  
    WHERE a.id = appointment_activities.appointment_id
    AND cgm.user_id = auth.uid()
    AND a.is_deleted = false
  )
);

-- Update contact_activities RLS policies to be more permissive for inserts
DROP POLICY IF EXISTS "Members can insert contact activities" ON contact_activities;
CREATE POLICY "Members can insert contact activities"
ON contact_activities FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM activity_logs al
    JOIN care_group_members cgm ON cgm.group_id = al.group_id
    WHERE al.id = contact_activities.activity_log_id 
    AND al.is_deleted = false 
    AND cgm.user_id = auth.uid()
  ) AND EXISTS (
    SELECT 1 FROM contacts c
    JOIN care_group_members cgm ON cgm.group_id = c.care_group_id
    WHERE c.id = contact_activities.contact_id
    AND c.is_deleted = false
    AND cgm.user_id = auth.uid()
  )
);

-- Update task_activities to have explicit RLS policy  
DROP POLICY IF EXISTS "Group members can manage task activities" ON task_activities;
CREATE POLICY "Group members can manage task activities"
ON task_activities FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN care_group_members cgm ON cgm.group_id = t.group_id
    WHERE t.id = task_activities.task_id
    AND cgm.user_id = auth.uid()
    AND t.is_deleted = false
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks t  
    JOIN care_group_members cgm ON cgm.group_id = t.group_id
    WHERE t.id = task_activities.task_id
    AND cgm.user_id = auth.uid()  
    AND t.is_deleted = false
  )
);