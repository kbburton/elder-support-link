import { useSearchParams, useNavigate, useParams } from "react-router-dom";
// … your other imports …

export default function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();

  const editId = searchParams.get("edit"); // if present, open modal for this id

  // Load the entity by id from your existing list or via fetch
  const taskToEdit = useMemo(
    () => tasks.find((t) => t.id === editId) ?? null,
    [tasks, editId]
  );

  const handleCloseModal = () => {
    // Close modal AND remove ?edit while staying on the same page
    searchParams.delete("edit");
    setSearchParams(searchParams, { replace: true });
  };

  // Render your existing EnhancedTaskModal with task={taskToEdit}
  // <EnhancedTaskModal task={taskToEdit} isOpen={!!editId} onClose={handleCloseModal} groupId={groupId!} />
  // …rest of your page
}

import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { EnhancedTaskModal } from "@/components/tasks/EnhancedTaskModal";
import { TaskListView } from "@/components/tasks/TaskListView";
import SEO from "@/components/layout/SEO";

export default function TasksPage() {
  const { groupId } = useParams();
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
  };

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
