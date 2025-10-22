import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";
import { Calendar, Phone, Clock, CheckCircle, XCircle, AlertCircle, Globe, Sparkles, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface InterviewsListProps {
  careGroupId: string;
}

export function InterviewsList({ careGroupId }: InterviewsListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatingStoryFor, setGeneratingStoryFor] = useState<string | null>(null);
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<string>("");

  const { data: interviews, isLoading } = useQuery({
    queryKey: ["memory-interviews", careGroupId],
    queryFn: async () => {
      console.log('Fetching interviews for care group:', careGroupId);
      
      const { data, error } = await supabase
        .from("memory_interviews")
        .select("*")
        .eq("care_group_id", careGroupId)
        .order("scheduled_at", { ascending: false });

      if (error) {
        console.error('Error fetching interviews:', error);
        throw error;
      }
      
      console.log('Interviews fetched:', data?.length || 0);
      return data;
    },
  });

  const generateStoryMutation = useMutation({
    mutationFn: async (interviewId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-memory-story', {
        body: { interview_id: interviewId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, interviewId) => {
      toast({
        title: "Story Generation Started",
        description: "The story is being generated. It may take a minute to appear in the Stories tab.",
      });
      setGeneratingStoryFor(null);
      // Invalidate queries to refresh both interviews and stories
      queryClient.invalidateQueries({ queryKey: ["memory-interviews", careGroupId] });
      queryClient.invalidateQueries({ queryKey: ["memory-stories", careGroupId] });
    },
    onError: (error: any, interviewId) => {
      toast({
        title: "Error Generating Story",
        description: error.message || "Failed to generate story. Please try again.",
        variant: "destructive",
      });
      setGeneratingStoryFor(null);
    },
  });

  const handleGenerateStory = (interviewId: string) => {
    setGeneratingStoryFor(interviewId);
    generateStoryMutation.mutate(interviewId);
  };

  const handleViewTranscript = (transcript: string) => {
    setSelectedTranscript(transcript);
    setTranscriptDialogOpen(true);
  };

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Loading interviews...</div>;
  }

  if (!interviews || interviews.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No interviews scheduled yet</p>
      </Card>
    );
  }

  const getStatusBadge = (status: string, voicemailDetected: boolean) => {
    if (voicemailDetected) {
      return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" />Voicemail</Badge>;
    }
    
    switch (status) {
      case "scheduled":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Scheduled</Badge>;
      case "in_progress":
        return <Badge variant="default" className="gap-1"><Phone className="h-3 w-3" />In Progress</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-500 gap-1"><CheckCircle className="h-3 w-3" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Dialog open={transcriptDialogOpen} onOpenChange={setTranscriptDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Interview Transcript</DialogTitle>
            <DialogDescription>
              Full conversation transcript from the memory interview
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2 font-mono text-sm whitespace-pre-wrap">
            {selectedTranscript}
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {interviews.map((interview) => (
        <Card key={interview.id} className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                {getStatusBadge(interview.status, interview.voicemail_detected || false)}
                {interview.is_test && (
                  <Badge variant="outline" className="bg-yellow-50">Test Mode</Badge>
                )}
                {interview.interview_type === "recurring" && (
                  <Badge variant="secondary">
                    Recurring ({interview.recurring_completed_count}/{interview.recurring_total_count})
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{interview.phone_number}</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(interview.scheduled_at), "PPpp")}
                    {interview.status === "scheduled" && (
                      <span className="ml-2 text-xs">
                        ({formatDistanceToNow(new Date(interview.scheduled_at), { addSuffix: true })})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  <span>
                    Your timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </span>
                </div>
              </div>

              {interview.selected_question_id && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Question ID:</span> {interview.selected_question_id}
                </p>
              )}

              {interview.custom_instructions && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Instructions:</span> {interview.custom_instructions}
                </p>
              )}

              {interview.failure_reason && (
                <p className="text-sm text-destructive">
                  <span className="font-medium">Failure reason:</span> {interview.failure_reason}
                </p>
              )}

              {interview.duration_seconds && (
                <p className="text-sm text-muted-foreground">
                  Duration: {Math.floor(interview.duration_seconds / 60)} minutes
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {interview.status === "scheduled" && (
                <Button variant="outline" size="sm">
                  Reschedule
                </Button>
              )}
              
              {interview.status === "completed" && interview.raw_transcript && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleViewTranscript(interview.raw_transcript)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Transcript
                </Button>
              )}
              
              {interview.status === "completed" && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleGenerateStory(interview.id)}
                  disabled={generatingStoryFor === interview.id}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generatingStoryFor === interview.id ? "Generating..." : "Generate Story"}
                </Button>
              )}
            </div>
          </div>
        </Card>
        ))}
      </div>
    </>
  );
}
