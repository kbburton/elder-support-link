import { useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Search, Filter, SortAsc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskModal } from "@/components/tasks/TaskModal";
import { EnhancedTaskModal } from "@/components/tasks/EnhancedTaskModal";
// TaskFilters component will be used inline since it needs different props
import SEO from "@/components/layout/SEO";

export default function TasksPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("due_date");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [filters, setFilters] = useState({
    status: [] as string[],
    assignee: "",
    priority: [] as string[],
    category: [] as string[],
    dueDateRange: {},
    mine: false,
  });

  if (!groupId) {
    return <div>Group ID not found</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <SEO 
        title="Tasks - Care Coordination"
        description="Manage and track tasks for care coordination"
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            Manage and track tasks for your care group
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SortAsc className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due_date">Due Date</SelectItem>
              <SelectItem value="created_at">Created Date</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Filter tasks by status, priority, assignee, and more
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select 
                  value={filters.status.join(",")} 
                  onValueChange={(value) => setFilters({...filters, status: value ? value.split(",") : []})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="InProgress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select 
                  value={filters.priority.join(",")} 
                  onValueChange={(value) => setFilters({...filters, priority: value ? value.split(",") : []})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All priorities</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 mt-8">
                <input
                  type="checkbox"
                  id="hide-completed"
                  checked={hideCompleted}
                  onChange={(e) => setHideCompleted(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="hide-completed" className="text-sm font-medium">
                  Hide completed tasks
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Tasks</TabsTrigger>
          <TabsTrigger value="open">
            Open
            <Badge variant="secondary" className="ml-2">
              {/* This will be populated by the TaskList component */}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="in-progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <TaskList
            groupId={groupId}
            sortBy={sortBy}
            filters={filters}
            hideCompleted={hideCompleted}
            searchQuery={searchQuery}
          />
        </TabsContent>

        <TabsContent value="open" className="space-y-4">
          <TaskList
            groupId={groupId}
            sortBy={sortBy}
            filters={{ ...filters, status: ["Open"] }}
            hideCompleted={hideCompleted}
            searchQuery={searchQuery}
          />
        </TabsContent>

        <TabsContent value="in-progress" className="space-y-4">
          <TaskList
            groupId={groupId}
            sortBy={sortBy}
            filters={{ ...filters, status: ["InProgress"] }}
            hideCompleted={hideCompleted}
            searchQuery={searchQuery}
          />
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <TaskList
            groupId={groupId}
            sortBy={sortBy}
            filters={{ ...filters, status: ["Completed"] }}
            hideCompleted={false}
            searchQuery={searchQuery}
          />
        </TabsContent>
      </Tabs>

      <EnhancedTaskModal
        task={null}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        groupId={groupId}
      />
    </div>
  );
}