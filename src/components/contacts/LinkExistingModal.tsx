import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Calendar, FileText, CheckSquare, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface LinkExistingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  entityType: "activity_logs" | "appointments" | "tasks" | "documents";
  onLinked: () => void;
}

interface EntityItem {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  date_time?: string;
  due_date?: string;
  upload_date?: string;
  created_at: string;
  status?: string;
  type?: string;
  original_filename?: string;
}

export default function LinkExistingModal({
  open,
  onOpenChange,
  contactId,
  entityType,
  onLinked,
}: LinkExistingModalProps) {
  const { groupId } = useParams();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isLinking, setIsLinking] = useState(false);

  const itemsPerPage = 10;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedItems([]);
      setPage(0);
      setCategoryFilter("");
      setStatusFilter("");
    }
  }, [open]);

  // Fetch items based on entity type
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["linkable-items", entityType, groupId, searchQuery, categoryFilter, statusFilter, page],
    queryFn: async () => {
      let query = (supabase as any).from(entityType).select("*");
      
      // Filter by group
      query = query.eq("group_id", groupId!);

      // Apply search filter
      if (searchQuery.trim()) {
        if (entityType === "activity_logs") {
          query = query.or(`title.ilike.%${searchQuery}%,notes.ilike.%${searchQuery}%`);
        } else if (entityType === "appointments") {
          query = query.or(`description.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`);
        } else if (entityType === "tasks") {
          query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
        } else if (entityType === "documents") {
          query = query.or(`title.ilike.%${searchQuery}%,original_filename.ilike.%${searchQuery}%`);
        }
      }

      // Apply category filter
      if (categoryFilter) {
        query = query.eq("category", categoryFilter);
      }

      // Apply status filter for tasks
      if (statusFilter && entityType === "tasks") {
        query = query.eq("status", statusFilter);
      }

      // Order by most recent first
      if (entityType === "activity_logs") {
        query = query.order("date_time", { ascending: false });
      } else if (entityType === "appointments") {
        query = query.order("date_time", { ascending: false });
      } else if (entityType === "documents") {
        query = query.order("upload_date", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      // Apply pagination
      query = query.range(page * itemsPerPage, (page + 1) * itemsPerPage - 1);

      const { data, error } = await query;
      if (error) throw error;
      return data as EntityItem[];
    },
    enabled: open && !!groupId,
  });

  // Fetch existing linked items to exclude them
  const { data: linkedItemIds = [] } = useQuery({
    queryKey: ["linked-item-ids", contactId, entityType],
    queryFn: async () => {
      let query;
      if (entityType === "activity_logs") {
        query = supabase
          .from("contact_activities")
          .select("activity_log_id")
          .eq("contact_id", contactId);
      } else if (entityType === "appointments") {
        query = supabase
          .from("contact_appointments")
          .select("appointment_id")
          .eq("contact_id", contactId);
      } else if (entityType === "tasks") {
        query = supabase
          .from("contact_tasks")
          .select("task_id")
          .eq("contact_id", contactId);
      } else if (entityType === "documents") {
        query = supabase
          .from("contact_documents")
          .select("document_id")
          .eq("contact_id", contactId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const columnMap = {
        activity_logs: "activity_log_id",
        appointments: "appointment_id",
        tasks: "task_id",
        documents: "document_id",
      };
      
      return data?.map((item: any) => item[columnMap[entityType]]) || [];
    },
    enabled: open && !!contactId,
  });

  // Filter out already linked items
  const availableItems = items.filter(item => !linkedItemIds.includes(item.id));

  const getItemTitle = (item: EntityItem) => {
    return item.title || item.description || item.original_filename || "Untitled";
  };

  const getItemSubtitle = (item: EntityItem) => {
    if (entityType === "activity_logs") {
      return item.date_time ? format(new Date(item.date_time), "MMM d, yyyy") : "";
    } else if (entityType === "appointments") {
      return item.date_time ? format(new Date(item.date_time), "MMM d, yyyy 'at' h:mm a") : "";
    } else if (entityType === "tasks") {
      return item.due_date ? `Due: ${format(new Date(item.due_date), "MMM d, yyyy")}` : "";
    } else if (entityType === "documents") {
      return item.upload_date ? format(new Date(item.upload_date), "MMM d, yyyy") : "";
    }
    return "";
  };

  const getItemIcon = () => {
    const iconMap = {
      activity_logs: Calendar,
      appointments: Calendar,
      tasks: CheckSquare,
      documents: FolderOpen,
    };
    return iconMap[entityType];
  };

  const handleItemToggle = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleLink = async () => {
    if (selectedItems.length === 0) return;

    setIsLinking(true);
    try {
      // Insert links one by one to handle duplicate constraints gracefully
      for (const itemId of selectedItems) {
        let error;
        
        if (entityType === "activity_logs") {
          ({ error } = await supabase
            .from("contact_activities")
            .insert({
              contact_id: contactId,
              activity_log_id: itemId,
            }));
        } else if (entityType === "appointments") {
          ({ error } = await supabase
            .from("contact_appointments")
            .insert({
              contact_id: contactId,
              appointment_id: itemId,
            }));
        } else if (entityType === "tasks") {
          ({ error } = await supabase
            .from("contact_tasks")
            .insert({
              contact_id: contactId,
              task_id: itemId,
            }));
        } else if (entityType === "documents") {
          ({ error } = await supabase
            .from("contact_documents")
            .insert({
              contact_id: contactId,
              document_id: itemId,
            }));
        }
        
        // Ignore duplicate key errors silently
        if (error && !error.message?.includes("duplicate") && !error.message?.includes("unique")) {
          throw error;
        }
      }

      toast({
        title: "Success",
        description: `Linked to ${selectedItems.length} ${entityType.replace("_", " ").replace("s", "")}${selectedItems.length === 1 ? "" : "s"}`,
      });

      onLinked();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to link items",
        variant: "destructive",
      });
    } finally {
      setIsLinking(false);
    }
  };

  const Icon = getItemIcon();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            Link Existing {entityType.replace("_", " ").replace("s", "").split(" ").map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(" ")}
          </DialogTitle>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2">
            {(entityType === "appointments" || entityType === "documents") && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            )}

            {entityType === "tasks" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : availableItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items found
            </div>
          ) : (
            availableItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50",
                  selectedItems.includes(item.id) && "bg-muted border-primary"
                )}
                onClick={() => handleItemToggle(item.id)}
              >
                <Checkbox
                  checked={selectedItems.includes(item.id)}
                  onChange={() => handleItemToggle(item.id)}
                />
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{getItemTitle(item)}</p>
                  {getItemSubtitle(item) && (
                    <p className="text-sm text-muted-foreground">{getItemSubtitle(item)}</p>
                  )}
                  <div className="flex gap-2 mt-1">
                    {item.category && (
                      <Badge variant="outline" className="text-xs">
                        {item.category}
                      </Badge>
                    )}
                    {item.status && (
                      <Badge variant="outline" className="text-xs">
                        {item.status}
                      </Badge>
                    )}
                    {item.type && (
                      <Badge variant="outline" className="text-xs">
                        {item.type}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {availableItems.length === itemsPerPage && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={availableItems.length < itemsPerPage}
            >
              Next
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            {selectedItems.length} item{selectedItems.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLink}
              disabled={selectedItems.length === 0 || isLinking}
            >
              {isLinking ? "Linking..." : `Link ${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}