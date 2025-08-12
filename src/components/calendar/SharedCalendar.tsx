import { useState, useEffect } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, isSameDay, isToday, isBefore, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarItem } from "./CalendarItem";
import { CalendarLegend } from "./CalendarLegend";
import { CalendarViews } from "./CalendarViews";
import { TaskModal } from "@/components/tasks/TaskModal";
import { AppointmentModal } from "@/components/appointments/AppointmentModal";

export interface SharedCalendarProps {
  view: 'month' | 'week' | 'day' | 'list';
  selectedDate: Date;
  onSelectedDateChange: (date: Date) => void;
  showLegend?: boolean;
  filters?: {
    category?: string;
    assigneeIds?: string[];
    status?: string;
    showCompleted?: boolean;
    showOverdueOnly?: boolean;
  };
  colorMap?: Record<string, string>;
  groupId: string;
}

interface CalendarEvent {
  id: string;
  entityType: 'appointment' | 'task';
  title: string;
  startTime?: Date;
  dueDate?: Date;
  category: string;
  status?: string;
  isCompleted: boolean;
  isOverdue: boolean;
  location?: string;
  description?: string;
  createdBy?: string;
  isRecurring?: boolean;
  primaryOwnerName?: string;
  secondaryOwnerName?: string;
}

export default function SharedCalendar({
  view,
  selectedDate,
  onSelectedDateChange,
  showLegend = true,
  filters = {},
  colorMap = {},
  groupId
}: SharedCalendarProps) {
  const [activeView, setActiveView] = useState(view);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setActiveView(view);
  }, [view]);

  // Fetch appointments
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('group_id', groupId)
        .order('date_time', { ascending: true });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch tasks with recurrence rules and owner names
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_recurrence_rules (
            id,
            pattern_type
          ),
          primary_owner:profiles!tasks_primary_owner_id_fkey(first_name, last_name),
          secondary_owner:profiles!tasks_secondary_owner_id_fkey(first_name, last_name)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Transform data into calendar events
  const calendarEvents: CalendarEvent[] = [
    ...appointments.map(apt => ({
      id: apt.id,
      entityType: 'appointment' as const,
      title: apt.description || 'Appointment',
      startTime: new Date(apt.date_time),
      category: apt.category || 'Other',
      isCompleted: false,
      isOverdue: isBefore(new Date(apt.date_time), new Date()) && !apt.outcome_notes,
      location: apt.location,
      description: apt.description,
      createdBy: apt.created_by_email
    })),
    ...tasks.map(task => ({
      id: task.id,
      entityType: 'task' as const,
      title: task.title,
      dueDate: task.due_date ? new Date(task.due_date) : undefined,
      category: task.category || 'Other',
      status: task.status,
      isCompleted: task.status === 'Completed',
      isOverdue: task.due_date && task.status !== 'Completed' ? isBefore(new Date(task.due_date), new Date()) : false,
      description: task.description,
      createdBy: task.created_by_email,
      isRecurring: task.task_recurrence_rules && task.task_recurrence_rules.length > 0,
      primaryOwnerName: task.primary_owner ? `${task.primary_owner.first_name || ''} ${task.primary_owner.last_name || ''}`.trim() : undefined,
      secondaryOwnerName: task.secondary_owner ? `${task.secondary_owner.first_name || ''} ${task.secondary_owner.last_name || ''}`.trim() : undefined
    }))
  ];

  // Apply filters
  const filteredEvents = calendarEvents.filter(event => {
    if (filters.category && event.category !== filters.category) return false;
    if (filters.status && event.status !== filters.status) return false;
    if (!filters.showCompleted && event.isCompleted) return false;
    if (filters.showOverdueOnly && !event.isOverdue) return false;
    return true;
  });


  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onSelectedDateChange(date);
    }
  };

  const handleTaskClick = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setIsTaskModalOpen(true);
    }
  };

  const handleTaskModalClose = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
    // Invalidate queries to refresh the calendar
    queryClient.invalidateQueries({ queryKey: ['tasks', groupId] });
    
    // Return focus to the last focused calendar item
    setTimeout(() => {
      const focusTarget = document.querySelector(`[data-calendar-item-id="${selectedTask?.id}"]`) as HTMLElement;
      if (focusTarget) {
        focusTarget.focus();
      }
    }, 100);
  };

  const handleItemClick = (event: any) => {
    if (event.entityType === 'task') {
      // Find the original task data
      const task = tasks.find(t => t.id === event.id);
      if (task) {
        setSelectedTask(task);
        setIsTaskModalOpen(true);
      }
    } else if (event.entityType === 'appointment') {
      // Find the original appointment data
      const appointment = appointments.find(a => a.id === event.id);
      if (appointment) {
        setSelectedAppointment(appointment);
        setIsAppointmentModalOpen(true);
      }
    }
  };

  const handleAppointmentModalClose = () => {
    setIsAppointmentModalOpen(false);
    setSelectedAppointment(null);
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
  };

  return (
    <div className="space-y-6">
      {(activeView === 'day' || view === 'day') && (
        <div className="flex items-center justify-end">
          {/* Big date picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "MMMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar 
                mode="single" 
                selected={selectedDate} 
                onSelect={handleDateSelect} 
                initialFocus 
                className={cn("p-3 pointer-events-auto")} 
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      <CalendarViews 
        view={activeView}
        selectedDate={selectedDate}
        events={filteredEvents}
        onDateChange={onSelectedDateChange}
        groupId={groupId}
        onItemClick={handleItemClick}
      />

      {showLegend && (
        <CalendarLegend 
          layout={activeView === 'month' ? 'horizontal' : 'compact'}
        />
      )}

      {/* Task Modal */}
      <TaskModal
        task={selectedTask}
        isOpen={isTaskModalOpen}
        onClose={handleTaskModalClose}
        groupId={groupId}
      />

      {/* Appointment Modal */}
      <AppointmentModal
        appointment={selectedAppointment}
        isOpen={isAppointmentModalOpen}
        onClose={handleAppointmentModalClose}
        groupId={groupId}
      />
    </div>
  );
}