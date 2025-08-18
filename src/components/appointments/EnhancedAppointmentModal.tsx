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
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AssociationManager } from "@/components/shared/AssociationManager";
import { useDemoOperations } from "@/hooks/useDemoOperations";

interface Appointment {
  id: string;
  description?: string;
  date_time: string;
  duration_minutes?: number;
  location?: string;
  category?: string;
  outcome_notes?: string;
}

interface EnhancedAppointmentModalProps {
  appointment: Appointment | null;
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

export function EnhancedAppointmentModal({ 
  appointment, 
  isOpen, 
  onClose, 
  groupId 
}: EnhancedAppointmentModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    location: "",
    category: "",
    duration_minutes: 60,
    outcome_notes: "",
  });
  const [dateTime, setDateTime] = useState<Date>(new Date());
  const [timeValue, setTimeValue] = useState("09:00");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { blockOperation } = useDemoOperations();

  useEffect(() => {
    if (appointment) {
      const appointmentDate = new Date(appointment.date_time);
      setFormData({
        description: appointment.description || "",
        location: appointment.location || "",
        category: appointment.category || "",
        duration_minutes: appointment.duration_minutes || 60,
        outcome_notes: appointment.outcome_notes || "",
      });
      setDateTime(appointmentDate);
      setTimeValue(format(appointmentDate, "HH:mm"));
    } else {
      setFormData({
        description: "",
        location: "",
        category: "",
        duration_minutes: 60,
        outcome_notes: "",
      });
      setDateTime(new Date());
      setTimeValue("09:00");
    }
  }, [appointment]);

  const createAppointment = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: newAppointment, error } = await supabase
        .from("appointments")
        .insert({
          ...data,
          group_id: groupId,
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return newAppointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({
        title: "Appointment created",
        description: "Appointment has been created successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create appointment.",
        variant: "destructive",
      });
    },
  });

  const updateAppointment = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("appointments")
        .update(data)
        .eq("id", appointment!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({
        title: "Appointment updated",
        description: "Appointment has been updated successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update appointment.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (blockOperation()) return;

    // Combine date and time
    const [hours, minutes] = timeValue.split(':');
    const appointmentDateTime = new Date(dateTime);
    appointmentDateTime.setHours(parseInt(hours), parseInt(minutes));

    const submitData = {
      ...formData,
      date_time: appointmentDateTime.toISOString(),
    };

    if (appointment) {
      updateAppointment.mutate(submitData);
    } else {
      createAppointment.mutate(submitData);
    }
  };

  const handleNavigate = (type: string, id: string) => {
    // Navigate to the related item
    const baseUrl = `/app/${groupId}`;
    let url = '';
    
    switch (type) {
      case 'contact':
        url = `${baseUrl}/contacts`;
        break;
      case 'task':
        url = `${baseUrl}/tasks`;
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

  const categories = ["Medical", "Social", "Legal", "Financial", "Other"];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{appointment ? "Edit Appointment" : "Create Appointment"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Appointment Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Appointment Details</h3>
              
              <div>
                <Label htmlFor="description">Description *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateTime && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTime ? format(dateTime, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateTime}
                        onSelect={(date) => date && setDateTime(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="time">Time *</Label>
                  <Input
                    id="time"
                    type="time"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="15"
                    step="15"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      duration_minutes: parseInt(e.target.value) || 60 
                    })}
                  />
                </div>

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
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            {/* Outcome Notes */}
            <div>
              <Label htmlFor="outcome_notes">Outcome Notes</Label>
              <Textarea
                id="outcome_notes"
                value={formData.outcome_notes}
                onChange={(e) => setFormData({ ...formData, outcome_notes: e.target.value })}
                rows={4}
                placeholder="Add notes about the appointment outcome..."
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={createAppointment.isPending || updateAppointment.isPending}>
                {appointment ? "Update" : "Create"} Appointment
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>

          {/* Associations Panel */}
          {appointment && (
            <div className="space-y-4">
              <AssociationManager
                entityId={appointment.id}
                entityType="appointment"
                groupId={groupId}
                onNavigate={handleNavigate}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}