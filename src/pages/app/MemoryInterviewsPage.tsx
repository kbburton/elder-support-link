import { useState } from "react";
import { useParams } from "react-router-dom";
import SEO from "@/components/layout/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScheduleInterviewForm } from "@/components/memory-interviews/ScheduleInterviewForm";
import { InterviewsList } from "@/components/memory-interviews/InterviewsList";
import { StoriesList } from "@/components/memory-interviews/StoriesList";
import { Calendar, BookOpen, Video } from "lucide-react";

export default function MemoryInterviewsPage() {
  const { groupId } = useParams();
  const [activeTab, setActiveTab] = useState("schedule");

  if (!groupId) {
    return (
      <>
        <SEO 
          title="Memory Interviews" 
          description="Preserve precious memories through AI-powered phone interviews"
        />
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-muted-foreground">Please select a care group to continue.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO 
        title="Memory Interviews" 
        description="Preserve precious memories through AI-powered phone interviews"
      />
      
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Video className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Memory Interviews</h1>
            <p className="text-muted-foreground">
              Preserve life stories through AI-guided phone conversations
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="interviews" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Interviews
            </TabsTrigger>
            <TabsTrigger value="stories" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Stories
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-6">
            <ScheduleInterviewForm careGroupId={groupId} />
          </TabsContent>

          <TabsContent value="interviews" className="space-y-6">
            <InterviewsList careGroupId={groupId} />
          </TabsContent>

          <TabsContent value="stories" className="space-y-6">
            <StoriesList careGroupId={groupId} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
