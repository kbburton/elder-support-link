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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { UnifiedAssociationManager } from "@/components/shared/UnifiedAssociationManager";
import { ENTITY } from "@/constants/entities";
import { useDemoOperations } from "@/hooks/useDemoOperations";

interface Activity {
  id: string;
  title?: string;
  type?: string;
  date_time: string;
  notes?: string;
  attachment_url?: string;
}

interface ActivityModalProps {
  activity: Activity | null;
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

export function ActivityModal({ activity, isOpen, onClose, groupId }: ActivityModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    type: "visit",
    notes: "",
    attachment_url: "",
  });
  const [dateTime, setDateTime] = useState<Date>(new Date());
  const [timeValue, setTimeValue] = useState("09:00");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { blockOperation } = useDemoOperations();

  useEffect(() => {
    if (activity) {
      const activityDate = new Date(activity.date_time);
      setFormData({
        title: activity.title || "",
        type: activity.type || "visit",
        notes: activity.notes || "",
        attachment_url: activity.attachment_url || "",
      });
      setDateTime(activityDate);
      setTimeValue(format(activityDate, "HH:mm"));
    } else {
      setFormData({
        title: "",
        type: "visit",
        notes: "",
        attachment_url: "",
      });
      setDateTime(new Date());
      setTimeValue("09:00");
    }
  }, [activity]);

  const createActivity = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: newActivity, error } = await supabase
        .from("activity_logs")
        .insert({
          ...data,
          group_id: groupId,
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return newActivity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast({
        title: "Activity created",
        description: "Activity has been created successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create activity.",
        variant: "destructive",
      });
    },
  });

  const updateActivity = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("activity_logs")
        .update(data)
        .eq("id", activity!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast({
        title: "Activity updated",
        description: "Activity has been updated successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update activity.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (blockOperation()) return;

    // Combine date and time
    const [hours, minutes] = timeValue.split(':');
    const activityDateTime = new Date(dateTime);
    activityDateTime.setHours(parseInt(hours), parseInt(minutes));

    const submitData = {
      ...formData,
      date_time: activityDateTime.toISOString(),
    };

    if (activity) {
      updateActivity.mutate(submitData);
    } else {
      createActivity.mutate(submitData);
    }
  };

  const handleNavigate = (type: string, id: string) => {
    // Navigate to the related item
    const baseUrl = `/app/${groupId}`;
    let url = '';
    
    switch (type) {
      case ENTITY.contact:
        url = `${baseUrl}/contacts`;
        break;
      case ENTITY.appointment:
        url = `${baseUrl}/calendar`;
        break;
      case ENTITY.task:
        url = `${baseUrl}/tasks`;
        break;
      case ENTITY.document:
        url = `${baseUrl}/documents`;
        break;
      default:
        return;
    }
    
    window.open(url, '_blank');
  };

  const activityTypes = ["visit", "call", "email", "meeting", "note", "other"];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{activity ? "Edit Activity" : "Create Activity"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="form" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="associations" disabled={!activity}>Associations</TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="space-y-6 mt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Activity Details</h3>
                
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Activity title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activityTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Date & Time *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !dateTime && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateTime ? format(dateTime, "MMM dd") : <span>Date</span>}
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

                      <Input
                        type="time"
                        value={timeValue}
                        onChange={(e) => setTimeValue(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="Add notes about this activity..."
                />
              </div>

              {/* Attachment URL */}
              <div>
                <Label htmlFor="attachment_url">Attachment URL</Label>
                <Input
                  id="attachment_url"
                  type="url"
                  value={formData.attachment_url}
                  onChange={(e) => setFormData({ ...formData, attachment_url: e.target.value })}
                  placeholder="https://example.com/document.pdf"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createActivity.isPending || updateActivity.isPending}>
                  {activity ? "Update Activity" : "Create Activity"}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="associations" className="space-y-4 mt-6">
            {activity && (
              <UnifiedAssociationManager
                entityId={activity.id}
                entityType={ENTITY.activity_log}
                groupId={groupId}
                onNavigate={handleNavigate}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}