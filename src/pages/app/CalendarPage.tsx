import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CheckSquare, Square, Trash2, X } from "lucide-react";
import SharedCalendar, { CalendarEvent } from "@/components/calendar/SharedCalendar";
import { AppointmentModal } from "@/components/appointments/AppointmentModal";
import { useDemoOperations } from "@/hooks/useDemoOperations";
import { GroupWelcomeModal } from "@/components/welcome/GroupWelcomeModal";
import { useGroupWelcome } from "@/hooks/useGroupWelcome";
import { useLastActiveGroup } from "@/hooks/useLastActiveGroup";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type SelectedMap = {
  appointment: Set<string>;
  task: Set<string>;
};

const CalendarPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeView, setActiveView] = useState<'month' | 'week' | 'day' | 'list'>('month');
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
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
      if (!groupId) return;
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

  if (!groupId) {
    return <div>Group ID not found</div>;
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
    setShowAppointmentModal(true);
  };

  async function singleDeleteHandler(evt: CalendarEvent) {
    try {
      if (evt.type === "appointment") {
        const { error } = await supabase.rpc("soft_delete_appointment", { _appointment_id: evt.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("soft_delete_task", { _task_id: evt.id });
        if (error) throw error;
      }
      toast({ title: "Moved to Trash", description: `${evt.type === "appointment" ? "Appointment" : "Task"} moved to Trash.` });
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message ?? "Unable to delete", variant: "destructive" });
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
      const promises: Promise<any>[] = [];
      for (const id of apptIds) promises.push(supabase.rpc("soft_delete_appointment", { _appointment_id: id }));
      for (const id of taskIds) promises.push(supabase.rpc("soft_delete_task", { _task_id: id }));
      const results = await Promise.allSettled(promises);
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
          {!selectMode ? (
            <Button variant="outline" onClick={() => toggleSelectMode(true)}>
              <Square className="h-4 w-4 mr-2" />
              Select
            </Button>
          ) : (
            <Button variant="outline" onClick={() => toggleSelectMode(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel Select
            </Button>
          )}
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
          />
        </TabsContent>

        <TabsContent value="list">
          <SharedCalendar
            view="list"
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

      {/* Create appointment modal */}
      <AppointmentModal
        isOpen={showAppointmentModal}
        onClose={() => setShowAppointmentModal(false)}
        appointment={undefined}
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
