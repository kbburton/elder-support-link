import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { X, Filter } from "lucide-react";

interface TaskFiltersProps {
  groupId: string;
  sortBy: string;
  setSortBy: (value: string) => void;
  filters: {
    status: string[];
    assignee?: string;
    priority: string[];
    category: string[];
    dueDateRange?: { start?: string; end?: string };
    mine: boolean;
  };
  setFilters: (filters: any) => void;
  hideCompleted: boolean;
  setHideCompleted: (value: boolean) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

export function TaskFilters({
  groupId,
  sortBy,
  setSortBy,
  filters,
  setFilters,
  hideCompleted,
  setHideCompleted,
  searchQuery,
  setSearchQuery,
}: TaskFiltersProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const { data: groupMembers = [] } = useQuery({
    queryKey: ["groupMembers", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_group_members")
        .select("user_id")
        .eq("group_id", groupId);

      if (error) throw error;
      
      // Get profile data for each user
      if (!data?.length) return [];
      
      const userIds = data.map(m => m.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);
        
      if (profileError) throw profileError;
      
      return profiles?.map(profile => ({
        id: profile.user_id,
        email: "", // Email should come from auth.users
        name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || ""
      })) || [];
    },
  });

  const statuses = ["Open", "InProgress", "Completed"];
  const priorities = ["High", "Medium", "Low"];
  const categories = ["Medical", "Personal", "Financial", "Legal", "Other"];

  const updateFilter = (key: string, value: any) => {
    setFilters({ ...filters, [key]: value });
  };

  const toggleStatusFilter = (status: string) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    updateFilter("status", newStatus);
  };

  const togglePriorityFilter = (priority: string) => {
    const newPriority = filters.priority.includes(priority)
      ? filters.priority.filter(p => p !== priority)
      : [...filters.priority, priority];
    updateFilter("priority", newPriority);
  };

  const toggleCategoryFilter = (category: string) => {
    const newCategory = filters.category.includes(category)
      ? filters.category.filter(c => c !== category)
      : [...filters.category, category];
    updateFilter("category", newCategory);
  };

  const clearAllFilters = () => {
    setFilters({
      status: [],
      priority: [],
      category: [],
      mine: false,
    });
    setHideCompleted(false);
    setSearchQuery("");
  };

  const hasActiveFilters = 
    filters.status.length > 0 ||
    filters.priority.length > 0 ||
    filters.category.length > 0 ||
    filters.mine ||
    hideCompleted ||
    searchQuery;

  return (
    <div className="space-y-4">
      {/* Search and Sort Row */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="sort">Sort by:</Label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default (Status → Due Date → Priority → Title)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="due_date">Due Date</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="created_at">Created Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="destructive" className="ml-2 h-4 w-4 p-0 text-xs">
                  !
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filters</h4>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-auto p-1 text-xs"
                  >
                    Clear all
                  </Button>
                )}
              </div>

              {/* Quick toggles */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hide-completed"
                    checked={hideCompleted}
                    onCheckedChange={setHideCompleted}
                  />
                  <Label htmlFor="hide-completed" className="text-sm">
                    Hide completed tasks
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mine"
                    checked={filters.mine}
                    onCheckedChange={(checked) => updateFilter("mine", checked)}
                  />
                  <Label htmlFor="mine" className="text-sm">
                    Show only my tasks
                  </Label>
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {statuses.map((status) => (
                    <Button
                      key={status}
                      variant={filters.status.includes(status) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleStatusFilter(status)}
                      className="h-7 text-xs"
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <Label className="text-sm font-medium">Priority</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {priorities.map((priority) => (
                    <Button
                      key={priority}
                      variant={filters.priority.includes(priority) ? "default" : "outline"}
                      size="sm"
                      onClick={() => togglePriorityFilter(priority)}
                      className="h-7 text-xs"
                    >
                      {priority}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <Label className="text-sm font-medium">Category</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={filters.category.includes(category) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleCategoryFilter(category)}
                      className="h-7 text-xs"
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          
          {filters.status.map((status) => (
            <Badge key={`status-${status}`} variant="secondary" className="text-xs">
              Status: {status}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => toggleStatusFilter(status)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          
          {filters.priority.map((priority) => (
            <Badge key={`priority-${priority}`} variant="secondary" className="text-xs">
              Priority: {priority}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => togglePriorityFilter(priority)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          
          {filters.category.map((category) => (
            <Badge key={`category-${category}`} variant="secondary" className="text-xs">
              Category: {category}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => toggleCategoryFilter(category)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          
          {filters.mine && (
            <Badge variant="secondary" className="text-xs">
              My tasks
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => updateFilter("mine", false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          
          {hideCompleted && (
            <Badge variant="secondary" className="text-xs">
              Hide completed
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => setHideCompleted(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          
          {searchQuery && (
            <Badge variant="secondary" className="text-xs">
              Search: {searchQuery}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}