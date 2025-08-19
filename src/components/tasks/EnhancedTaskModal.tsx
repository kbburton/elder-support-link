import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Trash2 } from "lucide-react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDemo } from "@/hooks/useDemo";
import { softDeleteEntity } from "@/lib/delete/rpc";
import { triggerReindex } from "@/utils/reindex";
import { AssociationManager } from "@/components/shared/AssociationManager";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "Open" | "InProgress" | "Completed";
  priority?: "High" | "Medium" | "Low";
  category?: string;
  due_date?: string;
  completed_at?: string;
  completed_by_email?: string;
  completed_by_user_id?: string;
  primary_owner_id?: string;
  secondary_owner_id?: string;
}

interface EnhancedTaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

export function EnhancedTaskModal({ task, isOpen, onClose, groupId }: EnhancedTaskModalProps) {
  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    status: task?.status || "Open",
    priority: task?.priority || "Medium",
    category: task?.category || "",
  });
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task?.due_date ? new Date(task.due_date) : undefined
  );
  const [completedAt, setCompletedAt] = useState<Date | undefined>(
    task?.completed_at ? new Date(task.completed_at) : undefined
  );
  const [completedBy, setCompletedBy] = useState<string>(
    task?.completed_by_user_id || ""
  );
  const [primaryOwner, setPrimaryOwner] = useState<string>(
    task?.primary_owner_id || ""
  );
  const [secondaryOwner, setSecondaryOwner] = useState<string>(
    task?.secondary_owner_id || ""
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const demo = useDemo();
  const { data: groupMembers = [], isLoading: membersLoading, error: membersError } = useGroupMembers(groupId);
  
  // Debug logging - remove after testing
  console.log('GroupMembers Debug:', { groupId, groupMembers, membersLoading, membersError });
  console.log('GroupMembers raw data:', groupMembers);

  const blockOperation = () => {
    if (demo.isDemo) {
      toast({
        title: "Demo Mode",
        description: "This action is not available in demo mode.",
        variant: "destructive",
      });
      return true;
    }
    return false;
  };

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || "",
        description: task.description || "",
        status: task.status || "Open",
        priority: task.priority || "Medium",
        category: task.category || "",
      });
      setDueDate(task.due_date ? new Date(task.due_date) : undefined);
      setCompletedAt(task.completed_at ? new Date(task.completed_at) : undefined);
      setCompletedBy(task.completed_by_user_id || "");
      setPrimaryOwner(task.primary_owner_id || "");
      setSecondaryOwner(task.secondary_owner_id || "");
    } else {
      setFormData({
        title: "",
        description: "",
        status: "Open",
        priority: "Medium",
        category: "",
      });
      setDueDate(undefined);
      setCompletedAt(undefined);
      setCompletedBy("");
      setPrimaryOwner("");
      setSecondaryOwner("");
    }
  }, [task]);

  // Handle status changes - auto-populate or clear completion fields
  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === "Completed" && formData.status !== "Completed") {
      // Auto-populate completion fields when changing TO completed
      setCompletedAt(new Date());
      const { data: { user } } = await supabase.auth.getUser();
      if (user && groupMembers.length > 0) {
        // Find the current user in the group members list
        const currentMember = groupMembers.find(member => member.email === user.email);
        if (currentMember) {
          setCompletedBy(currentMember.id);
        }
      }
    } else if (newStatus !== "Completed" && formData.status === "Completed") {
      // Clear completion fields when changing AWAY from completed
      setCompletedAt(undefined);
      setCompletedBy("");
    }
    
    setFormData({ ...formData, status: newStatus as "Open" | "InProgress" | "Completed" });
  };

  const createTask = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: newTask, error } = await supabase
        .from("tasks")
        .insert({
          ...data,
          group_id: groupId,
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return newTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      toast({
        title: "Task created",
        description: "Task has been created successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create task.",
        variant: "destructive",
      });
    },
  });

  const updateTask = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("tasks")
        .update(data)
        .eq("id", task!.id);

      if (error) throw error;

      // Trigger reindex
      try {
        await triggerReindex('tasks', task!.id);
      } catch (error) {
        console.warn('Failed to trigger reindex:', error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      toast({
        title: "Task updated",
        description: "Task has been updated successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update task.",
        variant: "destructive",
      });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async () => {
      if (!task) throw new Error("No task to delete");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await softDeleteEntity("task", task.id, user.id, user.email || "");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      toast({
        title: "Task deleted",
        description: "Task has been moved to trash and can be restored within 30 days.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete task.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (blockOperation()) return;

    const submitData = {
      ...formData,
      due_date: dueDate ? dueDate.toISOString().split("T")[0] : null,
      completed_at: formData.status === "Completed" && completedAt ? completedAt.toISOString() : null,
      completed_by_user_id: formData.status === "Completed" && completedBy ? completedBy : null,
      primary_owner_id: primaryOwner || null,
      secondary_owner_id: secondaryOwner || null,
    };

    if (task) {
      updateTask.mutate(submitData);
    } else {
      createTask.mutate(submitData);
    }
  };

  const handleDelete = () => {
    if (blockOperation()) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    deleteTask.mutate();
    setShowDeleteConfirm(false);
  };

  const handleNavigate = (type: string, id: string) => {
    // Navigate to the related item
    const baseUrl = `/app/${groupId}`;
    let url = '';
    
    switch (type) {
      case 'contact':
        url = `${baseUrl}/contacts`;
        break;
      case 'appointment':
        url = `${baseUrl}/calendar`;
        break;
      case 'document':
        url = `${baseUrl}/documents`;
        break;
      case 'activity':
        url = `${baseUrl}/activities`;
        break;
      default:
        return;
    }
    
    window.open(url, '_blank');
  };

  const categories = ["Medical", "Personal", "Financial", "Legal", "Other"];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Create Task"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Task Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Task Details</h3>
              
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="InProgress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {/* Assignment Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Primary Owner</Label>
                  <Select
                    value={primaryOwner}
                    onValueChange={setPrimaryOwner}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Secondary Owner</Label>
                  <Select
                    value={secondaryOwner}
                    onValueChange={setSecondaryOwner}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select secondary owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Completion Fields - Only show if task is completed */}
            {formData.status === "Completed" && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Completion Details</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Completed Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !completedAt && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {completedAt ? format(completedAt, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={completedAt}
                            onSelect={setCompletedAt}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>Completed By</Label>
                      <Select
                        value={completedBy}
                        onValueChange={setCompletedBy}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {groupMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="flex gap-2">
              <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>
                {task ? "Update" : "Create"} Task
              </Button>
              {task && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={deleteTask.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>

          {/* Associations Panel */}
          {task && (
            <div className="space-y-4">
              <AssociationManager
                entityId={task.id}
                entityType="task"
                groupId={groupId}
                onNavigate={handleNavigate}
              />
            </div>
          )}
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action will soft delete the item and it can be restored from group settings within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}