import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Download, RefreshCw } from "lucide-react";
import { StoryRegenerationModal } from "./StoryRegenerationModal";

interface StoryViewerModalProps {
  storyId: string;
  onClose: () => void;
}

export function StoryViewerModal({ storyId, onClose }: StoryViewerModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState("");
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  const { data: story, isLoading } = useQuery({
    queryKey: ["memory-story", storyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memory_stories")
        .select("*")
        .eq("id", storyId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("memory_stories")
        .update({
          status,
          reviewed_by_user_id: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq("id", storyId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "memory-story" || query.queryKey[0] === "memory-stories"
      });
      toast({
        title: "Review Submitted",
        description: `Story ${variables.status === "approved" ? "approved" : "rejected"}`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="text-center py-8">Loading story...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!story) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-2xl">{story.title}</DialogTitle>
              <DialogDescription>
                Created {new Date(story.created_at).toLocaleDateString()}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant={story.status === "published" ? "default" : "outline"}>
                {story.status.replace("_", " ")}
              </Badge>
              {story.flagged_content && (
                <Badge variant="destructive">Flagged</Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <Separator />

        <div className="space-y-6">
          {story.flagged_content && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <h4 className="font-semibold text-destructive mb-2">Flagged Content</h4>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(story.flagged_content, null, 2)}
              </pre>
            </div>
          )}

          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap leading-relaxed">
              {story.story_text}
            </div>
          </div>

          {story.memory_facts && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Key Memory Facts</h4>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(story.memory_facts, null, 2)}
              </pre>
            </div>
          )}

          {story.status === "pending_review" && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-semibold">Review This Story</h4>
                <Textarea
                  placeholder="Add review notes (optional)..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => reviewMutation.mutate({ status: "approved", notes: reviewNotes })}
                    disabled={reviewMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Story
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => reviewMutation.mutate({ status: "rejected", notes: reviewNotes })}
                    disabled={reviewMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Story
                  </Button>
                </div>
              </div>
            </>
          )}

          {story.reviewed_at && story.review_notes && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Review Notes</h4>
              <p className="text-sm text-muted-foreground">{story.review_notes}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Reviewed {new Date(story.reviewed_at).toLocaleDateString()}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            {story.audio_url && (
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Audio
              </Button>
            )}
            {story.transcript_url && (
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Transcript
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowRegenerateModal(true)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate Story
            </Button>
          </div>
        </div>
      </DialogContent>

      {showRegenerateModal && (
        <StoryRegenerationModal
          isOpen={showRegenerateModal}
          onClose={() => setShowRegenerateModal(false)}
          storyId={storyId}
          onComplete={(newStory) => {
            queryClient.invalidateQueries({ queryKey: ["memory-story", storyId] });
            queryClient.invalidateQueries({ queryKey: ["memory-stories"] });
          }}
        />
      )}
    </Dialog>
  );
}
