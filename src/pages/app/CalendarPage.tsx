import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Plus, Upload, List, Calendar, CalendarClock, Clock, CheckSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isSameDay, isSameWeek, isBefore, addWeeks, startOfWeek, addDays, parseISO, compareAsc, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, subMonths, addMonths, isToday, isAfter } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import MonthlyOverview from "@/components/calendar/MonthlyOverview";
import { TaskAppointmentDocumentLinker } from "@/components/documents/TaskAppointmentDocumentLinker";

type Appointment = {
  id: string;
  date_time: string; // ISO
  location: string | null;
  category: string | null;
  description: string | null;
  attending_user_id: string | null;
  group_id: string | null;
  outcome_notes: string | null;
  reminder_days_before: number | null;
  created_by_user_id: string | null;
  created_by_email: string | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null; // ISO date
  category: string | null;
  status: string;
  created_by_user_id: string | null;
  created_by_email: string | null;
  group_id: string | null;
  completed_at: string | null;
};

type CalendarItem = {
  id: string;
  type: "appointment" | "task";
  title: string;
  date: string; // ISO date
  category: string | null;
  status?: string; // for tasks
  time?: string; // for appointments
  location?: string | null;
  created_by_email?: string | null;
  completed_at?: string | null;
};

const CATEGORIES = ["Medical", "Financial/Legal", "Personal/Social", "Other"] as const;

type Category = typeof CATEGORIES[number];

const categoryToToken: Record<Category, { badgeVariant: "default" | "secondary" | "outline"; dotClass: string }> = {
  "Medical": { badgeVariant: "default", dotClass: "bg-primary" },
  "Financial/Legal": { badgeVariant: "secondary", dotClass: "bg-accent" },
  "Personal/Social": { badgeVariant: "outline", dotClass: "bg-muted-foreground" },
  "Other": { badgeVariant: "outline", dotClass: "bg-border" },
};

const CalendarPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { groupId = "demo" } = useParams();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [activeView, setActiveView] = useState<"month" | "week" | "day" | "list">("month");
  const [categoryFilter, setCategoryFilter] = useState<"all" | Category>("all");
  const [focusedDate, setFocusedDate] = useState<Date>(new Date());

  // Task dialog
  const [openTaskDialog, setOpenTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskFormTitle, setTaskFormTitle] = useState("");
  const [taskFormDescription, setTaskFormDescription] = useState("");
  const [taskFormCategory, setTaskFormCategory] = useState<Category | undefined>(undefined);
  const [taskFormDueDate, setTaskFormDueDate] = useState<Date | undefined>(undefined);
  const [taskFormStatus, setTaskFormStatus] = useState<"open" | "closed">("open");

  // New/Edit dialog
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [formDate, setFormDate] = useState<Date | undefined>(new Date());
  const [formTime, setFormTime] = useState<string>("09:00");
  const [formTitle, setFormTitle] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formCategory, setFormCategory] = useState<Category | undefined>(undefined);
  const [formAttending, setFormAttending] = useState<string>("");
  const [formReminderDays, setFormReminderDays] = useState<string>("1");
  const [formOutcome, setFormOutcome] = useState("");
  const [formDocumentLinks, setFormDocumentLinks] = useState<string[]>([]);

  const isDemo = groupId === "demo";

  const loadAppointments = async () => {
    if (isDemo) {
      // Demo data
      const now = new Date();
      const demo: Appointment[] = [
        {
          id: "d1",
          date_time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30).toISOString(),
          location: "Mercy Hospital",
          category: "Medical",
          description: "Checkup with Dr. Lee",
          attending_user_id: null,
          group_id: groupId,
          outcome_notes: null,
          reminder_days_before: 1,
          created_by_user_id: null,
          created_by_email: "demo@example.com",
        },
        {
          id: "d2",
          date_time: addDays(now, 2).toISOString(),
          location: "Zoom",
          category: "Financial/Legal",
          description: "Meet with attorney",
          attending_user_id: null,
          group_id: groupId,
          outcome_notes: null,
          reminder_days_before: 1,
          created_by_user_id: null,
          created_by_email: "demo@example.com",
        },
      ];
      setAppointments(demo);
      
      // Demo tasks
      const demoTasks: Task[] = [
        {
          id: "t1",
          title: "Review insurance documents",
          description: "Check coverage details",
          due_date: format(addDays(now, 1), "yyyy-MM-dd"),
          category: "Financial/Legal",
          status: "open",
          created_by_user_id: null,
          created_by_email: "demo@example.com",
          group_id: groupId,
          completed_at: null,
        },
        {
          id: "t2",
          title: "Schedule follow-up",
          description: "Call doctor's office",
          due_date: format(addDays(now, -2), "yyyy-MM-dd"),
          category: "Medical",
          status: "closed",
          created_by_user_id: null,
          created_by_email: "demo@example.com",
          group_id: groupId,
          completed_at: addDays(now, -1).toISOString(),
        },
      ];
      setTasks(demoTasks);
      return;
    }

    setLoading(true);
    try {
      const [appointmentsResult, tasksResult] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, date_time, location, category, description, attending_user_id, group_id, outcome_notes, reminder_days_before, created_by_user_id, created_by_email")
          .eq("group_id", groupId)
          .order("date_time", { ascending: true }),
        supabase
          .from("tasks")
          .select("id, title, description, due_date, category, status, created_by_user_id, created_by_email, group_id, completed_at")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false })
      ]);

      if (appointmentsResult.error) throw appointmentsResult.error;
      if (tasksResult.error) throw tasksResult.error;

      setAppointments((appointmentsResult.data as Appointment[]) || []);
      setTasks((tasksResult.data as Task[]) || []);
    } catch (err: any) {
      console.error("Failed to load data", err);
      toast({ title: "Error", description: "Could not load calendar data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const filtered = useMemo(() => {
    const filteredAppointments = appointments.filter((a) => (categoryFilter === "all" ? true : (a.category || "Other") === categoryFilter));
    const filteredTasks = tasks.filter((t) => (categoryFilter === "all" ? true : (t.category || "Other") === categoryFilter));
    return { appointments: filteredAppointments, tasks: filteredTasks };
  }, [appointments, tasks, categoryFilter]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(viewDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [viewDate]);

  const onOpenNew = () => {
    setEditing(null);
    setFormTitle("");
    setFormLocation("");
    setFormCategory(undefined);
    setFormAttending("");
    setFormReminderDays("1");
    setFormOutcome("");
    setFormDate(new Date());
    setFormTime("09:00");
    setFormDocumentLinks([]);
    setOpenDialog(true);
  };

  const onEdit = (appt: Appointment) => {
    setEditing(appt);
    const dt = parseISO(appt.date_time);
    setFormDate(dt);
    setFormTime(format(dt, "HH:mm"));
    setFormTitle(appt.description || "");
    setFormLocation(appt.location || "");
    setFormCategory(((appt.category as Category) || undefined));
    setFormAttending(appt.attending_user_id || "");
    setFormReminderDays(String(appt.reminder_days_before ?? ""));
    setFormOutcome(appt.outcome_notes || "");
    setOpenDialog(true);
  };

  const onEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskFormTitle(task.title);
    setTaskFormDescription(task.description || "");
    setTaskFormCategory(((task.category as Category) || undefined));
    setTaskFormDueDate(task.due_date ? new Date(task.due_date) : undefined);
    setTaskFormStatus(task.status as "open" | "closed");
    setOpenTaskDialog(true);
  };

  const upsertTask = async () => {
    if (isDemo) {
      toast({ title: "Demo mode", description: "Create a real care group to add tasks." });
      setOpenTaskDialog(false);
      return;
    }
    if (!taskFormTitle) {
      toast({ title: "Missing info", description: "Please add a title." });
      return;
    }
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const userEmail = (await supabase.auth.getUser()).data.user?.email;
      const payload: any = {
        ...(editingTask?.id ? { id: editingTask.id } : {}),
        group_id: groupId,
        title: taskFormTitle,
        description: taskFormDescription || null,
        category: taskFormCategory || "Other",
        due_date: taskFormDueDate ? format(taskFormDueDate, "yyyy-MM-dd") : null,
        status: taskFormStatus,
      };
      if (!editingTask?.id && userId) payload.created_by_user_id = userId;
      if (!editingTask?.id && userEmail) payload.created_by_email = userEmail;

      const { error } = await supabase.from("tasks").upsert(payload as any, { onConflict: "id" });
      if (error) throw error;
      
      setEditingTask(null);
      toast({ title: editingTask ? "Task updated" : "Task created" });
      setOpenTaskDialog(false);
      await loadAppointments();
    } catch (err: any) {
      console.error("Failed to save task", err);
      toast({ title: "Error", description: "Could not save task." });
    }
  };

  const deleteTask = async (id: string) => {
    if (isDemo) {
      toast({ title: "Demo mode", description: "Create a real care group to delete tasks." });
      return;
    }
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Task deleted" });
      await loadAppointments();
    } catch (err: any) {
      console.error("Failed to delete", err);
      toast({ title: "Error", description: "Could not delete task." });
    }
  };

  const composeISO = (date?: Date, time?: string) => {
    if (!date || !time) return undefined;
    const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
    const d = new Date(date);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  };

  const upsertAppointment = async () => {
    if (isDemo) {
      toast({ title: "Demo mode", description: "Create a real care group to add appointments." });
      setOpenDialog(false);
      return;
    }
    if (!formDate || !formTime || !formTitle) {
      toast({ title: "Missing info", description: "Please add date, time and title." });
      return;
    }
    const iso = composeISO(formDate, formTime);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const userEmail = (await supabase.auth.getUser()).data.user?.email;
      const payload: any = {
        ...(editing?.id ? { id: editing.id } : {}),
        group_id: groupId,
        date_time: iso as string,
        location: formLocation || null,
        category: formCategory || "Other",
        description: formTitle,
        attending_user_id: formAttending ? formAttending : null,
        reminder_days_before: formReminderDays ? parseInt(formReminderDays, 10) : null,
        outcome_notes: formOutcome || null,
      };
      if (!editing?.id && userId) payload.created_by_user_id = userId;
      if (!editing?.id && userEmail) payload.created_by_email = userEmail;

      const { data: result, error } = await supabase.from("appointments").upsert(payload as any, { onConflict: "id" }).select().single();
      if (error) throw error;
      
      // Handle document linking for new appointments
      if (!editing?.id && formDocumentLinks.length > 0 && result?.id) {
        try {
          const linkPromises = formDocumentLinks.map((docId: string) => 
            supabase.from('appointment_documents').insert({
              document_id: docId,
              appointment_id: result.id,
              created_by_user_id: userId
            })
          );
          await Promise.all(linkPromises);
        } catch (linkError) {
          console.warn("Document linking failed", linkError);
        }
      }
      
      if (iso) setViewDate(parseISO(iso));
      setEditing(null);
      toast({ title: editing ? "Appointment updated" : "Appointment created" });
      setOpenDialog(false);
      await loadAppointments();
    } catch (err: any) {
      console.error("Failed to save appointment", err);
      toast({ title: "Error", description: "Could not save appointment." });
    }
  };

  const deleteAppointment = async (id: string) => {
    if (isDemo) {
      toast({ title: "Demo mode", description: "Create a real care group to delete appointments." });
      return;
    }
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Appointment deleted" });
      await loadAppointments();
    } catch (err: any) {
      console.error("Failed to delete", err);
      toast({ title: "Error", description: "Could not delete appointment." });
    }
  };

  const createFollowUpTask = async (appt: Appointment) => {
    if (isDemo) {
      toast({ title: "Demo mode", description: "Create a real care group to create tasks." });
      return;
    }
    try {
      const due = addWeeks(parseISO(appt.date_time), 1);
      const payload = {
        group_id: groupId,
        title: `Follow-up: ${appt.description ?? "Appointment"}`,
        description: appt.outcome_notes ?? "",
        category: appt.category ?? "Other",
        due_date: format(due, "yyyy-MM-dd"),
        status: "open",
      } as any;
      const { error } = await supabase.from("tasks").insert(payload);
      if (error) throw error;
      toast({ title: "Follow-up task created" });
      navigate(`/app/${groupId}/tasks`);
    } catch (err: any) {
      console.error("Failed to create task", err);
      toast({ title: "Error", description: "Could not create follow-up." });
    }
  };

  const downloadIcs = (appt: Appointment) => {
    const start = parseISO(appt.date_time);
    const dtstamp = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
    const dtstart = format(start, "yyyyMMdd'T'HHmmss'Z'");
    const dtend = format(addDays(start, 0), "yyyyMMdd'T'HHmmss'Z'");
    const title = (appt.description || "Appointment").replace(/\n/g, " ");
    const loc = (appt.location || "").replace(/\n/g, ", ");
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//DaveAssist//Calendar//EN\nBEGIN:VEVENT\nUID:${appt.id}\nDTSTAMP:${dtstamp}\nDTSTART:${dtstart}\nDTEND:${dtend}\nSUMMARY:${title}\nLOCATION:${loc}\nEND:VEVENT\nEND:VCALENDAR`;
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const MonthView = () => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const itemsByDate = useMemo(() => {
      const grouped: Record<string, CalendarItem[]> = {};
      
      // Add appointments
      filtered.appointments.forEach((apt) => {
        const dateKey = format(parseISO(apt.date_time), "yyyy-MM-dd");
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push({
          id: apt.id,
          type: "appointment",
          title: apt.description || "Appointment",
          date: apt.date_time,
          category: apt.category,
          time: format(parseISO(apt.date_time), "h:mm a"),
          location: apt.location,
          created_by_email: apt.created_by_email,
        });
      });

      // Add tasks
      filtered.tasks.forEach((task) => {
        if (task.due_date) {
          const dateKey = task.due_date;
          if (!grouped[dateKey]) grouped[dateKey] = [];
          grouped[dateKey].push({
            id: task.id,
            type: "task",
            title: task.title,
            date: task.due_date,
            category: task.category,
            status: task.status,
            created_by_email: task.created_by_email,
            completed_at: task.completed_at,
          });
        }
      });

      return grouped;
    }, [filtered]);

    const getCategoryColor = (category: string | null, type: "appointment" | "task", status?: string, completed_at?: string | null) => {
      const isCompleted = status === "closed" || completed_at;
      const opacity = isCompleted ? "opacity-50" : "";
      
      if (type === "task") {
        const isOverdue = status === "open" && new Date() > new Date(viewDate);
        const taskClass = isOverdue ? "bg-red-100 text-red-800 border-red-300" : "bg-blue-100 text-blue-800 border-blue-200";
        return `${taskClass} ${opacity}`;
      }
      
      switch (category) {
        case "Medical": return `bg-red-100 text-red-800 border-red-200 ${opacity}`;
        case "Financial/Legal": return `bg-green-100 text-green-800 border-green-200 ${opacity}`;
        case "Personal/Social": return `bg-purple-100 text-purple-800 border-purple-200 ${opacity}`;
        default: return `bg-gray-100 text-gray-800 border-gray-200 ${opacity}`;
      }
    };

    const handleItemClick = (item: CalendarItem) => {
      if (item.type === "appointment") {
        const apt = appointments.find(a => a.id === item.id);
        if (apt) onEdit(apt);
      } else {
        const task = tasks.find(t => t.id === item.id);
        if (task) onEditTask(task);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent, day: Date) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const dayItems = itemsByDate[dateKey] || [];
      
      if (e.key === "Enter" && dayItems.length > 0) {
        handleItemClick(dayItems[0]);
      }
    };

    const navigateMonth = (direction: "prev" | "next") => {
      setViewDate(prev => direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1));
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateMonth("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-[140px] text-center">
              {format(viewDate, "MMMM yyyy")}
            </h3>
            <Button variant="outline" size="sm" onClick={() => navigateMonth("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-7 gap-1 border rounded-lg p-2">
          {/* Day headers */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {calendarDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayItems = itemsByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, viewDate);
            
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[120px] p-1 border rounded-md cursor-pointer focus-within:ring-2 focus-within:ring-primary",
                  isCurrentMonth ? "bg-background" : "bg-muted/30",
                  isToday(day) && "ring-2 ring-primary bg-primary/5"
                )}
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, day)}
                onClick={() => setFocusedDate(day)}
              >
                <div className={cn(
                  "text-sm font-medium mb-1",
                  isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                  isToday(day) && "text-primary font-bold"
                )}>
                  {format(day, "d")}
                </div>
                
                <div className="space-y-1">
                  {dayItems.slice(0, 4).map((item) => {
                    const isOverdue = item.type === "task" && item.status === "open" && 
                      isAfter(new Date(), new Date(item.date));
                    
                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        className={cn(
                          "text-xs p-1 rounded border cursor-pointer hover:scale-105 transition-transform",
                          getCategoryColor(item.category, item.type, item.status, item.completed_at),
                          isOverdue && "border-red-500 border-l-4"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(item);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleItemClick(item);
                        }}
                        title={`${item.title}${item.time ? ` at ${item.time}` : ''}${item.location ? ` • ${item.location}` : ''}${item.created_by_email ? ` • Created by ${item.created_by_email}` : ''}`}
                      >
                        <div className="flex items-center gap-1">
                          {item.type === "appointment" ? (
                            <Clock className="h-3 w-3 flex-shrink-0" />
                          ) : (
                            <CheckSquare className="h-3 w-3 flex-shrink-0" />
                          )}
                          <span className="truncate flex-1">{item.title}</span>
                        </div>
                        {item.time && (
                          <div className="text-[10px] opacity-75 ml-4">{item.time}</div>
                        )}
                      </div>
                    );
                  })}
                  {dayItems.length > 4 && (
                    <div className="text-xs text-muted-foreground text-center cursor-pointer hover:underline">
                      +{dayItems.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-6 text-xs border-t pt-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Appointments:</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
              <span>Medical</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
              <span>Financial/Legal</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
              <span>Personal/Social</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded"></div>
              <span>Other</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              <span>Tasks:</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
              <span>Normal</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
              <span>Overdue</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded opacity-50"></div>
              <span>Completed</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DayView = () => (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start w-full md:w-auto"><CalendarIcon className="mr-2 h-4 w-4" /> {format(viewDate, "PPP")}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <DatePicker mode="single" selected={viewDate} onSelect={(d) => d && setViewDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <p className="text-sm text-muted-foreground mt-2">Select a date to focus the list of events.</p>
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="md:col-span-2 grid gap-4">
        {filtered.appointments
          .filter((a) => isSameDay(parseISO(a.date_time), viewDate))
          .sort((a, b) => compareAsc(parseISO(a.date_time), parseISO(b.date_time)))
          .map((a) => (
            <Card key={a.id} className="border-l-4">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  {(a.category && categoryToToken[a.category as Category]) ? (
                    <span className={cn("h-2 w-2 rounded-full", categoryToToken[a.category as Category].dotClass)} aria-hidden />
                  ) : null}
                  {a.description || "Appointment"}
                  {a.category && (
                    <Badge variant={categoryToToken[a.category as Category]?.badgeVariant ?? "outline"}>{a.category}</Badge>
                  )}
                  {isBefore(parseISO(a.date_time), new Date()) && a.outcome_notes && (
                    <Badge variant="secondary">Outcome recorded</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>{format(parseISO(a.date_time), "EEE, h:mm a")} • {a.location || "No location"}</p>
                <p className="text-xs">Created by: {a.created_by_email || "Unknown"}</p>
                
                {/* Document Links */}
                <div className="py-2">
                  <TaskAppointmentDocumentLinker
                    itemId={a.id}
                    itemType="appointment"
                    itemTitle={a.description || 'Unnamed appointment'}
                    onLinksChange={() => {}}
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => onEdit(a)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => downloadIcs(a)}>Add to my Calendar</Button>
                  <Button size="sm" variant="ghost" onClick={() => createFollowUpTask(a)}>Create follow-up task</Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteAppointment(a.id)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        {filtered.appointments.filter((a) => isSameDay(parseISO(a.date_time), viewDate)).length === 0 && (
          <p className="text-sm text-muted-foreground">No events for this date.</p>
        )}
      </div>
    </div>
  );

  const WeekView = () => {
    const weekItems = useMemo(() => {
      const itemsByDate: Record<string, CalendarItem[]> = {};
      
      // Add appointments for the week
      filtered.appointments.forEach((apt) => {
        const aptDate = parseISO(apt.date_time);
        if (isSameWeek(aptDate, viewDate, { weekStartsOn: 0 })) {
          const dateKey = format(aptDate, "yyyy-MM-dd");
          if (!itemsByDate[dateKey]) itemsByDate[dateKey] = [];
          itemsByDate[dateKey].push({
            id: apt.id,
            type: "appointment",
            title: apt.description || "Appointment",
            date: apt.date_time,
            category: apt.category,
            time: format(aptDate, "h:mm a"),
            location: apt.location,
            created_by_email: apt.created_by_email,
          });
        }
      });

      // Add tasks for the week
      filtered.tasks.forEach((task) => {
        if (task.due_date) {
          const taskDate = new Date(task.due_date);
          if (isSameWeek(taskDate, viewDate, { weekStartsOn: 0 })) {
            const dateKey = task.due_date;
            if (!itemsByDate[dateKey]) itemsByDate[dateKey] = [];
            itemsByDate[dateKey].push({
              id: task.id,
              type: "task",
              title: task.title,
              date: task.due_date,
              category: task.category,
              status: task.status,
              created_by_email: task.created_by_email,
              completed_at: task.completed_at,
            });
          }
        }
      });

      return itemsByDate;
    }, [filtered, viewDate]);

    const getCategoryColor = (category: string | null, type: "appointment" | "task", status?: string, completed_at?: string | null) => {
      const isCompleted = status === "closed" || completed_at;
      const opacity = isCompleted ? "opacity-50" : "";
      
      if (type === "task") {
        const isOverdue = status === "open" && new Date() > new Date(viewDate);
        const taskClass = isOverdue ? "bg-red-100 text-red-800 border-red-300" : "bg-blue-100 text-blue-800 border-blue-200";
        return `${taskClass} ${opacity}`;
      }
      
      switch (category) {
        case "Medical": return `bg-red-100 text-red-800 border-red-200 ${opacity}`;
        case "Financial/Legal": return `bg-green-100 text-green-800 border-green-200 ${opacity}`;
        case "Personal/Social": return `bg-purple-100 text-purple-800 border-purple-200 ${opacity}`;
        default: return `bg-gray-100 text-gray-800 border-gray-200 ${opacity}`;
      }
    };

    const handleItemClick = (item: CalendarItem) => {
      if (item.type === "appointment") {
        const apt = appointments.find(a => a.id === item.id);
        if (apt) onEdit(apt);
      } else {
        const task = tasks.find(t => t.id === item.id);
        if (task) onEditTask(task);
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setViewDate(addDays(viewDate, -7))}>Previous</Button>
            <h3 className="text-lg font-semibold">
              Week of {format(startOfWeek(viewDate, { weekStartsOn: 0 }), "MMM d, yyyy")}
            </h3>
            <Button variant="outline" onClick={() => setViewDate(addDays(viewDate, 7))}>Next</Button>
          </div>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayItems = weekItems[dateKey] || [];
            const appointments = dayItems.filter(item => item.type === "appointment");
            const tasks = dayItems.filter(item => item.type === "task");
            
            return (
              <div key={day.toISOString()} className="rounded-md border p-2 min-h-[200px]">
                <div className={cn(
                  "text-sm font-medium mb-2 pb-1 border-b",
                  isToday(day) && "text-primary font-bold"
                )}>
                  {format(day, "EEE M/d")}
                </div>
                
                {/* All-day tasks section */}
                {tasks.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-muted-foreground mb-1">Tasks Due</div>
                    <div className="space-y-1">
                      {tasks.map((task) => {
                        const isOverdue = task.status === "open" && isAfter(new Date(), new Date(task.date));
                        
                        return (
                          <div
                            key={task.id}
                            className={cn(
                              "text-xs p-1 rounded border cursor-pointer hover:scale-105 transition-transform",
                              getCategoryColor(task.category, task.type, task.status, task.completed_at),
                              isOverdue && "border-red-500 border-l-4"
                            )}
                            onClick={() => handleItemClick(task)}
                            title={`${task.title}${task.created_by_email ? ` • Created by ${task.created_by_email}` : ''}`}
                          >
                            <div className="flex items-center gap-1">
                              <CheckSquare className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{task.title}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Timed appointments section */}
                <div className="space-y-1">
                  {appointments
                    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))
                    .map((apt) => (
                      <div
                        key={apt.id}
                        className={cn(
                          "text-xs p-1 rounded border cursor-pointer hover:scale-105 transition-transform",
                          getCategoryColor(apt.category, apt.type)
                        )}
                        onClick={() => handleItemClick(apt)}
                        title={`${apt.title}${apt.time ? ` at ${apt.time}` : ''}${apt.location ? ` • ${apt.location}` : ''}${apt.created_by_email ? ` • Created by ${apt.created_by_email}` : ''}`}
                      >
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="font-medium">{apt.time}</span>
                        </div>
                        <div className="truncate mt-1">{apt.title}</div>
                        {apt.location && <div className="text-muted-foreground truncate text-[10px]">{apt.location}</div>}
                      </div>
                    ))}
                </div>
                
                {dayItems.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center mt-4">No events</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const ListView = () => (
    <div className="space-y-3">
      {filtered.appointments
        .sort((a, b) => compareAsc(parseISO(a.date_time), parseISO(b.date_time)))
        .map((a) => (
          <Card key={a.id} className="border-l-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {(a.category && categoryToToken[a.category as Category]) ? (
                  <span className={cn("h-2 w-2 rounded-full", categoryToToken[a.category as Category].dotClass)} aria-hidden />
                ) : null}
                {a.description || "Appointment"}
                {a.category && (
                  <Badge variant={categoryToToken[a.category as Category]?.badgeVariant ?? "outline"}>{a.category}</Badge>
                )}
              </CardTitle>
            </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>{format(parseISO(a.date_time), "PPPP h:mm a")} • {a.location || "No location"}</p>
                <p className="text-xs">Created by: {a.created_by_email || "Unknown"}</p>
                
                {/* Document Links */}
                <div className="py-2">
                  <TaskAppointmentDocumentLinker
                    itemId={a.id}
                    itemType="appointment"
                    itemTitle={a.description || 'Unnamed appointment'}
                    onLinksChange={() => {}}
                  />
                </div>
                
                <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(a)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => downloadIcs(a)}>Add to my Calendar</Button>
                <Button size="sm" variant="ghost" onClick={() => createFollowUpTask(a)}>Create follow-up task</Button>
                <Button size="sm" variant="destructive" onClick={() => deleteAppointment(a.id)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      {filtered.appointments.length === 0 && (
        <p className="text-sm text-muted-foreground">No appointments yet.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <SEO title="Calendar — DaveAssist" description="Shared appointments for your care group." />
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Shared Calendar</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAppointments} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button variant="hero" onClick={onOpenNew}><Plus className="mr-2 h-4 w-4" /> New appointment</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit appointment" : "New appointment"}</DialogTitle>
              </DialogHeader>
              {isDemo && (
                <div className="text-sm text-muted-foreground">You are viewing the demo group. Create or switch to a real group to save appointments.</div>
              )}
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title/Description</Label>
                  <Input id="title" placeholder="e.g. Cardiology check-up with Dr. Smith" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start font-normal", !formDate && "text-muted-foreground")}> <CalendarIcon className="mr-2 h-4 w-4" /> {formDate ? format(formDate, "PPP") : <span>Pick a date</span>} </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <DatePicker mode="single" selected={formDate} onSelect={setFormDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="time">Time</Label>
                    <Input id="time" type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="Address or virtual/phone" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select value={formCategory} onValueChange={(v) => setFormCategory(v as Category)}>
                      <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="attending">Attending (optional)</Label>
                    <Input id="attending" placeholder="User ID (optional)" value={formAttending} onChange={(e) => setFormAttending(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="reminder">Reminder (days before)</Label>
                    <Input id="reminder" type="number" min={0} value={formReminderDays} onChange={(e) => setFormReminderDays(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="outcome">Outcome notes (after event)</Label>
                  <Textarea id="outcome" placeholder="Add notes or outcomes after the appointment" value={formOutcome} onChange={(e) => setFormOutcome(e.target.value)} />
                </div>
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium">Link Documents (optional)</Label>
                  <TaskAppointmentDocumentLinker
                    itemId={null}
                    itemType="appointment"
                    itemTitle="New appointment"
                    onLinksChange={() => {}}
                    isCreationMode={true}
                    onDocumentLinksChange={(links) => {
                      // Store document links to be processed after appointment creation
                      setFormDocumentLinks(links);
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setOpenDialog(false)}>Cancel</Button>
                <Button onClick={upsertAppointment}>{editing ? "Save changes" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
        </div>
      </header>

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="list">Full List</TabsTrigger>
          </TabsList>
          <Button 
            variant="outline" 
            onClick={() => {
              setViewDate(new Date());
              setActiveView("day");
            }}
          >
            Today
          </Button>
        </div>

        <TabsContent value="month"><MonthView /></TabsContent>
        <TabsContent value="week"><WeekView /></TabsContent>
        <TabsContent value="day"><DayView /></TabsContent>
        <TabsContent value="list"><ListView /></TabsContent>
      </Tabs>

      {/* Task Dialog */}
      <Dialog open={openTaskDialog} onOpenChange={setOpenTaskDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit task" : "New task"}</DialogTitle>
          </DialogHeader>
          {isDemo && (
            <div className="text-sm text-muted-foreground">You are viewing the demo group. Create or switch to a real group to save tasks.</div>
          )}
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="task-title">Title</Label>
              <Input id="task-title" placeholder="e.g. Call insurance company" value={taskFormTitle} onChange={(e) => setTaskFormTitle(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea id="task-description" placeholder="Optional details" value={taskFormDescription} onChange={(e) => setTaskFormDescription(e.target.value)} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={taskFormCategory} onValueChange={(v) => setTaskFormCategory(v as Category)}>
                  <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start font-normal", !taskFormDueDate && "text-muted-foreground")}> <CalendarIcon className="mr-2 h-4 w-4" /> {taskFormDueDate ? format(taskFormDueDate, "PPP") : <span>Pick a date</span>} </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DatePicker mode="single" selected={taskFormDueDate} onSelect={setTaskFormDueDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={taskFormStatus} onValueChange={(v) => setTaskFormStatus(v as "open" | "closed")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenTaskDialog(false)}>Cancel</Button>
            <Button onClick={upsertTask}>{editingTask ? "Save changes" : "Create"}</Button>
            {editingTask && (
              <Button variant="destructive" onClick={() => deleteTask(editingTask.id)}>Delete</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
