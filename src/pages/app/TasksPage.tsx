import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MonthlyOverview from "@/components/calendar/MonthlyOverview";
import TasksCrud from "@/pages/crud/TasksCrud";

const TasksPage = () => {
  return (
    <div className="space-y-6">
      <SEO title="Tasks — DaveAssist" description="Manage and coordinate care tasks." />
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Task Center</h2>
        <div className="flex gap-2">
          <Button variant="hero">New task</Button>
          <Button variant="outline">Templates</Button>
        </div>
      </div>

      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="calendar">Calendar Overview</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tasks" className="space-y-4">
          <TasksCrud />
        </TabsContent>
        
        <TabsContent value="calendar">
          <MonthlyOverview />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TasksPage;
