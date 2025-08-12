import { useState } from "react";
import { useParams } from "react-router-dom";
import SEO from "@/components/layout/SEO";
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
      </div>

      <SharedCalendar
        view={activeView}
        selectedDate={selectedDate}
        onSelectedDateChange={setSelectedDate}
        showLegend={true}
        groupId={groupId}
      />
    </div>
  );
};

export default CalendarPage;