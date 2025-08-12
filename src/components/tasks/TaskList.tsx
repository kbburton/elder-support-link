import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, isPast } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { TaskModal } from "./TaskModal";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "Open" | "InProgress" | "Completed";
  priority?: "High" | "Medium" | "Low";
  category?: string;
  due_date?: string;
  completed_at?: string;
  primary_owner_id?: string;
  secondary_owner_id?: string;
  created_by_email?: string;
  completed_by_email?: string;
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
        .select("*")
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

      // Apply sorting
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

      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: "Open" | "InProgress" | "Completed" }) => {
      const updates: any = { status };
      
      if (status === "Completed") {
        updates.completed_at = new Date().toISOString();
        // Get current user info for completed_by fields
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          updates.completed_by_email = user.email;
        }
      } else {
        updates.completed_at = null;
        updates.completed_by_email = null;
      }

      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Task updated",
        description: "Task status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update task status.",
        variant: "destructive",
      });
    },
  });

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleStatusChange = (taskId: string, currentStatus: string) => {
    let newStatus: "Open" | "InProgress" | "Completed";
    
    if (currentStatus === "Completed") {
      newStatus = "Open";
    } else {
      newStatus = "Completed";
    }
    
    updateTaskStatus.mutate({ taskId, status: newStatus });
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