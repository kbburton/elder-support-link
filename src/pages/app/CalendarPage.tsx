import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";
import SharedCalendar from "@/components/calendar/SharedCalendar";
import { AppointmentModal } from "@/components/appointments/AppointmentModal";
import { useDemoOperations } from "@/hooks/useDemoOperations";
import { GroupWelcomeModal } from "@/components/welcome/GroupWelcomeModal";
import { useGroupWelcome } from "@/hooks/useGroupWelcome";
import { useLastActiveGroup } from "@/hooks/useLastActiveGroup";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

type CalendarEventType = "appointment" | "task";
type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  // raw DB row (shape varies per type; we only need id)
  raw?: any;
};

const CalendarPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeView, setActiveView] = useState<"month" | "week" | "day" | "list">("month");

  // When an event is clicked in the calendar, we store it here
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Separate modal state for creating/editing appointments from the “New Appointment” button
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");

  const { blockCreate } = useDemoOperations();
  const queryClient = useQueryClient();

  // Keep last active group fresh
  useLastActiveGroup();

  // Welcome modal
  const { showWelcome, closeWelcome } = useGroupWelcome(groupId || "", groupName);

  // Fetch group name for welcome modal
  useEffect(() => {
    const fetchGroupName = async () => {
      if (!groupId) return;
      try {
        const { data: group } = await supabase
          .from("care_groups")
          .select("name")
          .eq("id", groupId)
          .single();
        if (group) setGroupName(group.name);
      } catch (error) {
        console.error("Error fetching group name:", error);
      }
    };
    fetchGroupName();
  }, [groupId]);

  // Get current user (for audit fields in RPCs)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email ?? "");
      }
    })();
  }, []);

  if (!groupId) {
    return <div>Group ID not found</div>;
  }

  const handleNewAppointment = () => {
    if (blockCreate()) return;
    setShowAppointmentModal(true);
  };

  /**
   * Soft-delete mutations.
   * These call the RPCs we created earlier and then invalidate calendar queries.
   * SharedCalendar will refresh because its react-query keys depend on groupId/date/view.
   */

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const ok = window.confirm("Move this appointment to Trash?");
      if (!ok) return;
      const { error } = await supabase.rpc("soft_delete_appointment", {
        p_appointment_id: id,
        p_by_user_id: currentUserId,
        p_by_email: currentUserEmail,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      // SharedCalendar should be using a key like ["calendar-events", groupId, view, dateRange]
      queryClient.invalidateQueries(); // broad invalidation is fine here
      toast({ title: "Moved to Trash", description: "Appointment was soft-deleted." });
      setSelectedEvent(null);
    },
    onError: (e: any) => {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const ok = window.confirm("Move this task to Trash?");
      if (!ok) return;
      const { error } = await supabase.rpc("soft_delete_task", {
        p_task_id: id,
        p_by_user_id: currentUserId,
        p_by_email: currentUserEmail,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Moved to Trash", description: "Task was soft-deleted." });
      setSelectedEvent(null);
    },
    onError: (e: any) => {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    },
  });

  // Centralized delete handler (Calendar → this page)
  const handleEventDelete = useCallback(
    (evt: CalendarEvent) => {
      if (!evt?.id || !evt?.type) return;
      if (evt.type === "appointment") {
        deleteAppointmentMutation.mutate(evt.id);
      } else if (evt.type === "task") {
        deleteTaskMutation.mutate(evt.id);
      }
    },
    [deleteAppointmentMutation, deleteTaskMutation]
  );

  // Calendar tells us which event the user clicked; we keep it here to let modals use it if needed
  const handleEventSelect = useCallback((evt: CalendarEvent) => {
    setSelectedEvent(evt || null);
  }, []);

  // For convenience: show an action button if something is selected
  const showInlineDelete =
    !!selectedEvent && (selectedEvent.type === "appointment" || selectedEvent.type === "task");

  return (
    <div className="space-y-6">
      <SEO title="Calendar — DaveAssist" description="View and manage appointments and tasks in calendar format." />

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Calendar</h2>

        <div className="flex items-center gap-2">
          {showInlineDelete ? (
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedEvent) handleEventDelete(selectedEvent);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          ) : null}

          <Button variant="hero" onClick={handleNewAppointment}>
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="list">Full List</TabsTrigger>
        </TabsList>

        {/* IMPORTANT:
            The two props below (`onEventSelect`, `onEventDelete`) will be
            implemented in SharedCalendar next:
            - onEventSelect(evt) → call this when user clicks an event
            - onEventDelete(evt) → call this when user clicks "Delete" in an event modal
            Also, SharedCalendar should filter .eq("is_deleted", false) for both appointments and tasks.
        */}

        <TabsContent value="month">
          <SharedCalendar
            view="month"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            showLegend={true}
            groupId={groupId}
            // @ts-expect-error: wired in next step
            onEventSelect={handleEventSelect}
            // @ts-expect-error: wired in next step
            onEventDelete={handleEventDelete}
            // @ts-expect-error: wired in next step
            excludeDeleted={true}
          />
        </TabsContent>

        <TabsContent value="week">
          <SharedCalendar
            view="week"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            showLegend={true}
            groupId={groupId}
            // @ts-expect-error: wired in next step
            onEventSelect={handleEventSelect}
            // @ts-expect-error: wired in next step
            onEventDelete={handleEventDelete}
            // @ts-expect-error: wired in next step
            excludeDeleted={true}
          />
        </TabsContent>

        <TabsContent value="day">
          <SharedCalendar
            view="day"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            showLegend={true}
            groupId={groupId}
            // @ts-expect-error: wired in next step
            onEventSelect={handleEventSelect}
            // @ts-expect-error: wired in next step
            onEventDelete={handleEventDelete}
            // @ts-expect-error: wired in next step
            excludeDeleted={true}
          />
        </TabsContent>

        <TabsContent value="list">
          <SharedCalendar
            view="list"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            showLegend={true}
            groupId={groupId}
            // @ts-expect-error: wired in next step
            onEventSelect={handleEventSelect}
            // @ts-expect-error: wired in next step
            onEventDelete={handleEventDelete}
            // @ts-expect-error: wired in next step
            excludeDeleted={true}
          />
        </TabsContent>
      </Tabs>

      <GroupWelcomeModal
        groupId={groupId}
        groupName={groupName}
        isOpen={showWelcome}
        onClose={closeWelcome}
      />

      {/* This modal handles "New Appointment" from header button.
         Editing existing appointments from calendar clicks continues to be handled inside SharedCalendar’s event modal;
         if you’d like to reuse this modal for edit too, we can wire it in next. */}
      <AppointmentModal
        isOpen={showAppointmentModal}
        onClose={() => setShowAppointmentModal(false)}
        appointment={undefined}
        groupId={groupId}
      />
    </div>
  );
};

export default CalendarPage;
