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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface RecurrenceRule {
  id?: string;
  pattern_type: string;
  interval_value: number;
  weekly_days?: number[];
  monthly_day_of_month?: number;
  monthly_nth_weekday?: number;
  monthly_weekday?: number;
  yearly_month?: number;
  yearly_day?: number;
  end_type: string;
  end_after_occurrences?: number;
  end_until_date?: string;
  [key: string]: any; // Allow additional fields from database
}

interface RecurrenceModalProps {
  taskId: string;
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
  existingRule?: RecurrenceRule | null;
}

const WEEKDAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const ORDINALS = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: 5, label: "5th" },
];

export function RecurrenceModal({ taskId, groupId, isOpen, onClose, existingRule }: RecurrenceModalProps) {
  const [formData, setFormData] = useState<RecurrenceRule>({
    pattern_type: "daily",
    interval_value: 1,
    end_type: "never",
  });
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (existingRule) {
      setFormData(existingRule);
      if (existingRule.end_until_date) {
        setEndDate(new Date(existingRule.end_until_date));
      }
    } else {
      setFormData({
        pattern_type: "daily",
        interval_value: 1,
        end_type: "never",
      });
      setEndDate(undefined);
    }
  }, [existingRule, isOpen]);

  const saveRecurrenceRule = useMutation({
    mutationFn: async (data: RecurrenceRule) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const submitData = {
        task_id: taskId,
        group_id: groupId,
        created_by_user_id: user.id,
        ...data,
        end_until_date: endDate ? endDate.toISOString().split("T")[0] : null,
      };

      if (existingRule?.id) {
        const { error } = await supabase
          .from("task_recurrence_rules")
          .update(submitData)
          .eq("id", existingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("task_recurrence_rules")
          .insert(submitData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-recurrence", taskId] });
      toast({
        title: "Recurrence saved",
        description: "Task recurrence has been configured successfully.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save recurrence rule.",
        variant: "destructive",
      });
    },
  });

  const deleteRecurrenceRule = useMutation({
    mutationFn: async () => {
      if (!existingRule?.id) return;
      
      const { error } = await supabase
        .from("task_recurrence_rules")
        .delete()
        .eq("id", existingRule.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-recurrence", taskId] });
      toast({
        title: "Recurrence removed",
        description: "Task recurrence has been removed.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove recurrence rule.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveRecurrenceRule.mutate(formData);
  };

  const handleWeeklyDayToggle = (day: number, checked: boolean) => {
    const currentDays = formData.weekly_days || [];
    const newDays = checked 
      ? [...currentDays, day].sort()
      : currentDays.filter(d => d !== day);
    
    setFormData({ ...formData, weekly_days: newDays });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {existingRule ? "Edit Recurrence" : "Make Task Recurring"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pattern Type */}
          <div>
            <Label>Recurrence Pattern</Label>
            <Select
              value={formData.pattern_type}
              onValueChange={(value: any) => setFormData({ 
                ...formData, 
                pattern_type: value,
                // Reset pattern-specific fields
                weekly_days: undefined,
                monthly_day_of_month: undefined,
                monthly_nth_weekday: undefined,
                monthly_weekday: undefined,
                yearly_month: undefined,
                yearly_day: undefined,
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Interval */}
          <div>
            <Label>Every</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                value={formData.interval_value}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  interval_value: parseInt(e.target.value) || 1 
                })}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                {formData.pattern_type === "daily" && "day(s)"}
                {formData.pattern_type === "weekly" && "week(s)"}
                {formData.pattern_type === "monthly" && "month(s)"}
                {formData.pattern_type === "yearly" && "year(s)"}
              </span>
            </div>
          </div>

          {/* Weekly Pattern */}
          {formData.pattern_type === "weekly" && (
            <div>
              <Label>On these days</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {WEEKDAYS.map((day) => (
                  <div key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day.value}`}
                      checked={formData.weekly_days?.includes(day.value) || false}
                      onCheckedChange={(checked) => 
                        handleWeeklyDayToggle(day.value, checked as boolean)
                      }
                    />
                    <Label htmlFor={`day-${day.value}`} className="text-sm">
                      {day.short}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Pattern */}
          {formData.pattern_type === "monthly" && (
            <div className="space-y-4">
              <Label>Monthly Pattern</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="monthly-day"
                    checked={!!formData.monthly_day_of_month}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({
                          ...formData,
                          monthly_day_of_month: 1,
                          monthly_nth_weekday: undefined,
                          monthly_weekday: undefined,
                        });
                      } else {
                        setFormData({
                          ...formData,
                          monthly_day_of_month: undefined,
                        });
                      }
                    }}
                  />
                  <Label htmlFor="monthly-day">On day</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.monthly_day_of_month || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      monthly_day_of_month: parseInt(e.target.value) || undefined,
                    })}
                    disabled={!formData.monthly_day_of_month}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">of the month</span>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="monthly-weekday"
                    checked={!!formData.monthly_nth_weekday}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({
                          ...formData,
                          monthly_day_of_month: undefined,
                          monthly_nth_weekday: 1,
                          monthly_weekday: 1,
                        });
                      } else {
                        setFormData({
                          ...formData,
                          monthly_nth_weekday: undefined,
                          monthly_weekday: undefined,
                        });
                      }
                    }}
                  />
                  <Label htmlFor="monthly-weekday">On the</Label>
                  <Select
                    value={formData.monthly_nth_weekday?.toString() || ""}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      monthly_nth_weekday: parseInt(value),
                    })}
                    disabled={!formData.monthly_nth_weekday}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDINALS.map((ord) => (
                        <SelectItem key={ord.value} value={ord.value.toString()}>
                          {ord.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={formData.monthly_weekday?.toString() || ""}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      monthly_weekday: parseInt(value),
                    })}
                    disabled={!formData.monthly_nth_weekday}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Yearly Pattern */}
          {formData.pattern_type === "yearly" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Month</Label>
                <Select
                  value={formData.yearly_month?.toString() || ""}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    yearly_month: parseInt(value),
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, index) => (
                      <SelectItem key={index} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Day</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.yearly_day || ""}
                  onChange={(e) => setFormData({
                    ...formData,
                    yearly_day: parseInt(e.target.value) || undefined,
                  })}
                />
              </div>
            </div>
          )}

          {/* End Conditions */}
          <div className="space-y-4">
            <Label>End Condition</Label>
            <Select
              value={formData.end_type}
              onValueChange={(value: any) => setFormData({
                ...formData,
                end_type: value,
                end_after_occurrences: undefined,
                end_until_date: undefined,
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="after_occurrences">After N occurrences</SelectItem>
                <SelectItem value="until_date">Until date</SelectItem>
              </SelectContent>
            </Select>

            {formData.end_type === "after_occurrences" && (
              <div className="flex items-center gap-2">
                <Label>After</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.end_after_occurrences || ""}
                  onChange={(e) => setFormData({
                    ...formData,
                    end_after_occurrences: parseInt(e.target.value) || undefined,
                  })}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">occurrences</span>
              </div>
            )}

            {formData.end_type === "until_date" && (
              <div>
                <Label>Until</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-2",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <div>
              {existingRule && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => deleteRecurrenceRule.mutate()}
                  disabled={deleteRecurrenceRule.isPending}
                >
                  {deleteRecurrenceRule.isPending ? "Removing..." : "Remove Recurrence"}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveRecurrenceRule.isPending}>
                {saveRecurrenceRule.isPending ? "Saving..." : "Save Recurrence"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}