import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ThumbsUp, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { FeedbackComments } from "./FeedbackComments";

interface FeedbackDetailViewProps {
  feedbackId: string;
  onClose: () => void;
  isPlatformAdmin: boolean;
  isGroupAdmin: boolean;
}

export function FeedbackDetailView({ 
  feedbackId, 
  onClose, 
  isPlatformAdmin, 
  isGroupAdmin 
}: FeedbackDetailViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");

  const { data: feedback, isLoading } = useQuery({
    queryKey: ["feedback-item", feedbackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_items")
        .select(`
          *,
          care_group:care_group_id(name)
        `)
        .eq("id", feedbackId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", user.id)
        .single();

      const { error } = await supabase
        .from("feedback_comments")
        .insert({
          feedback_id: feedbackId,
          body,
          created_by_user_id: user.id,
          created_by_email: user.email || "",
        });

      if (error) throw error;

      // Send notification email in background (don't block UX on failure)
      try {
        await supabase.functions.invoke('notify', {
          body: {
            type: 'feedback-update',
            feedback_id: feedbackId,
            update_type: 'comment',
            baseUrl: window.location.origin,
          },
        });
      } catch (notifyError) {
        console.error('Failed to send feedback comment notification:', notifyError);
        // Continue silently - don't block user experience
      }
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["feedback-comments", feedbackId] });
      toast({
        title: "Comment added",
        description: "Your comment has been added successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: "open" | "in_progress" | "resolved" | "closed" | "duplicate" | "wontfix") => {
      const { error } = await supabase
        .from("feedback_items")
        .update({ status })
        .eq("id", feedbackId);
      if (error) throw error;

      // Send notification email in background (don't block UX on failure)
      try {
        await supabase.functions.invoke('notify', {
          body: {
            type: 'feedback-update',
            feedback_id: feedbackId,
            update_type: 'status',
            baseUrl: window.location.origin,
          },
        });
      } catch (notifyError) {
        console.error('Failed to send feedback status notification:', notifyError);
        // Continue silently - don't block user experience
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback-item", feedbackId] });
      toast({
        title: "Status updated",
        description: "Feedback status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateAssigneeMutation = useMutation({
    mutationFn: async (assigneeId: string | null) => {
      const { error } = await supabase
        .from("feedback_items")
        .update({ assigned_to_user_id: assigneeId })
        .eq("id", feedbackId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback-item", feedbackId] });
      toast({
        title: "Assignee updated",
        description: "Feedback assignee has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update assignee",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
    }
  };

  const canEditStatus = isPlatformAdmin || isGroupAdmin;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Feedback item not found</p>
        <Button onClick={onClose} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onClose} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to List
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{feedback.title}</h1>
          <p className="text-muted-foreground">
            Submitted by {feedback.created_by_email} on {format(new Date(feedback.created_at), "PPP")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Details</CardTitle>
                <div className="flex gap-2">
                  <Badge variant={feedback.type === "defect" ? "destructive" : "default"}>
                    {feedback.type === "defect" ? "Bug" : "Feature"}
                  </Badge>
                  <Badge variant="outline">{feedback.severity}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {feedback.description}
                </p>
              </div>

              {feedback.steps_to_reproduce && (
                <div>
                  <h4 className="font-medium mb-2">Steps to Reproduce</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {feedback.steps_to_reproduce}
                  </p>
                </div>
              )}

              {feedback.expected_result && (
                <div>
                  <h4 className="font-medium mb-2">Expected Result</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {feedback.expected_result}
                  </p>
                </div>
              )}

              {feedback.actual_result && (
                <div>
                  <h4 className="font-medium mb-2">Actual Result</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {feedback.actual_result}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4" />
                  <span className="text-sm">{feedback.votes} votes</span>
                </div>
                {feedback.care_group && (
                  <div className="text-sm text-muted-foreground">
                    Group: {feedback.care_group.name}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Status & Comments */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status & Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                {canEditStatus ? (
                  <Select 
                    value={feedback.status} 
                    onValueChange={(value) => updateStatusMutation.mutate(value as "open" | "in_progress" | "resolved" | "closed" | "duplicate" | "wontfix")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="duplicate">Duplicate</SelectItem>
                      <SelectItem value="wontfix">Won't Fix</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline">{feedback.status.replace("_", " ")}</Badge>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Assigned To</label>
                <p className="text-sm text-muted-foreground">
                  Unassigned
                </p>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Created: {format(new Date(feedback.created_at), "PPp")}</p>
                <p>Updated: {format(new Date(feedback.updated_at), "PPp")}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FeedbackComments feedbackId={feedbackId} />
              
              <div className="space-y-3">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[80px]"
                />
                <Button 
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  size="sm"
                >
                  {addCommentMutation.isPending ? "Adding..." : "Add Comment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}