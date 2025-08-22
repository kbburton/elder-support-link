import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const FeedbackSchema = z.object({
  type: z.enum(["defect", "feature"]),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  steps_to_reproduce: z.string().optional(),
  expected_result: z.string().optional(),
  actual_result: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  care_group_id: z.string().nullable(),
});

type FeedbackFormValues = z.infer<typeof FeedbackSchema>;

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId?: string;
}

export function FeedbackModal({ isOpen, onClose, groupId }: FeedbackModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [useNoGroup, setUseNoGroup] = useState(false);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(FeedbackSchema),
    defaultValues: {
      type: "defect",
      title: "",
      description: "",
      steps_to_reproduce: "",
      expected_result: "",
      actual_result: "",
      severity: "medium",
      care_group_id: groupId || null,
    },
  });

  const createFeedbackMutation = useMutation({
    mutationFn: async (values: FeedbackFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", user.id)
        .single();

      const finalValues = {
        type: values.type,
        title: values.title,
        description: values.description,
        steps_to_reproduce: values.steps_to_reproduce || null,
        expected_result: values.expected_result || null,
        actual_result: values.actual_result || null,
        severity: values.severity,
        care_group_id: useNoGroup ? null : values.care_group_id,
        created_by_user_id: user.id,
        created_by_email: user.email || "",
      };

      const { data: insertedFeedback, error } = await supabase
        .from("feedback_items")
        .insert(finalValues)
        .select()
        .single();

      if (error) throw error;

      // Send notification email in background (don't block UX on failure)
      try {
        await supabase.functions.invoke('notify', {
          body: {
            type: 'feedback-new',
            feedback_id: insertedFeedback.id,
            baseUrl: window.location.origin,
          },
        });
      } catch (notifyError) {
        console.error('Failed to send feedback notification:', notifyError);
        // Continue silently - don't block user experience
      }
    },
    onSuccess: () => {
      toast({
        title: "Feedback submitted",
        description: "Your feedback has been submitted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["feedback-items"] });
      form.reset();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FeedbackFormValues) => {
    createFeedbackMutation.mutate(values);
  };

  const handleClose = () => {
    form.reset();
    setUseNoGroup(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Feedback</DialogTitle>
          <DialogDescription>
            Help us improve by reporting bugs or suggesting new features.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="defect">Bug Report</SelectItem>
                        <SelectItem value="feature">Feature Request</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description of the issue or feature" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detailed description of the issue or feature request" 
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("type") === "defect" && (
              <>
                <FormField
                  control={form.control}
                  name="steps_to_reproduce"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Steps to Reproduce</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
                          className="min-h-[80px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="expected_result"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Result</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="What should happen?"
                            className="min-h-[80px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="actual_result"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actual Result</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="What actually happens?"
                            className="min-h-[80px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="no-group"
                checked={useNoGroup}
                onCheckedChange={(checked) => setUseNoGroup(checked === true)}
              />
              <label
                htmlFor="no-group"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Submit as general feedback (not group-specific)
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createFeedbackMutation.isPending}
              >
                {createFeedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}