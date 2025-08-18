import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay,
  addMonths, addWeeks, addDays, eachDayOfInterval, isSameDay, isSameMonth, format
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Trash2, CheckSquare, Square } from "lucide-react";
import { softDeleteEntity } from "@/lib/delete/rpc";

export type View = "month" | "week" | "day" | "list";

type SharedCalendarProps = {
  view: View;
  selectedDate: Date;
  onSelectedDateChange: (d: Date) => void;
  groupId: string;
  showLegend?: boolean;
  excludeDeleted?: boolean;
  onEventSelect?: (evt: CalendarEvent) => void;

  // optional callback after delete (we still delete internally)
  onEventDelete?: (evt: CalendarEvent) => void;

  // Select Mode (bulk)
  selectMode?: boolean;
  isSelected?: (evt: CalendarEvent) => boolean;
  onToggleSelect?: (evt: CalendarEvent) => void;
  onEventsLoaded?: (events: CalendarEvent[]) => void;
};

export type CalendarEventType = "appointment" | "task";

type AppointmentRow = {
  id: string;
  group_id: string | null;
  date_time: string;
  duration_minutes: number | null;
  description: string | null;
  location: string | null;
  category: string | null;
  created_by_email: string | null;
};

type TaskRow = {
  id: string;
  group_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  priority: string | null;
  created_by_email: string | null;
};

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  start: Date;
  end?: Date;
  raw: any;
};

