import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, CheckSquare } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type CalendarItem = {
  id: string;
  type: "appointment" | "task";
  title: string;
  date: string; // ISO date
  category: string | null;
  status?: string; // for tasks
  time?: string; // for appointments
};

interface MonthlyOverviewProps {
  className?: string;
}

export default function MonthlyOverview({ className }: MonthlyOverviewProps) {
  const { groupId } = useParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(false);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const loadData = async () => {
    if (!groupId || groupId === "demo") return;
    
    setLoading(true);
    try {
      // Fetch appointments
      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select("id, date_time, description, category")
        .eq("group_id", groupId)
        .gte("date_time", monthStart.toISOString())
        .lte("date_time", monthEnd.toISOString())
        .order("date_time", { ascending: true });

      if (appointmentsError) throw appointmentsError;

      // Fetch tasks with due dates
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("id, title, due_date, category, status")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .not("due_date", "is", null)
        .gte("due_date", format(monthStart, "yyyy-MM-dd"))
        .lte("due_date", format(monthEnd, "yyyy-MM-dd"))
        .order("due_date", { ascending: true});

      if (tasksError) throw tasksError;

      // Combine and format data
      const combinedItems: CalendarItem[] = [
        ...(appointments || []).map((apt): CalendarItem => ({
          id: apt.id,
          type: "appointment",
          title: apt.description || "Appointment",
          date: apt.date_time,
          category: apt.category,
          time: format(parseISO(apt.date_time), "h:mm a"),
        })),
        ...(tasks || []).map((task): CalendarItem => ({
          id: task.id,
          type: "task",
          title: task.title,
          date: task.due_date + "T23:59:59", // Make tasks appear at end of day
          category: task.category,
          status: task.status,
        })),
      ];

      setItems(combinedItems);
    } catch (error) {
      console.error("Failed to load calendar data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [groupId, currentDate]);

  const itemsByDate = useMemo(() => {
    const grouped: Record<string, CalendarItem[]> = {};
    items.forEach((item) => {
      const dateKey = format(parseISO(item.date), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(item);
    });
    return grouped;
  }, [items]);

  const getCategoryColor = (category: string | null, type: "appointment" | "task") => {
    if (type === "task") {
      return "bg-blue-100 text-blue-800 border-blue-200";
    }
    switch (category) {
      case "Medical": return "bg-red-100 text-red-800 border-red-200";
      case "Financial/Legal": return "bg-green-100 text-green-800 border-green-200";
      case "Personal/Social": return "bg-purple-100 text-purple-800 border-purple-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev => direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  if (groupId === "demo") {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Monthly Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            Create a real care group to view the monthly overview calendar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Monthly Overview
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateMonth("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-[140px] text-center">
              {format(currentDate, "MMMM yyyy")}
            </h3>
            <Button variant="outline" size="sm" onClick={() => navigateMonth("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : (
          <div className="grid grid-cols-7 gap-2">
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
              const isCurrentMonth = isSameMonth(day, currentDate);
              
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[100px] p-1 border border-border rounded-lg",
                    isCurrentMonth ? "bg-background" : "bg-muted/50",
                    isToday(day) && "ring-2 ring-primary"
                  )}
                >
                  <div className={cn(
                    "text-sm font-medium mb-1",
                    isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                    isToday(day) && "text-primary font-bold"
                  )}>
                    {format(day, "d")}
                  </div>
                  
                  <div className="space-y-1">
                    {dayItems.slice(0, 3).map((item) => (
                      <div
                        key={`${item.type}-${item.id}`}
                        className={cn(
                          "text-xs p-1 rounded border text-center truncate",
                          getCategoryColor(item.category, item.type)
                        )}
                        title={`${item.title} ${item.time ? `at ${item.time}` : ''}`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {item.type === "appointment" ? (
                            <Clock className="h-3 w-3" />
                          ) : (
                            <CheckSquare className="h-3 w-3" />
                          )}
                          <span className="truncate">{item.title}</span>
                        </div>
                        {item.time && (
                          <div className="text-[10px] opacity-75">{item.time}</div>
                        )}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayItems.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Appointments</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckSquare className="h-3 w-3" />
            <span>Tasks</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}