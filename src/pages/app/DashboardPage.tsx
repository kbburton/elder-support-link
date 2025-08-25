// File: src/pages/app/DashboardPage.tsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/layout/SEO";
import { useToast } from "@/hooks/use-toast";
import { useDemo } from "@/hooks/useDemo";
import { useDemoTasks, useDemoAppointments } from "@/hooks/useDemoData";
import { useDemoOperations } from "@/hooks/useDemoOperations";
import { GroupWelcomeModal } from "@/components/welcome/GroupWelcomeModal";
import { useGroupWelcome } from "@/hooks/useGroupWelcome";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UnifiedTableView, TableColumn } from "@/components/shared/UnifiedTableView";
import { EnhancedTaskModal } from "@/components/tasks/EnhancedTaskModal";
import { EnhancedAppointmentModal } from "@/components/appointments/EnhancedAppointmentModal";
import { LayoutDashboard, Calendar, ListTodo } from "lucide-react";  // icons used in headings (optional)

export default function DashboardPage() {
  const { groupId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isDemo } = useDemo();
  const { blockOperation } = useDemoOperations();

  // State for modals and selected items
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isApptModalOpen, setIsApptModalOpen] = useState(false);

  // Load group name and welcome modal logic for first-time access
  const [groupName, setGroupName] = useState("");
  useEffect(() => {
    const fetchGroupName = async () => {
      if (!groupId || groupId === ":groupId" || groupId === "undefined") return;
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
  const { showWelcome, closeWelcome } = useGroupWelcome(groupId || "", groupName);

  // Demo data hooks (if in demo mode, use predefined data instead of querying)
  const demoTasks = useDemoTasks(groupId);
  const demoAppointments = useDemoAppointments(groupId);

  // Fetch open tasks (not Completed) for this group, limited to a few upcoming
  const { data: realTasks = [], isLoading: realTasksLoading } = useQuery({
    queryKey: ["dashboard-tasks", groupId],
    enabled: !!groupId && groupId !== ":groupId" && groupId !== "undefined" && !isDemo,
    queryFn: async () => {
      if (!groupId || groupId === ":groupId" || groupId === "undefined") {
        throw new Error("Invalid group ID");
      }
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          primary_owner: profiles!tasks_primary_owner_id_fkey(first_name, last_name)
        `)
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .neq("status", "Completed")
        .order("due_date", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    }
  });
  const tasks = isDemo && demoTasks.data ? demoTasks.data : realTasks;
  const tasksLoading = isDemo ? false : realTasksLoading;

  // Fetch upcoming appointments (future appointments) for this group
  const { data: realAppointments = [], isLoading: realApptLoading } = useQuery({
    queryKey: ["dashboard-appointments", groupId],
    enabled: !!groupId && groupId !== ":groupId" && groupId !== "undefined" && !isDemo,
    queryFn: async () => {
      if (!groupId || groupId === ":groupId" || groupId === "undefined") {
        throw new Error("Invalid group ID");
      }
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .gte("date_time", new Date().toISOString())
        .order("date_time", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    }
  });
  const appointments = isDemo && demoAppointments.data ? demoAppointments.data : realAppointments;
  const apptLoading = isDemo ? false : realApptLoading;

  // Handle editing (viewing) an appointment
  const handleEditAppointment = (appointment: any) => {
    setSelectedAppointment(appointment);
    setIsApptModalOpen(true);
  };
  // Handle editing a task
  const handleEditTask = (task: any) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  // Mutation to update task status (mark as completed, etc.) from the dashboard
  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }: { taskId: string; newStatus: string }) => {
      if (blockOperation()) return; // Prevent updates in demo mode
      const { data: { user } } = await supabase.auth.getUser();
      const updateData: any = { status: newStatus };
      if (newStatus === "Completed" && user) {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by_user_id = user.id;
        updateData.completed_by_email = user.email;
      } else if (newStatus !== "Completed") {
        updateData.completed_at = null;
        updateData.completed_by_user_id = null;
        updateData.completed_by_email = null;
      }
      const { error } = await supabase.from("tasks").update(updateData).eq("id", taskId);
      if (error) throw error;
      // Optionally trigger search index update (if used in background)
      try {
        await supabase.rpc("reindex_row", { p_entity_type: "task", p_entity_id: taskId });
      } catch (err) {
        console.warn("Reindex trigger failed:", err);
      }
      return { taskId, newStatus };
    },
    onSuccess: () => {
      // Refresh tasks queries to reflect updated status
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      toast({ title: "Status Updated", description: "Task status has been updated." });
    },
    onError: (error) => {
      console.error("Status update failed:", error);
      toast({ title: "Error", description: "Failed to update task status.", variant: "destructive" });
    }
  });

  // Render helper for status dropdown in task table
  const StatusDropdown = ({ task }: { task: any }) => (
    <select
      className="border border-input rounded px-2 py-1 text-sm"
      value={task.status}
      onChange={(e) => updateStatusMutation.mutate({ taskId: task.id, newStatus: e.target.value })}
      disabled={updateStatusMutation.isLoading || updateStatusMutation.isPaused}
    >
      <option value="Open">Open</option>
      <option value="InProgress">In Progress</option>
      <option value="Completed">Completed</option>
    </select>
  );

  // Helper to style the priority badge colors
  const getPriorityBadgeVariant = (priority?: string) => {
    switch (priority) {
      case "High": return "destructive";
      case "Medium": return "default";
      case "Low": return "secondary";
      default: return "outline";
    }
  };

  // Define table columns for tasks (open tasks preview)
  const taskColumns: TableColumn[] = [
    {
      key: "status",
      label: "Status",
      sortable: true,
      filterable: true,
      render: (_, row) => <StatusDropdown task={row} />
    },
    {
      key: "priority",
      label: "Priority",
      sortable: true,
      filterable: true,
      type: "badge",
      getBadgeVariant: getPriorityBadgeVariant
    },
    {
      key: "title",
      label: "Title",
      sortable: true,
      filterable: true,
      type: "text"
    },
    {
      key: "due_date",
      label: "Due Date",
      sortable: true,
      type: "date"
    },
    {
      key: "primary_owner",
      label: "Assigned To",
      sortable: false,
      type: "text",
      render: (_, row) => {
        const profile = row.primary_owner;
        if (!profile) return "-";
        const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
        return name || "-";
      }
    }
  ];

  // Define table columns for appointments (upcoming appointments preview)
  const apptColumns: TableColumn[] = [
    {
      key: "description",
      label: "Description",
      sortable: true,
      filterable: true,
      type: "text"
    },
    {
      key: "date_time",
      label: "Date & Time",
      sortable: true,
      type: "datetime"
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      filterable: true,
      type: "badge",
      getBadgeVariant: (value) => value ? "secondary" : "outline"
    },
    {
      key: "location",
      label: "Location",
      sortable: true,
      filterable: true,
      type: "text",
      render: (value, row) => {
        // Combine address fields if available
        if (!row) return "";
        const parts = [row.street_address || row.location, row.city, row.state, row.zip_code].filter(Boolean);
        return parts.length ? parts.join(", ") : "";
      }
    },
    {
      key: "duration_minutes",
      label: "Duration",
      sortable: true,
      type: "text",
      render: (value) => value ? `${value} min` : "-"
    }
  ];

  if (!groupId || groupId === ":groupId") {
    // If groupId is not provided in URL (unlikely in normal use), show a placeholder
    return <div className="p-6 text-center">No group selected.</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <SEO title="Dashboard - Care Coordination" description="Overview of your care group’s tasks and appointments" />
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of upcoming events and tasks for your care group
            </p>
          </div>
        </div>
        {/* (Optional) Add any global action buttons here if needed */}
      </div>

      {/* Upcoming Appointments Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-2">Upcoming Appointments</h2>
        <UnifiedTableView
          title=""  // no internal title since we use our own heading
          data={appointments}
          columns={apptColumns}
          loading={apptLoading}
          onEdit={handleEditAppointment}
          entityType="appointment"
          searchable={false}
          emptyMessage="No upcoming appointments"
          emptyDescription="Nothing scheduled for now."
        />
      </div>

      {/* Pending Tasks Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-2">Pending Tasks</h2>
        <UnifiedTableView
          title=""
          data={tasks}
          columns={taskColumns}
          loading={tasksLoading}
          onEdit={handleEditTask}
          entityType="task"
          searchable={false}
          emptyMessage="No pending tasks"
          emptyDescription="You're all caught up! No tasks need attention."
        />
      </div>

      {/* Welcome modal for first-time group access */}
      <GroupWelcomeModal 
        groupId={groupId}
        groupName={groupName}
        isOpen={showWelcome}
        onClose={closeWelcome}
      />

      {/* Modals for editing/creating appointments and tasks */}
      <EnhancedAppointmentModal
        isOpen={isApptModalOpen}
        onClose={() => {
          setIsApptModalOpen(false);
          setSelectedAppointment(null);
          // Optionally refetch appointments list after any changes
          queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
        }}
        appointment={selectedAppointment}
        groupId={groupId}
      />
      <EnhancedTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTask(null);
          queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
        }}
        task={selectedTask}
        groupId={groupId}
      />
    </div>
  );
}

