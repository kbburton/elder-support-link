import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskAppointmentDocumentLinker } from "@/components/documents/TaskAppointmentDocumentLinker";
import ContactMultiSelect from "@/components/contacts/ContactMultiSelect";

interface ActivityLogFormProps {
  editingEntry?: any | null;
  onSave: () => void;
  onCancel: () => void;
}

const ActivityLogForm = ({ editingEntry, onSave, onCancel }: ActivityLogFormProps) => {
  const { groupId } = useParams();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    date_time: "",
    type: "",
    title: "",
    notes: "",
    attachment_url: "",
    linked_task_id: "",
    linked_appointment_id: "",
  });
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [documentLinks, setDocumentLinks] = useState<string[]>([]);
  const [relatedContacts, setRelatedContacts] = useState<string[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [saveAction, setSaveAction] = useState<"save" | "save_task" | "save_appointment">("save");

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email || "");
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    if (editingEntry) {
      setFormData({
        date_time: editingEntry.date_time ? format(new Date(editingEntry.date_time), "yyyy-MM-dd'T'HH:mm") : "",
        type: editingEntry.type || "",
        title: editingEntry.title || "",
        notes: editingEntry.notes || "",
        attachment_url: editingEntry.attachment_url || "",
        linked_task_id: editingEntry.linked_task_id || "",
        linked_appointment_id: editingEntry.linked_appointment_id || "",
      });
    } else {
      // Default to current time for new entries
      const now = new Date();
      setFormData({
        date_time: format(now, "yyyy-MM-dd'T'HH:mm"),
        type: "",
        title: "",
        notes: "",
        attachment_url: "",
        linked_task_id: "",
        linked_appointment_id: "",
      });
      setDocumentLinks([]);
      setRelatedContacts([]);
    }
  }, [editingEntry]);

  const { data: tasks } = useQuery({
    queryKey: ["tasks", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  const { data: appointments } = useQuery({
    queryKey: ["appointments", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, category, description, date_time")
        .eq("group_id", groupId)
        .order("date_time", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        date_time: formData.date_time ? new Date(formData.date_time).toISOString() : new Date().toISOString(),
        group_id: groupId,
        created_by_user_id: currentUserId,
        created_by_email: currentUserEmail,
      };

      // Clean up empty fields and handle special "none" values
      Object.keys(payload).forEach(key => {
        if (payload[key as keyof typeof payload] === "" || 
            payload[key as keyof typeof payload] === "no_task" ||
            payload[key as keyof typeof payload] === "no_appointment") {
          payload[key as keyof typeof payload] = null;
        }
      });

      if (editingEntry?.id) {
        const { data, error } = await supabase
          .from("activity_logs")
          .update(payload)
          .eq("id", editingEntry.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("activity_logs")
          .insert(payload)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: async (data) => {
      // Handle document linking for new entries
      if (!editingEntry && documentLinks.length > 0) {
        try {
          const linkPromises = documentLinks.map((docId) =>
            supabase.from("document_links").insert({
              document_id: docId,
              linked_item_id: data.id,
              linked_item_type: "activity_log",
            })
          );
          await Promise.all(linkPromises);
        } catch (error) {
          console.warn("Document linking failed:", error);
        }
      }

      // Handle contact linking
      if (relatedContacts.length > 0) {
        try {
          const contactLinkPromises = relatedContacts.map((contactId) =>
            supabase.from("contact_activities").insert({
              contact_id: contactId,
              activity_log_id: data.id,
            })
          );
          await Promise.all(contactLinkPromises);
        } catch (error) {
          console.warn("Contact linking failed:", error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      
      const actionText = editingEntry ? "updated" : "created";
      toast({ 
        title: `Activity log ${actionText}`, 
        description: `Activity log entry has been ${actionText} successfully.` 
      });

      // Send notifications for new entries
      if (!editingEntry && groupId) {
        try {
          await supabase.functions.invoke("notify", {
            body: {
              type: "immediate",
              entity: "activity_logs",
              group_id: groupId,
              item_id: data.id,
              baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
            },
          });
        } catch (error) {
          console.warn("Notification send failed:", error);
        }
      }

      // Handle save actions
      if (saveAction === "save_task") {
        setShowTaskModal(true);
      } else if (saveAction === "save_appointment") {
        setShowAppointmentModal(true);
      } else {
        onSave();
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleSave = (action: "save" | "save_task" | "save_appointment") => {
    setSaveAction(action);
    saveMutation.mutate();
  };

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: { title: string; description: string }) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: taskData.title,
          description: taskData.description,
          group_id: groupId,
          created_by_user_id: currentUserId,
          created_by_email: currentUserEmail,
          status: "open",
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Task created", description: "New task has been created successfully." });
      setShowTaskModal(false);
      onSave();
    },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: { category: string; description: string; date_time: string }) => {
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          category: appointmentData.category,
          description: appointmentData.description,
          date_time: new Date(appointmentData.date_time).toISOString(),
          group_id: groupId,
          created_by_user_id: currentUserId,
          created_by_email: currentUserEmail,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Appointment created", description: "New appointment has been created successfully." });
      setShowAppointmentModal(false);
      onSave();
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{editingEntry ? "Edit Activity Log Entry" : "New Activity Log Entry"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date_time">Date & Time</Label>
              <Input
                id="date_time"
                type="datetime-local"
                value={formData.date_time}
                onChange={(e) => setFormData({ ...formData, date_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type of Interaction</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select interaction type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inperson">In-Person Visit</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="video">Video Call</SelectItem>
                  <SelectItem value="email">Email/Message</SelectItem>
                  <SelectItem value="observation">Observation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title/Summary</Label>
            <Input
              id="title"
              placeholder="Brief title or summary"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Detailed Notes</Label>
            <Textarea
              id="notes"
              placeholder="Describe what happened or any important details..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="attachment_url">Attachment URL (optional)</Label>
            <Input
              id="attachment_url"
              placeholder="URL to photo or document"
              value={formData.attachment_url}
              onChange={(e) => setFormData({ ...formData, attachment_url: e.target.value })}
            />
          </div>

          {!editingEntry && (
            <div className="space-y-2">
              <Label>Documents (optional)</Label>
              <TaskAppointmentDocumentLinker
                itemId=""
                itemType="activity_log"
                itemTitle={formData.title || "New Activity Log"}
                onDocumentLinksChange={setDocumentLinks}
                isCreationMode={true}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Related Contacts (optional)</Label>
            <ContactMultiSelect
              selectedContactIds={relatedContacts}
              onSelectionChange={setRelatedContacts}
              placeholder="Select related contacts..."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="linked_task">Related Task (optional)</Label>
              <Select 
                value={formData.linked_task_id} 
                onValueChange={(value) => setFormData({ ...formData, linked_task_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select related task" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_task">No task selected</SelectItem>
                  {tasks?.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title} ({task.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="linked_appointment">Related Appointment (optional)</Label>
              <Select 
                value={formData.linked_appointment_id} 
                onValueChange={(value) => setFormData({ ...formData, linked_appointment_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select related appointment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_appointment">No appointment selected</SelectItem>
                  {appointments?.map((appointment) => (
                    <SelectItem key={appointment.id} value={appointment.id}>
                      {appointment.category} - {appointment.description} 
                      ({format(new Date(appointment.date_time), "MMM d, yyyy")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {currentUserEmail && (
            <div className="text-sm text-muted-foreground">
              Created by: {currentUserEmail}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleSave("save")}
              disabled={saveMutation.isPending}
            >
              {editingEntry ? "Update" : "Save"}
            </Button>
            {!editingEntry && (
              <>
                <Button 
                  variant="outline"
                  onClick={() => handleSave("save_task")}
                  disabled={saveMutation.isPending}
                >
                  Save + Create Task
                </Button>
                <Button 
                  variant="hero"
                  onClick={() => handleSave("save_appointment")}
                  disabled={saveMutation.isPending}
                >
                  Save + Create Appointment
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Task Creation Modal */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Create a new task related to this activity log entry.
            </DialogDescription>
          </DialogHeader>
          <QuickTaskForm
            onSubmit={(data) => createTaskMutation.mutate(data)}
            defaultDescription={formData.notes}
            defaultTitle={formData.title}
            onCancel={() => setShowTaskModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Appointment Creation Modal */}
      <Dialog open={showAppointmentModal} onOpenChange={setShowAppointmentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Appointment</DialogTitle>
            <DialogDescription>
              Create a new appointment related to this activity log entry.
            </DialogDescription>
          </DialogHeader>
          <QuickAppointmentForm
            onSubmit={(data) => createAppointmentMutation.mutate(data)}
            defaultDescription={formData.notes}
            onCancel={() => setShowAppointmentModal(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

// Quick Task Form Component
const QuickTaskForm = ({ onSubmit, defaultDescription, defaultTitle, onCancel }: {
  onSubmit: (data: { title: string; description: string }) => void;
  defaultDescription: string;
  defaultTitle: string;
  onCancel: () => void;
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="task-title">Task Title</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter task title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-description">Description</Label>
        <Textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter task description"
          rows={3}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onSubmit({ title, description })} disabled={!title.trim()}>
          Create Task
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

// Quick Appointment Form Component
const QuickAppointmentForm = ({ onSubmit, defaultDescription, onCancel }: {
  onSubmit: (data: { category: string; description: string; date_time: string }) => void;
  defaultDescription: string;
  onCancel: () => void;
}) => {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState(defaultDescription);
  const [dateTime, setDateTime] = useState("");

  useEffect(() => {
    // Default to next week
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setDateTime(format(nextWeek, "yyyy-MM-dd'T'HH:mm"));
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="appointment-category">Category</Label>
        <Input
          id="appointment-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g., Doctor Visit, Physical Therapy"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="appointment-description">Description</Label>
        <Textarea
          id="appointment-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter appointment description"
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="appointment-datetime">Date & Time</Label>
        <Input
          id="appointment-datetime"
          type="datetime-local"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button 
          onClick={() => onSubmit({ category, description, date_time: dateTime })} 
          disabled={!category.trim() || !dateTime}
        >
          Create Appointment
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ActivityLogForm;