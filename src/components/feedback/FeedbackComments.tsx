import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";

interface FeedbackCommentsProps {
  feedbackId: string;
}

export function FeedbackComments({ feedbackId }: FeedbackCommentsProps) {
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["feedback-comments", feedbackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_comments")
        .select("*")
        .eq("feedback_id", feedbackId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        No comments yet
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto">
      {comments.map((comment) => (
        <div key={comment.id} className="space-y-2 pb-4 border-b last:border-b-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm font-medium">{comment.created_by_email}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap pl-5">
            {comment.body}
          </p>
        </div>
      ))}
    </div>
  );
}