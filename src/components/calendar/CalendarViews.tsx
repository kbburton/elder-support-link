import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, isSameDay, isToday, eachDayOfInterval, isSameMonth, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarItem } from "./CalendarItem";
import { useState } from "react";

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

interface CalendarViewsProps {
  view: 'month' | 'week' | 'day' | 'list';
  selectedDate: Date;
  events: CalendarEvent[];
  onDateChange: (date: Date) => void;
  groupId: string;
  onTaskClick?: (taskId: string) => void;
}

export function CalendarViews({ view, selectedDate, events, onDateChange, groupId, onTaskClick }: CalendarViewsProps) {
  const navigatePrevious = () => {
    switch (view) {
      case 'month':
        onDateChange(subMonths(selectedDate, 1));
        break;
      case 'week':
        onDateChange(subWeeks(selectedDate, 1));
        break;
      case 'day':
        onDateChange(addDays(selectedDate, -1));
        break;
    }
  };

  const navigateNext = () => {
    switch (view) {
      case 'month':
        onDateChange(addMonths(selectedDate, 1));
        break;
      case 'week':
        onDateChange(addWeeks(selectedDate, 1));
        break;
      case 'day':
        onDateChange(addDays(selectedDate, 1));
        break;
    }
  };

  if (view === 'month') {
    return <MonthView selectedDate={selectedDate} events={events} onNavigatePrevious={navigatePrevious} onNavigateNext={navigateNext} groupId={groupId} onTaskClick={onTaskClick} />;
  }

  if (view === 'week') {
    return <WeekView selectedDate={selectedDate} events={events} onNavigatePrevious={navigatePrevious} onNavigateNext={navigateNext} groupId={groupId} onTaskClick={onTaskClick} />;
  }

  if (view === 'day') {
    return <DayView selectedDate={selectedDate} events={events} onNavigatePrevious={navigatePrevious} onNavigateNext={navigateNext} groupId={groupId} onTaskClick={onTaskClick} />;
  }

  return <ListView events={events} groupId={groupId} onTaskClick={onTaskClick} />;
}

