import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UnifiedTableView, TableColumn } from "@/components/shared/UnifiedTableView";
import { softDeleteEntity } from "@/lib/delete/rpc";
import { triggerReindex } from "@/utils/reindex";
import { useDemoOperations } from "@/hooks/useDemoOperations";
import { useDemo } from "@/hooks/useDemo";
import { useDemoTasks } from "@/hooks/useDemoData";
import { Link } from "lucide-react";
import { TaskAssociationsModal } from "./TaskAssociationsModal";
import { cn } from "@/lib/utils";

interface TaskListViewProps {
  groupId: string;
  onEdit: (task: any) => void;
}

export function TaskListView({ groupId, onEdit }: TaskListViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { blockOperation } = useDemoOperations();
  const { isDemo } = useDemo();
  const [selectedTaskForAssociations, setSelectedTaskForAssociations] = useState<any>(null);
  const [isAssociationsModalOpen, setIsAssociationsModalOpen] = useState(false);

  // Use demo data if in demo mode
  const demoTasks = useDemoTasks(groupId);

  const { data: realTasks = [], refetch, isLoading: realLoading } = useQuery({
    queryKey: ["tasks-list", groupId],
    enabled: !!groupId && groupId !== ':groupId' && groupId !== 'undefined' && !isDemo,
    queryFn: async () => {
      if (!groupId || groupId === ':groupId' || groupId === 'undefined') {
        throw new Error('Invalid group ID');
      }
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          primary_owner:profiles!tasks_primary_owner_id_fkey(first_name, last_name),
          secondary_owner:profiles!tasks_secondary_owner_id_fkey(first_name, last_name),
          created_by:profiles!tasks_created_by_user_id_fkey(first_name, last_name)
        `)
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Use demo data if available, otherwise use real data
  const tasks = isDemo && demoTasks.data ? demoTasks.data : realTasks;
  const isLoading = isDemo ? false : realLoading;

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }: { taskId: string; newStatus: string }) => {
      if (blockOperation()) return;

      const { data: { user } } = await supabase.auth.getUser();
      const updateData: any = { status: newStatus };

      // Auto-fill completion fields if marking as completed
      if (newStatus === "Completed" && user) {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by_user_id = user.id;
        updateData.completed_by_email = user.email;
      } else if (newStatus !== "Completed") {
        // Clear completion fields if not completed
        updateData.completed_at = null;
        updateData.completed_by_user_id = null;
        updateData.completed_by_email = null;
      }

      const { error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskId);

      if (error) throw error;

      // Trigger reindex
      try {
        await triggerReindex('tasks', taskId);
      } catch (error) {
        console.warn('Failed to trigger reindex:', error);
      }

      return { taskId, newStatus };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      toast({
        title: "Status updated",
        description: "Task status has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error('Status update failed:', error);
      toast({
        title: "Error",
        description: "Failed to update task status.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const result = await softDeleteEntity('task', id, user.id, user.email!);
      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }
      
      toast({
        title: "Task deleted",
        description: "The task has been deleted and can be restored from group settings within 30 days.",
      });
      
      await refetch();
    } catch (error) {
      console.error('Delete failed:', error);
      toast({
        title: "Error",
        description: "Failed to delete task.",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const results = await Promise.allSettled(
        ids.map(id => softDeleteEntity('task', id, user.id, user.email!))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (successful > 0) {
        toast({
          title: `${successful} task${successful > 1 ? 's' : ''} deleted`,
          description: "Items have been deleted and can be restored from group settings within 30 days.",
        });
      }
      
      if (failed > 0) {
        toast({
          title: "Some deletions failed",
          description: `${failed} task${failed > 1 ? 's' : ''} could not be deleted.`,
          variant: "destructive",
        });
      }
      
      await refetch();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      toast({
        title: "Error",
        description: "Failed to delete tasks.",
        variant: "destructive",
      });
    }
  };

  const StatusDropdown = ({ task }: { task: any }) => (
    <Select
      value={task.status}
      onValueChange={(value) => updateStatusMutation.mutate({ taskId: task.id, newStatus: value })}
      disabled={updateStatusMutation.isPending || blockOperation()}
    >
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="Open">Open</SelectItem>
        <SelectItem value="InProgress">In Progress</SelectItem>
        <SelectItem value="Completed">Completed</SelectItem>
      </SelectContent>
    </Select>
  );

  const getPriorityBadgeVariant = (priority?: string) => {
    switch (priority) {
      case 'High': return 'destructive';
      case 'Medium': return 'default';
      case 'Low': return 'secondary';
      default: return 'outline';
    }
  };

  const formatUserName = (profile?: any) => {
    if (!profile) return '-';
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
    return fullName || profile.email || '-';
  };

  const columns: TableColumn[] = [
    {
      key: "status",
      label: "Status",
      sortable: true,
      filterable: true,
      type: "text",
      render: (value, row) => <StatusDropdown task={row} />
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
      key: "description",
      label: "Description",
      sortable: false,
      filterable: true,
      type: "text",
      render: (value) => {
        if (!value) return '-';
        const lines = value.split('\n');
        const truncated = lines.slice(0, 3).join('\n');
        return (
          <div className="max-w-xs">
            <div className="line-clamp-3 text-sm">
              {truncated}
              {lines.length > 3 && '...'}
            </div>
          </div>
        );
      }
    },
    {
      key: "due_date",
      label: "Due Date",
      sortable: true,
      type: "date"
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
      key: "primary_owner",
      label: "Assigned To",
      sortable: false,
      type: "text",
      render: (value, row) => formatUserName(row.primary_owner)
    },
    {
      key: "created_by",
      label: "Created By",
      sortable: false,
      type: "text",
      render: (value, row) => formatUserName(row.created_by)
    }
  ];

  return (
    <>
      <UnifiedTableView
        title="All Tasks"
        data={tasks}
        columns={columns}
        loading={isLoading}
        onEdit={onEdit}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        customActions={(row) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTaskForAssociations(row);
              setIsAssociationsModalOpen(true);
            }}
            className="h-8 w-8 p-0"
          >
            <Link className="h-4 w-4" />
          </Button>
        )}
        searchable={true}
        searchPlaceholder="Search tasks..."
        defaultSortBy="created_at"
        defaultSortOrder="desc"
        entityType="task"
        emptyMessage="No tasks found"
        emptyDescription="Create your first task to get started."
        rowClassName={(row) => {
          const completed = row.status === "Completed";
          return cn(
            completed && "opacity-60",
            completed && "[&_td:not(:last-child)_*]:line-through [&_td:not(:last-child)_span]:line-through"
          );
        }}
      />

      <TaskAssociationsModal
        task={selectedTaskForAssociations}
        isOpen={isAssociationsModalOpen}
        onClose={() => {
          setIsAssociationsModalOpen(false);
          setSelectedTaskForAssociations(null);
        }}
        groupId={groupId}
      />
    </>
  );
}