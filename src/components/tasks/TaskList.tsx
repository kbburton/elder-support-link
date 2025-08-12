import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, isPast } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { TaskModal } from "./TaskModal";
import { triggerReindex } from "@/utils/reindex";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "Open" | "InProgress" | "Completed";
  priority?: "High" | "Medium" | "Low";
  category?: string;
  due_date?: string;
  completed_at?: string;
  completed_by_user_id?: string;
  primary_owner_id?: string;
  secondary_owner_id?: string;
  created_by_email?: string;
  completed_by_email?: string;
  task_recurrence_rules?: Array<{
    id: string;
    pattern_type: string;
  }> | null;
}

interface TaskListProps {
  groupId: string;
  sortBy: string;
  filters: {
    status: string[];
    assignee?: string;
    priority: string[];
    category: string[];
    dueDateRange?: { start?: string; end?: string };
    mine: boolean;
  };
  hideCompleted: boolean;
  searchQuery?: string;
}

export function TaskList({ groupId, sortBy, filters, hideCompleted, searchQuery }: TaskListProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", groupId, sortBy, filters, hideCompleted, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          task_recurrence_rules(id, pattern_type)
        `)
        .eq("group_id", groupId);

      // Apply filters
      if (filters.status.length > 0) {
        query = query.in("status", filters.status as ("Open" | "InProgress" | "Completed")[]);
      }

      if (filters.priority.length > 0) {
        query = query.in("priority", filters.priority as ("High" | "Medium" | "Low")[]);
      }

      if (filters.category.length > 0) {
        query = query.in("category", filters.category);
      }

      if (hideCompleted) {
        query = query.neq("status", "Completed");
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      // Apply default sorting: Status (Open→InProgress→Completed), then Due Date asc, Priority High→Low, Title
      if (sortBy === "default") {
        // Custom status ordering with CASE for proper Open→InProgress→Completed order
        query = query.order("status", { ascending: true })
                     .order("due_date", { ascending: true, nullsFirst: false })
                     .order("priority", { ascending: false })
                     .order("title", { ascending: true });
      } else {
        // Apply individual sorts
        switch (sortBy) {
          case "status":
            query = query.order("status", { ascending: true });
            break;
          case "due_date":
            query = query.order("due_date", { ascending: true, nullsFirst: false });
            break;
          case "priority":
            query = query.order("priority", { ascending: false });
            break;
          case "title":
            query = query.order("title", { ascending: true });
            break;
          default:
            query = query.order("created_at", { ascending: false });
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: any }) => {
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: async (_, { taskId }) => {
      // Trigger reindex fire-and-forget
      try {
        await triggerReindex('tasks', taskId);
      } catch (error) {
        console.warn('Failed to trigger reindex:', error);
      }
      
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error, { taskId }) => {
      // Revert optimistic update
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Error",
        description: "Failed to update task status. Changes have been reverted.",
        variant: "destructive",
      });
    },
  });

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleStatusChange = async (taskId: string, currentStatus: string) => {
    // Get current user for completion tracking
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isCompleting = currentStatus !== "Completed";
    const task = tasks.find(t => t.id === taskId);
    
    let updates: any;
    if (isCompleting) {
      // Completing the task
      updates = {
        status: "Completed",
        completed_at: new Date().toISOString(),
        completed_by_user_id: user.id,
        completed_by_email: user.email,
      };

      // If task is recurring, trigger creation of next instance
      if (task?.task_recurrence_rules && task.task_recurrence_rules.length > 0) {
        try {
          await supabase.functions.invoke('create-next-recurring-task', {
            body: { 
              taskId: taskId,
              completedAt: new Date().toISOString()
            }
          });
        } catch (error) {
          console.warn('Failed to create next recurring instance:', error);
          // Don't fail the completion, just warn
        }
      }
    } else {
      // Uncompleting the task
      updates = {
        status: "InProgress",
        completed_at: null,
        completed_by_user_id: null,
        completed_by_email: null,
      };
    }

    // Optimistic update
    queryClient.setQueryData(["tasks", groupId, sortBy, filters, hideCompleted, searchQuery], (oldTasks: Task[] | undefined) => {
      if (!oldTasks) return oldTasks;
      return oldTasks.map(task => 
        task.id === taskId 
          ? { ...task, ...updates }
          : task
      );
    });

    updateTaskStatus.mutate({ taskId, updates });
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "High":
        return "destructive";
      case "Medium":
        return "secondary";
      case "Low":
        return "outline";
      default:
        return "outline";
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return isPast(new Date(dueDate)) && new Date(dueDate).toDateString() !== new Date().toDateString();
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return <div className="text-muted-foreground">No tasks found.</div>;
  }

  return (
    <>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`
              border border-border rounded-lg p-4 transition-all hover:shadow-sm
              ${task.status === "Completed" ? "opacity-50" : ""}
              ${isOverdue(task.due_date) && task.status !== "Completed" ? "border-destructive bg-destructive/5" : ""}
            `}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={task.status === "Completed"}
                onCheckedChange={() => handleStatusChange(task.id, task.status)}
                className="mt-1"
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <Button
                    variant="ghost"
                    className="p-0 h-auto font-medium text-left justify-start hover:bg-transparent"
                    onClick={() => handleTaskClick(task)}
                  >
                    <span className={task.status === "Completed" ? "line-through" : ""}>
                      {task.title}
                    </span>
                  </Button>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {task.task_recurrence_rules && task.task_recurrence_rules.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Recurring
                      </Badge>
                    )}
                    {task.category && (
                      <Badge variant="outline" className="text-xs">
                        {task.category}
                      </Badge>
                    )}
                    {task.priority && (
                      <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                        {task.priority}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {task.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {task.description}
                  </p>
                )}
                
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  {task.due_date && (
                    <span className={isOverdue(task.due_date) && task.status !== "Completed" ? "text-destructive font-medium" : ""}>
                      Due: {format(new Date(task.due_date), "MMM d, yyyy")}
                    </span>
                  )}
                  {task.created_by_email && (
                    <span>Created by: {task.created_by_email}</span>
                  )}
                  {task.completed_at && task.completed_by_email && (
                    <span>Completed by: {task.completed_by_email}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <TaskModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTask(null);
        }}
        groupId={groupId}
      />
    </>
  );
}