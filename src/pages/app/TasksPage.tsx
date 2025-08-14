import { useState } from "react";
import { useParams } from "react-router-dom";
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SharedCalendar from "@/components/calendar/SharedCalendar";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { TaskModal } from "@/components/tasks/TaskModal";
import { Plus } from "lucide-react";
import { useDemoOperations } from "@/hooks/useDemoOperations";

const TasksPage = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sortBy, setSortBy] = useState("default"); // Default to combined sort
  const [searchQuery, setSearchQuery] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const { blockCreate } = useDemoOperations();
  const [filters, setFilters] = useState({
    status: [] as string[],
    assignee: undefined,
    priority: [] as string[],
    category: [] as string[],
    dueDateRange: undefined,
    mine: false,
  });

  if (!groupId) {
    return <div>Group ID not found</div>;
  }

  return (
    <div className="space-y-6">
      <SEO title="Tasks — DaveAssist" description="Manage and coordinate care tasks." />
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Task Center</h2>
        <Button 
          variant="hero"
          onClick={() => {
            if (blockCreate()) return;
            setShowTaskModal(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          New task
        </Button>
      </div>

      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">Tasks to accomplish</TabsTrigger>
          <TabsTrigger value="calendar">Calendar Overview</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tasks" className="space-y-6">
          <TaskFilters
            groupId={groupId}
            sortBy={sortBy}
            setSortBy={setSortBy}
            filters={filters}
            setFilters={setFilters}
            hideCompleted={hideCompleted}
            setHideCompleted={setHideCompleted}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
          
          <TaskList
            groupId={groupId}
            sortBy={sortBy}
            filters={filters}
            hideCompleted={hideCompleted}
            searchQuery={searchQuery}
          />
        </TabsContent>
        
        <TabsContent value="calendar">
          <SharedCalendar
            view="month"
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            showLegend={true}
            filters={{ showCompleted: true }}
            groupId={groupId}
          />
        </TabsContent>
      </Tabs>
      
      {/* New Task Modal */}
      <TaskModal
        task={null}
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        groupId={groupId}
      />
    </div>
  );
};

export default TasksPage;
