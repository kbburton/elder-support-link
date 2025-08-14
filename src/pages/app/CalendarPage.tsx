import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import SharedCalendar from "@/components/calendar/SharedCalendar";
import { AppointmentModal } from "@/components/appointments/AppointmentModal";
import { useDemoOperations } from "@/hooks/useDemoOperations";
import { GroupWelcomeModal } from "@/components/welcome/GroupWelcomeModal";
import { useGroupWelcome } from "@/hooks/useGroupWelcome";
import { useLastActiveGroup } from "@/hooks/useLastActiveGroup";
import { supabase } from "@/integrations/supabase/client";

const CalendarPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeView, setActiveView] = useState<'month' | 'week' | 'day' | 'list'>('month');
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  
  const { blockCreate } = useDemoOperations();
  
  // Use the last active group hook to update when user navigates to this page
  useLastActiveGroup();
  
  // Use the welcome modal hook
  const { showWelcome, closeWelcome } = useGroupWelcome(groupId || "", groupName);

  // Fetch group name for welcome modal
  useEffect(() => {
    const fetchGroupName = async () => {
      if (!groupId) return;
      
      try {
        const { data: group } = await supabase
          .from('care_groups')
          .select('name')
          .eq('id', groupId)
          .single();
        
        if (group) {
          setGroupName(group.name);
        }
      } catch (error) {
        console.error('Error fetching group name:', error);
      }
    };

    fetchGroupName();
  }, [groupId]);

  if (!groupId) {
    return <div>Group ID not found</div>;
  }

  const handleNewAppointment = () => {
    if (blockCreate()) return;
    setShowAppointmentModal(true);
  };

  return (
    <div className="space-y-6">
      <SEO title="Calendar — DaveAssist" description="View and manage appointments and tasks in calendar format." />
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Calendar</h2>
        <Button 
          variant="hero" 
          onClick={handleNewAppointment}
        >
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
      
      <GroupWelcomeModal
        groupId={groupId}
        groupName={groupName}
        isOpen={showWelcome}
        onClose={closeWelcome}
      />
      
      {/* New Appointment Modal - Handled by SharedCalendar component */}
    </div>
  );
};

export default CalendarPage;