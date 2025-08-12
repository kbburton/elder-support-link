import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import SEO from "@/components/layout/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { FeedbackTable } from "@/components/feedback/FeedbackTable";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";
import { FeedbackDetailView } from "@/components/feedback/FeedbackDetailView";
import { useToast } from "@/hooks/use-toast";

export default function FeedbackPage() {
  const { groupId } = useParams();
  const { isPlatformAdmin, isLoading: adminLoading } = usePlatformAdmin();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("my-submissions");

  // Check if user is group admin
  const { data: isGroupAdmin } = useQuery({
    queryKey: ["is-group-admin", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_group_members")
        .select("is_admin")
        .eq("group_id", groupId)
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();
      
      if (error) throw error;
      return data?.is_admin || false;
    },
  });

  // Set default tab based on user role
  useEffect(() => {
    if (isPlatformAdmin) {
      setActiveTab("all-submissions");
    } else if (isGroupAdmin) {
      setActiveTab("group-submissions");
    } else {
      setActiveTab("my-submissions");
    }
  }, [isPlatformAdmin, isGroupAdmin]);

  const handleViewFeedback = (feedbackId: string) => {
    setSelectedFeedbackId(feedbackId);
  };

  const handleCloseFeedback = () => {
    setSelectedFeedbackId(null);
  };

  const handleNewFeedback = () => {
    setIsModalOpen(true);
  };

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If viewing a specific feedback item
  if (selectedFeedbackId) {
    return (
      <FeedbackDetailView
        feedbackId={selectedFeedbackId}
        onClose={handleCloseFeedback}
        isPlatformAdmin={isPlatformAdmin}
        isGroupAdmin={isGroupAdmin || false}
      />
    );
  }

  return (
    <main>
      <SEO
        title="Feedback - Submit and track feedback"
        description="Submit bug reports and feature requests, track their status and collaborate with comments."
        canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/app/feedback"}
      />

      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Feedback</h1>
            <p className="text-muted-foreground">Submit and track feedback for improvements</p>
          </div>
          <Button onClick={handleNewFeedback} className="gap-2">
            <Plus className="h-4 w-4" />
            New Feedback
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <CardTitle>Feedback Submissions</CardTitle>
            <div className="flex-1 max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search feedback..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="my-submissions">My Submissions</TabsTrigger>
              {(isGroupAdmin || isPlatformAdmin) && (
                <TabsTrigger value="group-submissions">Group Submissions</TabsTrigger>
              )}
              {isPlatformAdmin && (
                <TabsTrigger value="all-submissions">All Submissions</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="my-submissions" className="mt-6">
              <FeedbackTable
                view="my-submissions"
                searchQuery={searchQuery}
                onView={handleViewFeedback}
                isPlatformAdmin={isPlatformAdmin}
                isGroupAdmin={isGroupAdmin || false}
                groupId={groupId}
              />
            </TabsContent>

            {(isGroupAdmin || isPlatformAdmin) && (
              <TabsContent value="group-submissions" className="mt-6">
                <FeedbackTable
                  view="group-submissions"
                  searchQuery={searchQuery}
                  onView={handleViewFeedback}
                  isPlatformAdmin={isPlatformAdmin}
                  isGroupAdmin={isGroupAdmin || false}
                  groupId={groupId}
                />
              </TabsContent>
            )}

            {isPlatformAdmin && (
              <TabsContent value="all-submissions" className="mt-6">
                <FeedbackTable
                  view="all-submissions"
                  searchQuery={searchQuery}
                  onView={handleViewFeedback}
                  isPlatformAdmin={isPlatformAdmin}
                  isGroupAdmin={isGroupAdmin || false}
                />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        groupId={groupId}
      />
    </main>
  );
}