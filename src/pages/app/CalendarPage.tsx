import { useState } from "react";
import { useParams } from "react-router-dom";
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import SharedCalendar from "@/components/calendar/SharedCalendar";

const CalendarPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeView, setActiveView] = useState<'month' | 'week' | 'day' | 'list'>('month');

  if (!groupId) {
    return <div>Group ID not found</div>;
  }

  return (
    <div className="space-y-6">
      <SEO title="Calendar — DaveAssist" description="View and manage appointments and tasks in calendar format." />
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Calendar</h2>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Appointment
        </Button>
      </div>

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="list">Full List</TabsTrigger>
        </TabsList>

        <TabsContent value="month">
          <SharedCalendar
            view="month"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            showLegend={true}
            groupId={groupId}
          />
        </TabsContent>

        <TabsContent value="week">
          <SharedCalendar
            view="week"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            showLegend={true}
            groupId={groupId}
          />
        </TabsContent>

        <TabsContent value="day">
          <SharedCalendar
            view="day"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            showLegend={true}
            groupId={groupId}
          />
        </TabsContent>

        <TabsContent value="list">
          <SharedCalendar
            view="list"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            showLegend={true}
            groupId={groupId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CalendarPage;