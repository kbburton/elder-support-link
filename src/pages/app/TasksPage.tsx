import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { EnhancedTaskModal } from "@/components/tasks/EnhancedTaskModal";
import { TaskListView } from "@/components/tasks/TaskListView";
import SEO from "@/components/layout/SEO";

export default function TasksPage() {
  const { groupId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  if (!groupId) {
    return <div>Group not found</div>;
  }

  const handleEditTask = (task: any) => {
    setSelectedTask(task);
    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setSelectedTask(null);
    // Clear URL parameters when closing modal
    setSearchParams(new URLSearchParams());
  };

  // Handle URL parameters for auto-opening modals
  useEffect(() => {
    const openTask = searchParams.get('openTask');
    if (openTask && !isCreateModalOpen) {
      // Set the task with just the ID - EnhancedTaskModal will fetch full data
      setSelectedTask({ id: openTask });
      setIsCreateModalOpen(true);
    }
  }, [searchParams, isCreateModalOpen]);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <SEO 
        title="Tasks - Care Coordination"
        description="Manage and track tasks for care coordination"
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            Manage and track tasks for your care group
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Task
        </Button>
      </div>

      <TaskListView 
        groupId={groupId}
        onEdit={handleEditTask}
      />

      <EnhancedTaskModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        groupId={groupId}
        task={selectedTask}
      />
    </div>
  );
}
