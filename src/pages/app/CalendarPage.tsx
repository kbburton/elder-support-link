import { useState, useEffect, useMemo } from "react";
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
import { GroupWelcomeModal } from "@/components/welcome/GroupWelcomeModal";
import { useGroupWelcome } from "@/hooks/useGroupWelcome";
import { useLastActiveGroup } from "@/hooks/useLastActiveGroup";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { softDeleteEntity } from "@/lib/delete/rpc";

type SelectedMap = {
  appointment: Set<string>;
  task: Set<string>;
};

const CalendarPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeView, setActiveView] = useState<'month' | 'week' | 'day' | 'list'>('month');
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [groupName, setGroupName] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<SelectedMap>({
    appointment: new Set(),
    task: new Set(),
  });
  const [visibleEvents, setVisibleEvents] = useState<CalendarEvent[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const { blockCreate } = useDemoOperations();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use the last active group hook to update when user navigates to this page
  useLastActiveGroup();

  // Use the welcome modal hook
  const { showWelcome, closeWelcome } = useGroupWelcome(groupId || "", groupName);

  // Fetch group name for welcome modal
  useEffect(() => {
    const fetchGroupName = async () => {
      // Validate groupId before making requests
      if (!groupId || groupId === ':groupId' || groupId === 'undefined' || groupId.startsWith(':')) {
        console.log('Skipping group name fetch for invalid groupId:', groupId);
        return;
      }
      try {
        const { data: group } = await supabase
          .from('care_groups')
          .select('name')
          .eq('id', groupId)
          .single();

        if (group) setGroupName(group.name);
      } catch (error) {
        console.error('Error fetching group name:', error);
      }
    };

    fetchGroupName();
  }, [groupId]);

  // Validate groupId and handle invalid values
  if (!groupId || groupId === ':groupId' || groupId === 'undefined' || groupId.startsWith(':')) {
    console.error('Invalid groupId detected:', groupId);
    
    // Clear any invalid stored group IDs
    const stored = localStorage.getItem('daveassist-current-group');
    if (stored && (stored === ':groupId' || stored === 'undefined' || stored.startsWith(':'))) {
      console.log('Clearing invalid stored group ID:', stored);
      localStorage.removeItem('daveassist-current-group');
    }
    
    return <div className="p-6 text-center">
      <h2 className="text-xl font-semibold mb-2">Invalid Group</h2>
      <p className="text-muted-foreground mb-4">The group ID is not valid. Please select a group from the dropdown.</p>
      <Button onClick={() => window.location.href = '/app/demo/calendar'}>Go to Demo</Button>
    </div>;
  }

  const totalSelected = selected.appointment.size + selected.task.size;

  function resetSelection() {
    setSelected({ appointment: new Set(), task: new Set() });
  }

  function toggleSelectMode(on?: boolean) {
    const next = typeof on === "boolean" ? on : !selectMode;
    setSelectMode(next);
    if (!next) resetSelection();
  }

  function isSelected(evt: CalendarEvent) {
    return evt.type === "appointment"
      ? selected.appointment.has(evt.id)
      : selected.task.has(evt.id);
  }

  function onToggleSelect(evt: CalendarEvent) {
    setSelected((prev) => {
      const next: SelectedMap = {
        appointment: new Set(prev.appointment),
        task: new Set(prev.task),
      };
      if (evt.type === "appointment") {
        if (next.appointment.has(evt.id)) next.appointment.delete(evt.id);
        else next.appointment.add(evt.id);
      } else {
        if (next.task.has(evt.id)) next.task.delete(evt.id);
        else next.task.add(evt.id);
      }
      return next;
    });
  }

  function selectAllVisible() {
    if (!visibleEvents.length) return;
    const next: SelectedMap = { appointment: new Set(), task: new Set() };
    for (const e of visibleEvents) {
      if (e.type === "appointment") next.appointment.add(e.id);
      else next.task.add(e.id);
    }
    setSelected(next);
  }

  function clearSelection() {
    resetSelection();
  }

  const handleNewAppointment = () => {
    if (blockCreate()) return;
    setSelectedAppointment(null);
    setShowAppointmentModal(true);
  };

  const handleEventSelect = (evt: any) => {
    if (evt.type === "appointment") {
      setSelectedAppointment(evt.raw);
      setShowAppointmentModal(true);
    } else if (evt.type === "task") {
      setSelectedTask(evt.raw);
      setShowTaskModal(true);
    }
  };

  async function singleDeleteHandler(evt: CalendarEvent) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      if (evt.type === "appointment") {
        const result = await softDeleteEntity('appointment', evt.id, user.id, user.email!);
        if (!result.success) {
          // Handle "already deleted" case gracefully
          if (result.error?.includes("already deleted") || result.error?.includes("update blocked")) {
            console.log("Item was already deleted, refreshing view...");
            queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
            return; // Don't show error toast for already deleted items
          }
          throw new Error(result.error || 'Delete failed');
        }
      } else {
        const result = await softDeleteEntity('task', evt.id, user.id, user.email!);
        if (!result.success) {
          if (result.error?.includes("already deleted") || result.error?.includes("update blocked")) {
            console.log("Item was already deleted, refreshing view...");
            queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
            return;
          }
          throw new Error(result.error || 'Delete failed');
        }
      }
      toast({ title: "Moved to Trash", description: `${evt.type === "appointment" ? "Appointment" : "Task"} moved to Trash.` });
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
    } catch (e: any) {
      // Only show error toast for real errors, not "already deleted" cases
      if (!(e?.message?.includes("already deleted") || e?.message?.includes("update blocked"))) {
        toast({ title: "Delete failed", description: e?.message ?? "Unable to delete", variant: "destructive" });
      }
    }
  }

  async function bulkDeleteConfirmed() {
    setShowConfirm(false);
    if (totalSelected === 0) {
      toast({ title: "No items selected", description: "Select appointments or tasks first." });
      return;
    }
    const apptIds = Array.from(selected.appointment);
    const taskIds = Array.from(selected.task);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const results = [];
      for (const id of apptIds) {
        try {
          const result = await softDeleteEntity('appointment', id, user.id, user.email!);
          if (!result.success) throw new Error(result.error || 'Delete failed');
          results.push({ status: "fulfilled", value: null });
        } catch (error) {
          results.push({ status: "rejected", reason: error });
        }
      }
      for (const id of taskIds) {
        try {
          const result = await softDeleteEntity('task', id, user.id, user.email!);
          if (!result.success) throw new Error(result.error || 'Delete failed');
          results.push({ status: "fulfilled", value: null });
        } catch (error) {
          results.push({ status: "rejected", reason: error });
        }
      }
      const failures = results.filter(r => r.status === "rejected");
      if (failures.length) {
        console.error(failures);
        toast({ title: "Some deletions failed", description: `${failures.length} item(s) could not be deleted.`, variant: "destructive" });
      } else {
        toast({ title: "Moved to Trash", description: `${totalSelected} item(s) moved to Trash.` });
      }
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      resetSelection();
      setSelectMode(false);
    } catch (e: any) {
      toast({ title: "Bulk delete failed", description: e?.message ?? "Unable to delete", variant: "destructive" });
    }
  }

  const bulkBar = useMemo(() => {
    if (!selectMode) return null;
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
        <div className="rounded-xl border bg-background shadow-lg px-4 py-3 flex items-center gap-3">
          <div className="text-sm">
            <span className="font-medium">{totalSelected}</span> selected
          </div>
          <Button variant="outline" size="sm" onClick={selectAllVisible}>
            <CheckSquare className="h-4 w-4 mr-2" />
            Select all on screen
          </Button>
          <Button variant="outline" size="sm" onClick={clearSelection}>
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowConfirm(true)} disabled={totalSelected === 0}>
            <Trash2 className="h-4 w-4 mr-2" />
            Move to Trash
          </Button>
        </div>
      </div>
    );
  }, [selectMode, totalSelected, visibleEvents]);

  return (
    <div className="space-y-6">
      <SEO title="Calendar — DaveAssist" description="View and manage appointments and tasks in calendar format." />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Calendar</h2>
        <div className="flex items-center gap-2">
          <Button variant="hero" onClick={handleNewAppointment}>
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="list">Full List</TabsTrigger>
        </TabsList>

        <TabsContent value="month">
          <SharedCalendar
            view="month"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            showLegend={true}
            groupId={groupId}
            excludeDeleted={true}
            selectMode={selectMode}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
            onEventDelete={singleDeleteHandler}
            onEventsLoaded={setVisibleEvents}
            onEventSelect={handleEventSelect}
          />
        </TabsContent>

        <TabsContent value="week">
          <SharedCalendar
            view="week"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            showLegend={true}
            groupId={groupId}
            excludeDeleted={true}
            selectMode={selectMode}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
            onEventDelete={singleDeleteHandler}
            onEventsLoaded={setVisibleEvents}
            onEventSelect={handleEventSelect}
          />
        </TabsContent>

        <TabsContent value="day">
          <SharedCalendar
            view="day"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            showLegend={true}
            groupId={groupId}
            excludeDeleted={true}
            selectMode={selectMode}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
            onEventDelete={singleDeleteHandler}
            onEventsLoaded={setVisibleEvents}
            onEventSelect={handleEventSelect}
          />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <h3 className="text-lg font-medium">Full List - Appointments</h3>
          <AppointmentListView
            groupId={groupId}
            onEdit={(appointment) => {
              setSelectedAppointment(appointment);
              setShowAppointmentModal(true);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Welcome modal */}
      <GroupWelcomeModal
        groupId={groupId}
        groupName={groupName}
        isOpen={showWelcome}
        onClose={closeWelcome}
      />

      {/* Create/Edit appointment modal */}
      <EnhancedAppointmentModal
        isOpen={showAppointmentModal}
        onClose={() => {
          setShowAppointmentModal(false);
          setSelectedAppointment(null);
        }}
        appointment={selectedAppointment}
        groupId={groupId}
      />

      {/* Edit task modal */}
      <EnhancedTaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        groupId={groupId}
      />

      {/* Sticky bulk bar */}
      {bulkBar}

      {/* Simple bulk confirm dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background border rounded-xl shadow-xl p-6 w-[420px]">
            <div className="text-lg font-semibold mb-2">Move {totalSelected} item(s) to Trash?</div>
            <p className="text-sm text-muted-foreground mb-4">
              These items will be soft-deleted and can be restored within 30 days by a group admin.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button variant="destructive" onClick={bulkDeleteConfirmed}>
                <Trash2 className="h-4 w-4 mr-2" />
                Move to Trash
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