function toMidnight(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function monthRange(d: Date) {
  const start = startOfWeek(startOfMonth(d), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(d), { weekStartsOn: 0 });
  return { start, end };
}

function weekRange(d: Date) {
  return { start: startOfWeek(d, { weekStartsOn: 0 }), end: endOfWeek(d, { weekStartsOn: 0 }) };
}

function dayRange(d: Date) {
  return { start: startOfDay(d), end: endOfDay(d) };
}

export default function SharedCalendar(props: SharedCalendarProps) {
  const {
    view, selectedDate, onSelectedDateChange, groupId,
    showLegend = true, excludeDeleted = true,
    onEventSelect, onEventDelete,
    selectMode = false, isSelected, onToggleSelect, onEventsLoaded
  } = props;

  const { start, end } = useMemo(() => {
    if (view === "month") return monthRange(selectedDate);
    if (view === "week") return weekRange(selectedDate);
    if (view === "day") return dayRange(selectedDate);
    const s = startOfDay(addDays(selectedDate, -30));
    const e = endOfDay(addDays(selectedDate, 30));
    return { start: s, end: e };
  }, [view, selectedDate]);

  const apptQuery = useQuery({
    queryKey: ["calendar-appointments", groupId, view, start.toISOString(), end.toISOString(), excludeDeleted],
    enabled: !!groupId && groupId !== ':groupId' && groupId !== 'undefined',
    queryFn: async () => {
      if (!groupId || groupId === ':groupId' || groupId === 'undefined') {
        throw new Error('Invalid group ID');
      }
      const { data, error } = await supabase
        .from("appointments")
        .select("id, group_id, date_time, duration_minutes, description, location, category, created_by_email")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .gte("date_time", start.toISOString())
        .lte("date_time", end.toISOString())
        .order("date_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AppointmentRow[];
    }
  });

  const taskQuery = useQuery({
    queryKey: ["calendar-tasks", groupId, view, start.toISOString(), end.toISOString(), excludeDeleted],
    enabled: !!groupId && groupId !== ':groupId' && groupId !== 'undefined',
    queryFn: async () => {
      if (!groupId || groupId === ':groupId' || groupId === 'undefined') {
        throw new Error('Invalid group ID');
      }
      const { data, error } = await supabase
        .from("tasks")
        .select("id, group_id, title, description, due_date, status, priority, created_by_email")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .not("due_date", "is", null)
        .gte("due_date", format(start, "yyyy-MM-dd"))
        .lte("due_date", format(end, "yyyy-MM-dd"))
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    }
  });

  const isLoading = apptQuery.isLoading || taskQuery.isLoading;
  const hasError = apptQuery.isError || taskQuery.isError;

  const events: CalendarEvent[] = useMemo(() => {
    const appts: CalendarEvent[] = (apptQuery.data ?? []).map(a => {
      const start = new Date(a.date_time);
      const dur = a.duration_minutes ?? 60;
      const end = new Date(start.getTime() + dur * 60 * 1000);
      const title = a.category ? `Appt: ${a.category}` : "Appointment";
      return { id: a.id, type: "appointment", title, start, end, raw: a };
    });

    const tasks: CalendarEvent[] = (taskQuery.data ?? []).map(t => {
      const start = t.due_date ? new Date(`${t.due_date}T00:00:00`) : toMidnight(selectedDate);
      const prefix = t.status ? `${t.status}: ` : "";
      return { id: t.id, type: "task", title: `${prefix}${t.title}`, start, raw: t };
    });

    return [...appts, ...tasks].sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [apptQuery.data, taskQuery.data, selectedDate]);

  useEffect(() => {
    onEventsLoaded?.(events);
  }, [events, onEventsLoaded]);

  const [open, setOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  function openEvent(evt: CalendarEvent) {
    if (selectMode) {
      onToggleSelect?.(evt);
      return;
    }
    setSelectedEvent(evt);
    setOpen(true);
    onEventSelect?.(evt);
  }

  function closeEvent() {
    setOpen(false);
    setSelectedEvent(null);
  }

  async function performSoftDelete(evt: CalendarEvent) {
    // Get current user info
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    if (evt.type === "appointment") {
      const result = await softDeleteEntity('appointment', evt.id, user.id, user.email!);
      if (!result.success) {
        // Handle "already deleted" case gracefully
        if (result.error?.includes("already deleted") || result.error?.includes("update blocked")) {
          console.log("Item was already deleted, refreshing view...");
          await apptQuery.refetch();
          return; // Don't throw error for already deleted items
        }
        throw new Error(result.error || 'Delete failed');
      }
      await apptQuery.refetch();
    } else {
      const result = await softDeleteEntity('task', evt.id, user.id, user.email!);
      if (!result.success) {
        if (result.error?.includes("already deleted") || result.error?.includes("update blocked")) {
          console.log("Item was already deleted, refreshing view...");
          await taskQuery.refetch();
          return;
        }
        throw new Error(result.error || 'Delete failed');
      }
      await taskQuery.refetch();
    }
  }

  async function handleDelete() {
    if (!selectedEvent) return;
    try {
      // delete internally with the correct parameter name
      await performSoftDelete(selectedEvent);
      // notify parent (optional)
      onEventDelete?.(selectedEvent);
    } catch (e) {
      // Only log and show error if it's not an "already deleted" case
      if (e instanceof Error && !e.message?.includes("already deleted") && !e.message?.includes("update blocked")) {
        console.error("Delete failed:", e);
        // You could add a toast notification here if needed
      } else {
        console.log("Item was already deleted, operation completed successfully");
      }
    } finally {
      closeEvent();
    }
  }

  function goPrev() {
    if (view === "month") onSelectedDateChange(addMonths(selectedDate, -1));
    else if (view === "week") onSelectedDateChange(addWeeks(selectedDate, -1));
    else onSelectedDateChange(addDays(selectedDate, -1));
  }

  function goNext() {
    if (view === "month") onSelectedDateChange(addMonths(selectedDate, 1));
    else if (view === "week") onSelectedDateChange(addWeeks(selectedDate, 1));
    else onSelectedDateChange(addDays(selectedDate, 1));
  }

  function DayCell({ date }: { date: Date }) {
    const dayEvents = events.filter(e => isSameDay(e.start, date));
    const faded = !isSameMonth(date, selectedDate) && view === "month";
    return (
      <div className={`border p-2 min-h-[110px] ${faded ? "bg-muted/30" : ""}`}>
        <div className="text-xs font-semibold mb-1">{format(date, "d")}</div>
        <div className="space-y-1">
          {dayEvents.map(ev => {
            const active = isSelected?.(ev) ?? false;
            return (
              <button
                key={`${ev.type}-${ev.id}`}
                className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-accent transition 
                  ${active ? "ring-2 ring-primary/60 bg-primary/5" : ""}`}
                onClick={() => openEvent(ev)}
                title={ev.title}
              >
                <span className="inline-flex items-center gap-1 mr-2 align-middle text-[10px] px-1 rounded bg-secondary">
                  {selectMode ? (
                    active ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />
                  ) : (
                    <span className={`inline-block w-2 h-2 rounded ${ev.type === "appointment" ? "bg-blue-400" : "bg-green-400"}`} />
                  )}
                  {ev.type === "appointment" ? "Appt" : "Task"}
                </span>
                <span className="align-middle">
                  {ev.type === "appointment" ? format(ev.start, "p") + " • " : ""}
                  {ev.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function MonthView() {
    const days = eachDayOfInterval({ start, end });
    return <div className="grid grid-cols-7 gap-px bg-border">{days.map((d) => <DayCell key={d.toISOString()} date={d} />)}</div>;
  }

  function WeekView() {
    const days = eachDayOfInterval({ start, end });
    return <div className="grid grid-cols-7 gap-px bg-border">{days.map((d) => <DayCell key={d.toISOString()} date={d} />)}</div>;
  }

  function DayView() {
    const days = eachDayOfInterval({ start, end });
    return <div className="grid grid-cols-1 gap-px bg-border">{days.map((d) => <DayCell key={d.toISOString()} date={d} />)}</div>;
  }

  function ListView() {
    const byDay = new Map<string, CalendarEvent[]>();
    events.forEach(e => {
      const key = format(e.start, "yyyy-MM-dd");
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(e);
    });
    const keys = Array.from(byDay.keys()).sort();

    return (
      <div className="space-y-4">
        {keys.map(k => {
          const date = new Date(`${k}T00:00:00`);
          const dayEvents = byDay.get(k)!;
          return (
            <Card key={k}>
              <CardHeader>
                <CardTitle className="text-base">{format(date, "EEEE, MMM d")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dayEvents.map(ev => {
                  const active = isSelected?.(ev) ?? false;
                  return (
                    <button
                      key={`${ev.type}-${ev.id}`}
                      className={`w-full text-left px-3 py-2 rounded border hover:bg-accent transition
                        ${selectMode && active ? "ring-2 ring-primary/60 bg-primary/5" : ""}`}
                      onClick={() => openEvent(ev)}
                    >
                      <div className="flex items-center gap-2">
                        {selectMode ? (
                          active ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />
                        ) : (
                          <Badge variant={ev.type === "appointment" ? "secondary" : "outline"}>
                            {ev.type === "appointment" ? "Appointment" : "Task"}
                          </Badge>
                        )}
                        <div className="text-sm font-medium">{ev.title}</div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {ev.type === "appointment" ? `${format(ev.start, "PPpp")}` : `Due ${format(ev.start, "PP")}`}
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
        {keys.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No items in this range.
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        <div className="mx-2 text-sm font-medium">
            {view === "month" && format(selectedDate, "MMMM yyyy")}
            {view === "week" && `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`}
            {view === "day" && format(selectedDate, "PPP")}
            {view === "list" && `±30 days around ${format(selectedDate, "PPP")}`}
          </div>
          <Button variant="outline" size="icon" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {showLegend && (
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-blue-400" />
              Appointments
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-green-400" />
              Tasks (with due date)
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      {isLoading && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Loading…</CardContent></Card>
      )}
      {hasError && (
        <Card><CardContent className="p-6 text-center text-destructive">Could not load calendar data.</CardContent></Card>
      )}
      {!isLoading && !hasError && (
        <>
          {view === "month" && <MonthView />}
          {view === "week" && <WeekView />}
          {view === "day" && <DayView />}
          {view === "list" && <ListView />}
        </>
      )}

      {/* Event modal for single delete (disabled during Select Mode) */}
      <Dialog open={!selectMode && open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {selectedEvent?.type === "appointment" ? "Appointment" : "Task"}
            </DialogTitle>
            <DialogDescription>{selectedEvent?.title}</DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {selectedEvent.type === "appointment"
                  ? `${format(selectedEvent.start, "PPpp")}`
                  : `Due ${format(selectedEvent.start, "PP")}`}
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between">
            <Button variant="outline" onClick={closeEvent}>Close</Button>
            {selectedEvent && (
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
