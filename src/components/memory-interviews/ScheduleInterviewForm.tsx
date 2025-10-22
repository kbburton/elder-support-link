import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar, Phone, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { normalizePhoneToE164 } from "@/utils/phone";
import { useStoryPrompts } from "@/hooks/useStoryPrompts";

const formSchema = z.object({
  scheduling_mode: z.enum(["schedule", "call_now"]),
  phone_number: z.string().min(10, "Phone number must be at least 10 digits"),
  scheduled_at: z.string().optional(),
  selected_question_id: z.string().optional(),
  custom_instructions: z.string().optional(),
  interview_type: z.enum(["one_time", "recurring"]),
  recurring_frequency: z.enum(["weekly", "biweekly", "monthly"]).optional(),
  recurring_total_count: z.coerce.number().min(1).optional(),
  is_test: z.boolean().default(false),
  prompt_id: z.string().optional(),
}).refine((data) => {
  // If scheduling mode is "schedule", require scheduled_at
  if (data.scheduling_mode === "schedule" && !data.scheduled_at) {
    return false;
  }
  return true;
}, {
  message: "Please select a date and time",
  path: ["scheduled_at"],
});

interface ScheduleInterviewFormProps {
  careGroupId: string;
}

export function ScheduleInterviewForm({ careGroupId }: ScheduleInterviewFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userTimezone, setUserTimezone] = useState<string>("");

  useEffect(() => {
    // Detect user's timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(timezone);
  }, []);

  const { data: questions } = useQuery({
    queryKey: ["interview-questions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interview_questions")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: prompts } = useStoryPrompts();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      scheduling_mode: "schedule",
      phone_number: "",
      scheduled_at: "",
      selected_question_id: undefined,
      custom_instructions: "",
      interview_type: "one_time",
      recurring_frequency: undefined,
      recurring_total_count: undefined,
      is_test: false,
      prompt_id: prompts?.find(p => p.is_default)?.id || undefined,
    },
  });

  const schedulingMode = form.watch("scheduling_mode");
  const interviewType = form.watch("interview_type");

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Normalize phone number
      const normalizedPhone = normalizePhoneToE164(values.phone_number);
      if (!normalizedPhone) {
        throw new Error("Invalid phone number. Please enter a valid number including area code.");
      }

      // Determine scheduled time based on mode
      let utcDateTime: string;
      if (values.scheduling_mode === "call_now") {
        // Set to current time for immediate call
        utcDateTime = new Date().toISOString();
        console.log('Call Now mode - scheduling for immediate call:', utcDateTime);
      } else {
        // Convert local datetime to UTC ISO string for database storage
        const localDateTime = new Date(values.scheduled_at!);
        utcDateTime = localDateTime.toISOString();
        console.log('Schedule mode:');
        console.log('  Local time input:', values.scheduled_at);
        console.log('  User timezone:', userTimezone);
        console.log('  Converted to UTC:', utcDateTime);
      }

      // Insert the interview record
      const { data: interview, error } = await supabase
        .from("memory_interviews")
        .insert({
          care_group_id: careGroupId,
          created_by_user_id: user.id,
          phone_number: normalizedPhone,
          recipient_phone: normalizedPhone,
          scheduled_at: utcDateTime,
          selected_question_id: values.selected_question_id || null,
          custom_instructions: values.custom_instructions || null,
          interview_type: values.interview_type,
          recurring_frequency: values.recurring_frequency || null,
          recurring_total_count: values.recurring_total_count || null,
          is_test: values.is_test,
          prompt_id: values.prompt_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // If "Call Now" mode, immediately trigger the edge function
      if (values.scheduling_mode === "call_now" && interview) {
        console.log('Triggering immediate call for interview:', interview.id);
        
        const { data: callResult, error: callError } = await supabase.functions.invoke(
          'initiate-scheduled-interviews',
          {
            body: { interview_id: interview.id }
          }
        );

        if (callError) {
          console.error('Failed to initiate call:', callError);
          throw new Error(`Call initiation failed: ${callError.message}`);
        }

        console.log('Call initiated:', callResult);
        
        toast({
          title: "Call Started!",
          description: "The phone call has been initiated. Check the Interviews tab to see the status.",
        });
      } else {
        toast({
          title: "Interview Scheduled",
          description: values.is_test 
            ? "Test interview scheduled successfully"
            : "Interview scheduled successfully. The recipient will receive a call at the scheduled time.",
        });
      }

      // Reset form to clear all fields including question and custom instructions
      form.reset({
        scheduling_mode: "schedule",
        phone_number: "",
        scheduled_at: "",
        selected_question_id: undefined,
        custom_instructions: "",
        interview_type: "one_time",
        recurring_frequency: undefined,
        recurring_total_count: undefined,
        is_test: false,
        prompt_id: prompts?.find(p => p.is_default)?.id || undefined,
      });
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const categoryLabels: Record<string, string> = {
    childhood_family: "Childhood & Family",
    life_milestones: "Life Milestones",
    relationships_love: "Relationships & Love",
    career_achievements: "Career & Achievements",
    challenges_resilience: "Challenges & Resilience",
    legacy_wisdom: "Legacy & Wisdom",
  };

  return (
    <Card className="p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="scheduling_mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>When should this interview happen?</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="schedule">Schedule for later</SelectItem>
                    <SelectItem value="call_now">Call now</SelectItem>
                  </SelectContent>
                </Select>
                {schedulingMode === "call_now" && (
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950 p-3 mt-2">
                    <p className="text-sm text-amber-900 dark:text-amber-100">
                      ⚡ The phone call will start immediately when you submit this form.
                    </p>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="+1 (555) 123-4567" 
                      className="pl-10"
                      {...field} 
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  The phone number where we'll call for the interview
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {schedulingMode === "schedule" && (
            <FormField
              control={form.control}
              name="scheduled_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schedule Date & Time</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="datetime-local" 
                        className="pl-10"
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormDescription className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>
                      Your timezone: {userTimezone || "Detecting..."}
                    </span>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="selected_question_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interview Question (Optional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a question or let AI choose" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-[300px]">
                    {questions?.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-xs text-muted-foreground">
                            {categoryLabels[q.category]}
                          </span>
                          <span>{q.question_text}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Leave blank for recurring interviews - AI will auto-select unused questions
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="custom_instructions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custom Instructions (Optional)</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Any specific topics or instructions for the AI interviewer..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Provide context or guidance for the AI during the interview
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="prompt_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Story Generation Prompt</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a prompt..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {prompts?.map((prompt) => (
                      <SelectItem key={prompt.id} value={prompt.id}>
                        {prompt.title}
                        {prompt.is_default && ' (Default)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose how the AI will generate stories from interview transcripts
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="interview_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interview Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="one_time">One-Time Interview</SelectItem>
                    <SelectItem value="recurring">Recurring Schedule</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {interviewType === "recurring" && (
            <>
              <FormField
                control={form.control}
                name="recurring_frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recurring_total_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Interviews</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        placeholder="e.g., 12"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      How many interviews should be scheduled?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <FormField
            control={form.control}
            name="is_test"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Test Mode</FormLabel>
                  <FormDescription>
                    Test interviews are saved separately and don't create stories
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting 
              ? (schedulingMode === "call_now" ? "Starting Call..." : "Scheduling...")
              : (schedulingMode === "call_now" ? "Start Call Now" : "Schedule Interview")
            }
          </Button>
        </form>
      </Form>
    </Card>
  );
}
