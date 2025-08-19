import { useState } from "react";
import { format } from "date-fns";
import { MessageSquare, Edit, Trash2, Clock, User, FileText } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface ActivityLogEntryProps {
  entry: {
    id: string;
    date_time: string;
    type: string;
    title: string;
    notes: string;
    attachment_url?: string;
    created_by_user_id: string;
    created_by_email?: string;
    created_at: string;
  };
  onEdit: (entry: any) => void;
  onDelete: (id: string) => void;
  currentUserId?: string;
  isGroupAdmin?: boolean;
}

const ActivityLogEntry = ({ entry, onEdit, onDelete, currentUserId, isGroupAdmin }: ActivityLogEntryProps) => {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const queryClient = useQueryClient();

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ["activity-log-comments", entry.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log_comments")
        .select("*")
        .eq("activity_log_id", entry.id)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: showComments,
  });

  const { data: documentLinks } = useQuery({
    queryKey: ["activity-log-documents", entry.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_documents")
        .select(`
          document_id,
          documents(id, title, category, original_filename)
        `)
        .eq("activity_log_id", entry.id);
      
      if (error) throw error;
      return data;
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("activity_log_comments")
        .insert({
          activity_log_id: entry.id,
          comment_text: newComment,
          created_by_user_id: user.id,
          created_by_email: user.email,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-log-comments", entry.id] });
      setNewComment("");
      setAddingComment(false);
      toast({ title: "Comment added", description: "Your comment has been added successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("activity_log_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-log-comments", entry.id] });
      toast({ title: "Comment deleted", description: "Comment has been deleted." });
    },
  });

  const canEdit = currentUserId === entry.created_by_user_id || isGroupAdmin;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "phone": return "📞";
      case "video": return "📹";
      case "inperson": return "👤";
      case "email": return "📧";
      case "observation": return "👁️";
      default: return "📝";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "phone": return "Phone Call";
      case "video": return "Video Call";
      case "inperson": return "In-Person Visit";
      case "email": return "Email/Message";
      case "observation": return "Observation";
      default: return "Other";
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{getTypeIcon(entry.type)}</span>
              <Badge variant="secondary">{getTypeLabel(entry.type)}</Badge>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(new Date(entry.date_time), "MMM d, yyyy 'at' h:mm a")}
              </div>
            </div>
            <h3 className="text-lg font-medium mb-1">{entry.title}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <User className="h-3 w-3" />
              {entry.created_by_email || "Unknown user"}
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(entry)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Activity Log Entry</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this activity log entry? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(entry.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap">{entry.notes}</p>
          </div>

          {entry.attachment_url && (
            <div className="flex items-center gap-2 p-2 border rounded">
              <FileText className="h-4 w-4" />
              <a 
                href={entry.attachment_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View attachment
              </a>
            </div>
          )}

          {documentLinks && documentLinks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Linked Documents:</h4>
              <div className="flex flex-wrap gap-2">
                {documentLinks.map((link: any) => (
                  <Badge key={link.document_id} variant="outline">
                    {link.documents?.title || link.documents?.original_filename || "Unknown Document"}
                  </Badge>
                ))}
              </div>
            </div>
          )}


          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-1"
            >
              <MessageSquare className="h-4 w-4" />
              Comments ({comments?.length || 0})
            </Button>
          </div>

          {showComments && (
            <div className="space-y-3 pl-4 border-l-2 border-muted">
              {commentsLoading ? (
                <p className="text-sm text-muted-foreground">Loading comments...</p>
              ) : comments && comments.length > 0 ? (
                comments.map((comment: any) => (
                  <div key={comment.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {comment.created_by_email}
                        <span>•</span>
                        {format(new Date(comment.created_at), "MMM d, h:mm a")}
                      </div>
                      {currentUserId === comment.created_by_user_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCommentMutation.mutate(comment.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm">{comment.comment_text}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}

              {addingComment ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => addCommentMutation.mutate()}
                      disabled={!newComment.trim()}
                    >
                      Add Comment
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAddingComment(false);
                        setNewComment("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddingComment(true)}
                  className="text-xs"
                >
                  Add comment
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityLogEntry;