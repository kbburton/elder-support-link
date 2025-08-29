
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CheckSquare, Square, Trash2, X } from "lucide-react";
import SharedCalendar, { CalendarEvent } from "@/components/calendar/SharedCalendar";
import { EnhancedAppointmentModal } from "@/components/appointments/EnhancedAppointmentModal";
import { EnhancedTaskModal } from "@/components/tasks/EnhancedTaskModal";
import { AppointmentListView } from "@/components/calendar/AppointmentListView";
import { useDemoOperations } from "@/hooks/useDemoOperations";
// REMOVED: import { GroupWelcomeModal } from "@/components/welcome/GroupWelcomeModal";
// REMOVED: import { useGroupWelcome } from "@/hooks/useGroupWelcome";
// ... other imports remain

const CalendarPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeView, setActiveView] = useState<"month" | "week" | "day" | "list">("month");
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [groupName, setGroupName] = useState("");
  // ... etc.

  // Handle URL parameters for auto-opening appointment modal and list view
  useEffect(() => {
    const view = searchParams.get('view');
    const openAppointment = searchParams.get('openAppointment');
    
    if (view && ['month', 'week', 'day', 'list'].includes(view)) {
      setActiveView(view as "month" | "week" | "day" | "list");
    }
    
    if (openAppointment && !showAppointmentModal) {
      setSelectedAppointment({ id: openAppointment });
      setShowAppointmentModal(true);
    }
  }, [searchParams, showAppointmentModal]);

  const handleCloseAppointmentModal = () => {
    setShowAppointmentModal(false);
    setSelectedAppointment(null);
    // Clear URL parameters when closing modal
    setSearchParams(new URLSearchParams());
  };

  // REMOVED welcome modal usage:
  // const { showWelcome, closeWelcome } = useGroupWelcome(groupId || "", groupName);

  // ... rest of CalendarPage logic for handling events, selection, etc.

  // Render:
  if (!groupId || groupId.startsWith(":")) {
    // ... (invalid group handling as before)
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <SEO title="Calendar - Care Coordination" description="View and manage care group calendar events" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">
            View and manage appointments and tasks for your care group
          </p>
        </div>
        <Button onClick={() => setShowAppointmentModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Appointment
        </Button>
      </div>

      <Tabs defaultValue="month" value={activeView} onValueChange={(val) => setActiveView(val as "month" | "week" | "day" | "list")}>
        <TabsList>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>
        <TabsContent value="month">
          <SharedCalendar 
            view="month"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            groupId={groupId!}
            onEventSelect={(event) => {
              if (event.type === 'appointment') {
                setSelectedAppointment(event.raw);
                setShowAppointmentModal(true);
              } else {
                setSelectedTask(event.raw);
                setShowTaskModal(true);
              }
            }}
          />
        </TabsContent>
        <TabsContent value="week">
          <SharedCalendar 
            view="week"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            groupId={groupId!}
            onEventSelect={(event) => {
              if (event.type === 'appointment') {
                setSelectedAppointment(event.raw);
                setShowAppointmentModal(true);
              } else {
                setSelectedTask(event.raw);
                setShowTaskModal(true);
              }
            }}
          />
        </TabsContent>
        <TabsContent value="day">
          <SharedCalendar 
            view="day"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            groupId={groupId!}
            onEventSelect={(event) => {
              if (event.type === 'appointment') {
                setSelectedAppointment(event.raw);
                setShowAppointmentModal(true);
              } else {
                setSelectedTask(event.raw);
                setShowTaskModal(true);
              }
            }}
          />
        </TabsContent>
        <TabsContent value="list">
          <AppointmentListView groupId={groupId!} onEdit={(appointment) => { setSelectedAppointment(appointment); setShowAppointmentModal(true); }} />
        </TabsContent>
      </Tabs>
      
      {/* Welcome Modal removed from CalendarPage */}
      {/* Removed: <GroupWelcomeModal ... /> */}

      {/* Modals for appointment and task (remain unchanged) */}
      <EnhancedAppointmentModal
        isOpen={showAppointmentModal}
        onClose={handleCloseAppointmentModal}
        appointment={selectedAppointment}
        groupId={groupId}
      />
      <EnhancedTaskModal
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setSelectedTask(null); }}
        task={selectedTask}
        groupId={groupId}
      />
      {/* Bulk delete confirm dialog ... (unchanged) */}
    </div>
  );
};
export default CalendarPage;
