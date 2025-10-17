import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Eye, Download, AlertTriangle, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { StoryViewerModal } from "./StoryViewerModal";

interface StoriesListProps {
  careGroupId: string;
}

export function StoriesList({ careGroupId }: StoriesListProps) {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

  const { data: stories, isLoading } = useQuery({
    queryKey: ["memory-stories", careGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memory_stories")
        .select("*")
        .eq("care_group_id", careGroupId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Loading stories...</div>;
  }

  if (!stories || stories.length === 0) {
    return (
      <Card className="p-8 text-center">
        <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No stories created yet</p>
        <p className="text-sm text-muted-foreground mt-2">
          Stories will appear here after interviews are completed and processed
        </p>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_review":
        return <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3" />Pending Review</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-500 gap-1"><CheckCircle className="h-3 w-3" />Approved</Badge>;
      case "published":
        return <Badge variant="default" className="bg-blue-500 gap-1"><BookOpen className="h-3 w-3" />Published</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="space-y-4">
        {stories.map((story) => (
          <Card key={story.id} className="p-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{story.title}</h3>
                    {getStatusBadge(story.status)}
                    {story.flagged_content && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Flagged
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Created {formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}
                  </p>

                  {story.story_text && (
                    <p className="text-sm line-clamp-3">{story.story_text}</p>
                  )}

                  {story.flagged_content && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                      <p className="text-sm text-destructive font-medium">Content Flagged for Review</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This story has been automatically flagged and requires admin review before publishing
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedStoryId(story.id)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Story
                </Button>
                
                {story.status !== "pending_review" && (
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {selectedStoryId && (
        <StoryViewerModal
          storyId={selectedStoryId}
          onClose={() => setSelectedStoryId(null)}
        />
      )}
    </>
  );
}
