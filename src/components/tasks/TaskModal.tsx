import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import ContactMultiSelect from "@/components/contacts/ContactMultiSelect";
import { AssociationManager } from "@/components/shared/AssociationManager";
import { triggerReindex } from "@/utils/reindex";
import { RecurrenceModal } from "./RecurrenceModal";
import { useLinkedContacts } from "@/hooks/useLinkedContacts";
import { useContactLinkOperations } from "@/hooks/useContactLinkOperations";
import { useDemoOperations } from "@/hooks/useDemoOperations";
import { useSimpleDemoState } from "@/hooks/useSimpleDemoState";
import RowDelete from "@/components/delete/RowDelete";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "Open" | "InProgress" | "Completed";
  priority?: "High" | "Medium" | "Low";
  category?: string;
  due_date?: string;
  primary_owner_id?: string;
  secondary_owner_id?: string;
  completed_at?: string;
  completed_by_user_id?: string;
  completed_by_email?: string;
}

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

export function TaskModal({ task, isOpen, onClose, groupId }: TaskModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "Open" as "Open" | "InProgress" | "Completed",
    priority: "Medium" as "High" | "Medium" | "Low",
    category: "",
    primary_owner_id: "",
    secondary_owner_id: "",
    completed_at: "",
    completed_by_user_id: "",
    completed_by_email: "",
  });
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [completedAt, setCompletedAt] = useState<Date | undefined>(undefined);
  const [relatedContacts, setRelatedContacts] = useState<string[]>([]);
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<any>(null);
  // Use simplified demo state to prevent infinite loops
  const { blockOperation, demoProfiles } = useSimpleDemoState();

  // Get task recurrence rule if editing existing task
  const { data: recurrenceRule } = useQuery({
    queryKey: ["task-recurrence", task?.id],
    queryFn: async () => {
      if (!task?.id) return null;
      const { data, error } = await supabase
        .from("task_recurrence_rules")
        .select("*")
        .eq("task_id", task.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // Ignore not found errors
      return data;
    },
    enabled: !!task?.id,
  });

  // Get linked contacts if editing existing task
  const { data: linkedContactsData = [] } = useLinkedContacts("task", task?.id || "");
  const { persistContactLinks } = useContactLinkOperations();

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name, last_name")
          .eq("user_id", user.id)
          .single();
        
        setCurrentUser({
          id: user.id,
          email: user.email,
          ...profile
        });
      }
    };
    getCurrentUser();
  }, []);

  // Get group members for assignee options - use demo data if in demo mode
  const { data: fetchedGroupMembers = [] } = useQuery({
    queryKey: ["groupMembers", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_group_members")
        .select("user_id")
        .eq("group_id", groupId);

      if (error) throw error;
      
      if (!data?.length) return [];
      
      const userIds = data.map(m => m.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, email, first_name, last_name")
        .in("user_id", userIds);
        
      if (profileError) throw profileError;
      
      return profiles?.map(profile => {
        const firstName = profile.first_name || "";
        const lastName = profile.last_name || "";
        const fullName = `${firstName} ${lastName}`.trim();
        return {
          id: profile.user_id,
          email: profile.email || "",
          name: fullName || profile.email || "Unknown User"
        };
      }) || [];
    },
    enabled: !!groupId && !demoProfiles.isDemo,
  });

  // Use demo data if in demo mode, otherwise use fetched data
  const groupMembers = useMemo(() => {
    return demoProfiles.isDemo 
      ? demoProfiles.data?.map(profile => ({
          id: profile.user_id,
          email: profile.email,
          name: `${profile.first_name} ${profile.last_name}`.trim() || profile.email
        })) || []
      : fetchedGroupMembers || [];
  }, [demoProfiles.isDemo, demoProfiles.data, fetchedGroupMembers]);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || "",
        status: task.status,
        priority: task.priority || "Medium",
        category: task.category || "",
        primary_owner_id: task.primary_owner_id || "",
        secondary_owner_id: task.secondary_owner_id || "",
        completed_at: task.completed_at || "",
        completed_by_user_id: task.completed_by_user_id || "",
        completed_by_email: task.completed_by_email || "",
      });
      setDueDate(task.due_date ? new Date(task.due_date) : undefined);
      setCompletedAt(task.completed_at ? new Date(task.completed_at) : undefined);
    } else {
      setFormData({
        title: "",
        description: "",
        status: "Open",
        priority: "Medium",
        category: "",
        primary_owner_id: "",
        secondary_owner_id: "",
        completed_at: "",
        completed_by_user_id: "",
        completed_by_email: "",
      });
      setDueDate(undefined);
      setCompletedAt(undefined);
      setRelatedContacts([]);
    }
  }, [task?.id, task?.title, task?.description, task?.status, task?.priority, task?.category, task?.primary_owner_id, task?.secondary_owner_id, task?.due_date, task?.completed_at, task?.completed_by_user_id, task?.completed_by_email]);

  // Separate effect for linked contacts to avoid infinite loop
  useEffect(() => {
    if (task && linkedContactsData?.length) {
      setRelatedContacts(linkedContactsData.map((contact: any) => contact.id));
    } else if (!task) {
      setRelatedContacts([]);
    }
  }, [task?.id, linkedContactsData?.length]);

  // Handle status change to auto-fill completion fields
  const handleStatusChange = (newStatus: "Open" | "InProgress" | "Completed") => {
    if (newStatus === "Completed" && currentUser) {
      const now = new Date();
      setFormData(prev => ({
        ...prev,
        status: newStatus,
        completed_at: now.toISOString(),
        completed_by_user_id: currentUser.id,
        completed_by_email: currentUser.email || "",
      }));
      setCompletedAt(now);
    } else {
      setFormData(prev => ({
        ...prev,
        status: newStatus,
        completed_at: "",
        completed_by_user_id: "",
        completed_by_email: "",
      }));
      setCompletedAt(undefined);
    }
  };

  const createTask = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      console.log('Creating task with data:', data);
      console.log('Group ID:', groupId);
      console.log('User ID:', user.id);

      const { data: newTask, error } = await supabase
        .from("tasks")
        .insert({
          ...data,
          group_id: groupId,
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Task creation error:', error);
        throw error;
      }
      return newTask;
    },
    onSuccess: async (newTask) => {
      console.log('Task created successfully:', newTask.id);
      
      // Link contacts if any
      if (relatedContacts.length > 0) {
        await persistContactLinks("tasks", newTask.id, relatedContacts, []);
      }

      // Trigger reindex
      try {
        await triggerReindex('tasks', newTask.id);
      } catch (error) {
        console.warn('Failed to trigger reindex:', error);
      }

      // Send notifications for new task
      try {
        console.log('Sending notification for new task:', { taskId: newTask.id, groupId });
        
        // Get current session for authentication
        const { data: { session } } = await supabase.auth.getSession();
        
        const notifyResponse = await supabase.functions.invoke("notify", {
          body: {
            type: "immediate",
            entity: "tasks",
            group_id: groupId,
            item_id: newTask.id,
            baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
          },
          headers: session?.access_token ? {
            'Authorization': `Bearer ${session.access_token}`
          } : {},
        });
        console.log('Notification response:', notifyResponse);
        
        if (notifyResponse.error) {
          console.error('Notification failed:', notifyResponse.error);
        } else {
          console.log('Notification sent successfully:', notifyResponse.data);
        }
      } catch (notifyError) {
        console.error('Failed to send task notification:', notifyError);
        // Continue silently - don't block user experience
      }

      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
    },
    onSuccess: async () => {
      // Update contact links if task exists
      if (task) {
        const existingContactIds = linkedContactsData.map((contact: any) => contact.id);
        await persistContactLinks("tasks", task.id, relatedContacts, existingContactIds);

        // Trigger reindex
        try {
          await triggerReindex('tasks', task.id);
        } catch (error) {
          console.warn('Failed to trigger reindex:', error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (blockOperation()) return;

    const submitData = {
      ...formData,
      due_date: dueDate ? dueDate.toISOString().split("T")[0] : null,
      primary_owner_id: formData.primary_owner_id && formData.primary_owner_id.trim() !== '' ? formData.primary_owner_id : null,
      secondary_owner_id: formData.secondary_owner_id && formData.secondary_owner_id.trim() !== '' ? formData.secondary_owner_id : null,
      completed_by_user_id: formData.completed_by_user_id && formData.completed_by_user_id.trim() !== '' ? formData.completed_by_user_id : null,
      completed_at: completedAt ? completedAt.toISOString() : null,
    };

    if (task) {
      updateTask.mutate(submitData);
    } else {
      createTask.mutate(submitData);
    }
  };

  const categories = ["Medical", "Personal", "Financial", "Legal", "Other"];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Create Task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Status & Priority */}
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

          {/* Category & Due Date */}
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
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Assignees */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primary_owner">Primary Owner</Label>
              <Select
                value={formData.primary_owner_id}
                onValueChange={(value) => setFormData({ ...formData, primary_owner_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select primary owner" />
                </SelectTrigger>
                <SelectContent>
                  {groupMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="secondary_owner">Secondary Owner</Label>
              <Select
                value={formData.secondary_owner_id}
                onValueChange={(value) => setFormData({ ...formData, secondary_owner_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select secondary owner" />
                </SelectTrigger>
                <SelectContent>
                  {groupMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Completion fields - only show if status is Completed */}
          {formData.status === "Completed" && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium">Completion Details</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Completed At</Label>
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
                        {completedAt ? format(completedAt, "PPP p") : <span>Pick date & time</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={completedAt}
                        onSelect={(date) => {
                          if (date) {
                            const now = new Date();
                            date.setHours(now.getHours());
                            date.setMinutes(now.getMinutes());
                            setCompletedAt(date);
                            setFormData(prev => ({
                              ...prev,
                              completed_at: date.toISOString()
                            }));
                          }
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="completed_by_email">Completed By</Label>
                  <Input
                    id="completed_by_email"
                    value={formData.completed_by_email}
                    onChange={(e) => setFormData({ ...formData, completed_by_email: e.target.value })}
                    placeholder="Email of person who completed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Related Contacts */}
          <div>
            <Label>Related Contacts</Label>
            <ContactMultiSelect
              value={relatedContacts}
              onChange={setRelatedContacts}
              entityType="tasks"
              placeholder="Select related contacts..."
            />
          </div>

          {/* Related Documents & Activities */}
          {task && (
            <div>
              <Label>Related Items</Label>
              <AssociationManager
                entityId={task.id}
                entityType="task"
                groupId={groupId}
                onNavigate={(type, id) => {
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
                }}
              />
            </div>
          )}

          {/* Make Recurring - only show for existing tasks */}
          {task && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Recurrence</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRecurrenceModal(true)}
                >
                  {recurrenceRule ? "Edit Recurrence" : "Make Recurring"}
                </Button>
              </div>
              {recurrenceRule && (
                <div className="text-sm text-muted-foreground">
                  This task is recurring ({recurrenceRule.pattern_type})
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between gap-2 pt-4">
            <div>
              {task && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRecurrenceModal(true)}
                >
                  {recurrenceRule ? "Edit Recurrence" : "Make Recurring"}
                </Button>
              )}
            </div>
            <div className="flex gap-2 justify-between">
              {/* Delete button on the left if editing existing task */}
              {task && (
                <RowDelete
                  id={task.id}
                  type="task"
                  label="task"
                  variant="button"
                  onDone={() => {
                    onClose();
                    // Refresh the task queries
                    queryClient.invalidateQueries({ queryKey: ["tasks"] });
                  }}
                />
              )}
              
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTask.isPending || updateTask.isPending || blockOperation()}
                  className={blockOperation() ? "opacity-50 cursor-not-allowed" : ""}
                >
                  {createTask.isPending || updateTask.isPending 
                    ? "Saving..." 
                    : task ? "Save Changes" : "Create Task"}
                </Button>
              </div>
            </div>
          </div>
        </form>

        {/* Recurrence Modal */}
        {task && (
          <RecurrenceModal
            taskId={task.id}
            groupId={groupId}
            isOpen={showRecurrenceModal}
            onClose={() => setShowRecurrenceModal(false)}
            existingRule={recurrenceRule}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}