import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AssociationManager } from "@/components/shared/AssociationManager";
import { useDemoOperations } from "@/hooks/useDemoOperations";
import { softDeleteEntity } from "@/lib/delete/rpc";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

interface Appointment {
  id: string;
  description?: string;
  date_time: string;
  duration_minutes?: number;
  street_address?: string;
  street_address_2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  transportation_information?: string;
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
    street_address: "",
    street_address_2: "",
    city: "",
    state: "",
    zip_code: "",
    transportation_information: "",
    category: "",
    duration_minutes: 60,
    outcome_notes: "",
  });
  const [dateTime, setDateTime] = useState<Date>(new Date());
  const [timeValue, setTimeValue] = useState("09:00");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { blockOperation } = useDemoOperations();

  useEffect(() => {
    if (appointment) {
      const appointmentDate = new Date(appointment.date_time);
      setFormData({
        description: appointment.description || "",
        street_address: appointment.street_address || "",
        street_address_2: appointment.street_address_2 || "",
        city: appointment.city || "",
        state: appointment.state || "",
        zip_code: appointment.zip_code || "",
        transportation_information: appointment.transportation_information || "",
        category: appointment.category || "",
        duration_minutes: appointment.duration_minutes || 60,
        outcome_notes: appointment.outcome_notes || "",
      });
      setDateTime(appointmentDate);
      setTimeValue(format(appointmentDate, "HH:mm"));
    } else {
      setFormData({
        description: "",
        street_address: "",
        street_address_2: "",
        city: "",
        state: "",
        zip_code: "",
        transportation_information: "",
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
      queryClient.invalidateQueries({ queryKey: ["appointments-list"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
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
      queryClient.invalidateQueries({ queryKey: ["appointments-list"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
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

  const deleteAppointment = useMutation({
    mutationFn: async () => {
      if (!appointment) throw new Error("No appointment to delete");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const result = await softDeleteEntity('appointment', appointment.id, user.id, user.email!);
      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-list"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      toast({
        title: "Appointment deleted",
        description: "The appointment has been deleted and can be restored from group settings within 30 days.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete appointment.",
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

  const handleDelete = () => {
    if (blockOperation()) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    deleteAppointment.mutate();
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

              {/* Address */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Address</h4>
                <div>
                  <Label htmlFor="street_address">Street Address</Label>
                  <Input
                    id="street_address"
                    placeholder="Street address"
                    value={formData.street_address}
                    onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="street_address_2">Street Address 2</Label>
                  <Input
                    id="street_address_2"
                    placeholder="Apartment, suite, etc."
                    value={formData.street_address_2}
                    onChange={(e) => setFormData({ ...formData, street_address_2: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="City"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) => setFormData({ ...formData, state: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="zip_code">ZIP Code</Label>
                    <Input
                      id="zip_code"
                      placeholder="12345"
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="transportation_information">Transportation Information</Label>
                  <Input
                    id="transportation_information"
                    placeholder="Transportation details..."
                    value={formData.transportation_information}
                    onChange={(e) => setFormData({ ...formData, transportation_information: e.target.value })}
                  />
                </div>
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
              {appointment && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={deleteAppointment.isPending}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this appointment? This action will soft delete the item and it can be restored from group settings within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}