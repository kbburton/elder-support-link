-- Create task recurrence rules table
CREATE TABLE public.task_recurrence_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  interval_value INTEGER NOT NULL DEFAULT 1 CHECK (interval_value > 0),
  
  -- Weekly pattern: days of week (0=Sunday, 1=Monday, etc.)
  weekly_days INTEGER[] DEFAULT NULL,
  
  -- Monthly pattern: either day of month or nth weekday
  monthly_day_of_month INTEGER DEFAULT NULL CHECK (monthly_day_of_month BETWEEN 1 AND 31),
  monthly_nth_weekday INTEGER DEFAULT NULL CHECK (monthly_nth_weekday BETWEEN 1 AND 5), -- 1st, 2nd, 3rd, 4th, 5th
  monthly_weekday INTEGER DEFAULT NULL CHECK (monthly_weekday BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  
  -- Yearly pattern: specific date
  yearly_month INTEGER DEFAULT NULL CHECK (yearly_month BETWEEN 1 AND 12),
  yearly_day INTEGER DEFAULT NULL CHECK (yearly_day BETWEEN 1 AND 31),
  
  -- End conditions
  end_type TEXT NOT NULL DEFAULT 'never' CHECK (end_type IN ('never', 'after_occurrences', 'until_date')),
  end_after_occurrences INTEGER DEFAULT NULL CHECK (end_after_occurrences > 0),
  end_until_date DATE DEFAULT NULL,
  
  -- Tracking
  created_occurrences INTEGER NOT NULL DEFAULT 1,
  last_occurrence_date DATE DEFAULT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_user_id UUID NOT NULL,
  group_id UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.task_recurrence_rules ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Members can manage group task recurrence rules" 
ON public.task_recurrence_rules 
FOR ALL 
USING (is_user_member_of_group(group_id))
WITH CHECK (is_user_member_of_group(group_id));

-- Create index for efficient queries
CREATE INDEX idx_task_recurrence_rules_task_id ON public.task_recurrence_rules(task_id);
CREATE INDEX idx_task_recurrence_rules_group_id ON public.task_recurrence_rules(group_id);

-- Add updated_at trigger
CREATE TRIGGER update_task_recurrence_rules_updated_at
BEFORE UPDATE ON public.task_recurrence_rules
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();