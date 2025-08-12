import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import ContactMultiSelect from "@/components/contacts/ContactMultiSelect";
import { TaskAppointmentDocumentLinker } from "@/components/documents/TaskAppointmentDocumentLinker";
import { useLinkedContacts } from "@/hooks/useLinkedContacts";
import { useContactLinkOperations } from "@/hooks/useContactLinkOperations";
import { triggerReindex } from "@/utils/reindex";

interface Appointment {
  id: string;
  date_time: string;
  location?: string;
  category?: string;
  description?: string;
  attending_user_id?: string;
  reminder_days_before?: number;
  outcome_notes?: string;
  group_id: string;
  created_by_user_id?: string;
  created_by_email?: string;
}

interface AppointmentModalProps {
  appointment: Appointment | null;
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

export const AppointmentModal = ({ appointment, isOpen, onClose, groupId }: AppointmentModalProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    date_time: "",
    location: "",
    category: "",
    description: "",
    attending_user_id: "",
    reminder_days_before: 1,
    outcome_notes: "",
  });

  const [relatedContacts, setRelatedContacts] = useState<string[]>([]);
  
  // Get linked contacts if editing existing appointment
  const { data: linkedContactsData = [] } = useLinkedContacts("appointment", appointment?.id || "");
  const { persistContactLinks } = useContactLinkOperations();

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch group members for attendee selection
  const { data: groupMembers } = useQuery({
    queryKey: ["groupMembers", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_group_members")
        .select("user_id")
        .eq("group_id", groupId);

      if (error) throw error;
      
      if (!data || data.length === 0) return [];
      
      const userIds = data.map(m => m.user_id).filter(Boolean);
      
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);
        
      if (profileError) throw profileError;
      
      return profiles?.map(profile => ({
        id: profile.user_id,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 
              profile.email || 
              profile.user_id,
        email: profile.email
      })) || [];
    },
    enabled: !!groupId,
  });

  useEffect(() => {
    if (appointment) {
      setFormData({
        date_time: appointment.date_time ? format(parseISO(appointment.date_time), "yyyy-MM-dd'T'HH:mm") : "",
        location: appointment.location || "",
        category: appointment.category || "",
        description: appointment.description || "",
        attending_user_id: appointment.attending_user_id || "",
        reminder_days_before: appointment.reminder_days_before || 1,
        outcome_notes: appointment.outcome_notes || "",
      });
      
      // Set linked contacts
      if (linkedContactsData) {
        setRelatedContacts(linkedContactsData.map((contact: any) => contact.id));
      }
    } else {
      setFormData({
        date_time: "",
        location: "",
        category: "",
        description: "",
        attending_user_id: "",
        reminder_days_before: 1,
        outcome_notes: "",
      });
      setRelatedContacts([]);
    }
  }, [appointment, linkedContactsData]);

  const createAppointment = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await supabase
        .from("appointments")
        .insert({
          ...data,
          group_id: groupId,
          created_by_user_id: currentUser?.id,
          created_by_email: currentUser?.email,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: async (newAppointment) => {
      // Link contacts if any
      if (relatedContacts.length > 0) {
        await persistContactLinks("appointments", newAppointment.id, relatedContacts, []);
      }

      // Trigger reindex
      try {
        await triggerReindex('appointments', newAppointment.id);
      } catch (error) {
        console.warn('Failed to trigger reindex:', error);
      }

      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      toast({ title: "Success", description: "Appointment created successfully." });
      
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateAppointment = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await supabase
        .from("appointments")
        .update(data)
        .eq("id", appointment!.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: async () => {
      // Update contact links if appointment exists
      if (appointment) {
        const existingContactIds = linkedContactsData.map((contact: any) => contact.id);
        await persistContactLinks("appointments", appointment.id, relatedContacts, existingContactIds);

        // Trigger reindex
        try {
          await triggerReindex('appointments', appointment.id);
        } catch (error) {
          console.warn('Failed to trigger reindex:', error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      toast({ title: "Success", description: "Appointment updated successfully." });
      
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      reminder_days_before: formData.reminder_days_before || null,
      attending_user_id: formData.attending_user_id || null,
    };

    if (appointment) {
      updateAppointment.mutate(submitData);
    } else {
      createAppointment.mutate(submitData);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {appointment ? "Edit Appointment" : "New Appointment"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date_time">Date & Time *</Label>
              <Input
                id="date_time"
                type="datetime-local"
                value={formData.date_time}
                onChange={(e) => setFormData({ ...formData, date_time: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Dr. Smith's Office"
              />
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
                  <SelectItem value="Medical">Medical</SelectItem>
                  <SelectItem value="dental">Dental</SelectItem>
                  <SelectItem value="therapy">Therapy</SelectItem>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                  <SelectItem value="Financial/Legal">Financial/Legal</SelectItem>
                  <SelectItem value="Personal/Social">Personal/Social</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="attending_user_id">Attending User</Label>
              <Select 
                value={formData.attending_user_id} 
                onValueChange={(value) => setFormData({ ...formData, attending_user_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select attendee" />
                </SelectTrigger>
                <SelectContent>
                  {groupMembers?.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Appointment details..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="reminder_days_before">Reminder (days before)</Label>
            <Select 
              value={formData.reminder_days_before.toString()} 
              onValueChange={(value) => setFormData({ ...formData, reminder_days_before: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">1 week</SelectItem>
                <SelectItem value="14">2 weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="outcome_notes">Outcome Notes</Label>
            <Textarea
              id="outcome_notes"
              value={formData.outcome_notes}
              onChange={(e) => setFormData({ ...formData, outcome_notes: e.target.value })}
              placeholder="Notes about the appointment outcome..."
              rows={3}
            />
          </div>

          {/* Related Contacts */}
          <div>
            <Label>Related Contacts</Label>
            <ContactMultiSelect
              selectedContactIds={relatedContacts}
              onSelectionChange={setRelatedContacts}
              entityType="appointments"
            />
          </div>

          {/* Related Documents */}
          <div>
            <Label>Documents</Label>
            <TaskAppointmentDocumentLinker
              itemId={appointment?.id || null}
              itemType="appointment"
              itemTitle={formData.description || "New Appointment"}
              isCreationMode={!appointment}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createAppointment.isPending || updateAppointment.isPending}
            >
              {appointment ? "Save Changes" : "Create Appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};