function MonthView({ selectedDate, events, onNavigatePrevious, onNavigateNext, groupId, onTaskClick }: {
  selectedDate: Date;
  events: CalendarEvent[];
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  groupId: string;
  onTaskClick?: (taskId: string) => void;
}) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{format(selectedDate, "MMMM yyyy")}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onNavigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onNavigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-sm">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        
        {days.map(day => {
          const dayEvents = events.filter(event => {
            const eventDate = event.startTime || event.dueDate;
            return eventDate && isSameDay(eventDate, day);
          });

          return (
            <div
              key={day.toString()}
              className={`min-h-24 p-1 border rounded-lg ${
                !isSameMonth(day, selectedDate) ? 'bg-muted/30' : ''
              } ${isToday(day) ? 'bg-primary/10 border-primary' : 'border-border'}`}
            >
              <div className={`text-sm mb-1 ${isToday(day) ? 'font-bold text-primary' : ''}`}>
                {format(day, 'd')}
              </div>
               <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => (
                    <div key={event.id} data-calendar-item-id={event.id}>
                      <CalendarItem
                        entityType={event.entityType}
                        id={event.id}
                        title={event.title}
                        startTime={event.startTime?.toISOString()}
                        dueDate={event.dueDate?.toISOString().split('T')[0]}
                        category={event.category}
                        isCompleted={event.isCompleted}
                        isOverdue={event.isOverdue}
                        isRecurring={event.isRecurring}
                        status={event.status}
                        primaryOwnerName={event.primaryOwnerName}
                        secondaryOwnerName={event.secondaryOwnerName}
                        onClick={() => {
                          if (event.entityType === 'task' && onTaskClick) {
                            onTaskClick(event.id);
                          }
                        }}
                        size="small"
                      />
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ selectedDate, events, onNavigatePrevious, onNavigateNext, groupId, onTaskClick }: {
  selectedDate: Date;
  events: CalendarEvent[];
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  groupId: string;
  onTaskClick?: (taskId: string) => void;
}) {
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = endOfWeek(selectedDate);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onNavigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onNavigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const dayEvents = events.filter(event => {
            const eventDate = event.startTime || event.dueDate;
            return eventDate && isSameDay(eventDate, day);
          });

          return (
            <Card key={day.toString()} className={isToday(day) ? 'border-primary' : ''}>
              <CardContent className="p-3">
                <div className={`text-sm font-medium mb-2 ${isToday(day) ? 'text-primary' : ''}`}>
                  {format(day, 'EEE d')}
                </div>
                  <div className="space-y-2">
                    {dayEvents.map(event => (
                      <div key={event.id} data-calendar-item-id={event.id}>
                        <CalendarItem
                          entityType={event.entityType}
                          id={event.id}
                          title={event.title}
                          startTime={event.startTime?.toISOString()}
                          dueDate={event.dueDate?.toISOString().split('T')[0]}
                          category={event.category}
                          isCompleted={event.isCompleted}
                          isOverdue={event.isOverdue}
                          isRecurring={event.isRecurring}
                          status={event.status}
                          primaryOwnerName={event.primaryOwnerName}
                          secondaryOwnerName={event.secondaryOwnerName}
                          onClick={() => {
                            if (event.entityType === 'task' && onTaskClick) {
                              onTaskClick(event.id);
                            }
                          }}
                          size="medium"
                        />
                      </div>
                    ))}
                  </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ selectedDate, events, onNavigatePrevious, onNavigateNext, groupId, onTaskClick }: {
  selectedDate: Date;
  events: CalendarEvent[];
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  groupId: string;
  onTaskClick?: (taskId: string) => void;
}) {
  const dayEvents = events.filter(event => {
    const eventDate = event.startTime || event.dueDate;
    return eventDate && isSameDay(eventDate, selectedDate);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{format(selectedDate, "EEEE, MMMM d, yyyy")}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onNavigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onNavigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {dayEvents.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No events scheduled for this day
            </div>
          ) : (
            <div className="space-y-3">
              {dayEvents.map(event => (
                <div key={event.id} data-calendar-item-id={event.id}>
                  <CalendarItem
                    entityType={event.entityType}
                    id={event.id}
                    title={event.title}
                    startTime={event.startTime?.toISOString()}
                    dueDate={event.dueDate?.toISOString().split('T')[0]}
                    category={event.category}
                    isCompleted={event.isCompleted}
                    isOverdue={event.isOverdue}
                    isRecurring={event.isRecurring}
                    status={event.status}
                    primaryOwnerName={event.primaryOwnerName}
                    secondaryOwnerName={event.secondaryOwnerName}
                    onClick={() => {
                      if (event.entityType === 'task' && onTaskClick) {
                        onTaskClick(event.id);
                      }
                    }}
                    size="large"
                    showDetails={true}
                    location={event.location}
                    created_by_email={event.createdBy}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ListView({ events, groupId, onTaskClick }: { events: CalendarEvent[]; groupId: string; onTaskClick?: (taskId: string) => void; }) {
  // Sort events by date
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = a.startTime || a.dueDate || new Date(0);
    const dateB = b.startTime || b.dueDate || new Date(0);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">All Events</h3>
      
      <Card>
        <CardContent className="p-6">
          {sortedEvents.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No events found
            </div>
          ) : (
            <div className="space-y-3">
              {sortedEvents.map(event => (
                <div key={event.id} data-calendar-item-id={event.id}>
                  <CalendarItem
                    entityType={event.entityType}
                    id={event.id}
                    title={event.title}
                    startTime={event.startTime?.toISOString()}
                    dueDate={event.dueDate?.toISOString().split('T')[0]}
                    category={event.category}
                    isCompleted={event.isCompleted}
                    isOverdue={event.isOverdue}
                    isRecurring={event.isRecurring}
                    status={event.status}
                    primaryOwnerName={event.primaryOwnerName}
                    secondaryOwnerName={event.secondaryOwnerName}
                    onClick={() => {
                      if (event.entityType === 'task' && onTaskClick) {
                        onTaskClick(event.id);
                      }
                    }}
                    size="large"
                    showDetails={true}
                    location={event.location}
                    created_by_email={event.createdBy}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}