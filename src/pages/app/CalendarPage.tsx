
import { useSearchParams, useParams } from "react-router-dom";
import { useMemo } from "react";
// import { EnhancedAppointmentModal } from "@/components/appointments/EnhancedAppointmentModal";

export default function CalendarsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const editId = searchParams.get("edit");

  // TODO: replace `appointments` with your page's appointments source
  const apptToEdit = useMemo(
    () => appointments.find((a) => a.id === editId) ?? null,
    [appointments, editId]
  );

  const closeEdit = () => {
    searchParams.delete("edit");
    setSearchParams(searchParams, { replace: true });
  };

  // ...
  // <EnhancedAppointmentModal
  //   appointment={apptToEdit}
  //   isOpen={!!editId}
  //   onClose={closeEdit}
  //   groupId={groupId!}
  // />
  // ...
}
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
// … your other imports …

export default function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();

  const editId = searchParams.get("edit"); // if present, open modal for this id

  // Load the entity by id from your existing list or via fetch
  const taskToEdit = useMemo(
    () => tasks.find((t) => t.id === editId) ?? null,
    [tasks, editId]
  );

  const handleCloseModal = () => {
    // Close modal AND remove ?edit while staying on the same page
    searchParams.delete("edit");
    setSearchParams(searchParams, { replace: true });
  };

  // Render your existing EnhancedTaskModal with task={taskToEdit}
  // <EnhancedTaskModal task={taskToEdit} isOpen={!!editId} onClose={handleCloseModal} groupId={groupId!} />
  // …rest of your page
}

// File: src/pages/app/CalendarPage.tsx  (only relevant changes shown for brevity)
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeView, setActiveView] = useState<"month" | "week" | "day" | "list">("month");
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [groupName, setGroupName] = useState("");  // groupName state can be removed if not used elsewhere
  // ... etc.

  // Fetch group name if needed for calendar (not strictly necessary now, could remove)
  useEffect(() => {
    if (!groupId || groupId.startsWith(":")) return;
    // (fetch logic can be kept or removed, since welcome modal is gone, groupName might not be needed)
  }, [groupId]);

  // REMOVED welcome modal usage:
  // const { showWelcome, closeWelcome } = useGroupWelcome(groupId || "", groupName);

  // ... rest of CalendarPage logic for handling events, selection, etc.

  // Render:
  if (!groupId || groupId.startsWith(":")) {
    // ... (invalid group handling as before)
  }

  return (
    <div className="container mx-auto p-4">
      <SEO title="Calendar - Care Coordination" description="View and manage care group calendar events" />
      {/* Calendar controls and tabs UI... */}
      <Tabs defaultValue="month" value={activeView} onValueChange={(val) => setActiveView(val as "month" | "week" | "day" | "list")}>
        <TabsList>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>
        <TabsContent value="month">
          <SharedCalendar 
            view={activeView}
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            groupId={groupId!}
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
        onClose={() => { setShowAppointmentModal(false); setSelectedAppointment(null); }}
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
