import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface FeedbackTableProps {
  view: "my-submissions" | "group-submissions" | "all-submissions";
  searchQuery: string;
  onView: (feedbackId: string) => void;
  isPlatformAdmin: boolean;
  isGroupAdmin: boolean;
  groupId?: string;
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "open": return "default";
    case "in_progress": return "secondary";
    case "resolved": return "outline";
    case "closed": return "outline";
    case "duplicate": return "secondary";
    case "wontfix": return "destructive";
    default: return "default";
  }
};

const getSeverityBadgeVariant = (severity: string) => {
  switch (severity) {
    case "low": return "outline";
    case "medium": return "secondary";
    case "high": return "default";
    case "critical": return "destructive";
    default: return "default";
  }
};

export function FeedbackTable({ 
  view, 
  searchQuery, 
  onView, 
  isPlatformAdmin, 
  isGroupAdmin,
  groupId 
}: FeedbackTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    status: "all",
    type: "all",
    severity: "all",
    assignee: "all",
    group: "all",
  });

  const { data: feedbackItems = [], isLoading } = useQuery({
    queryKey: ["feedback-items", view, searchQuery, filters, groupId],
    queryFn: async () => {
      let query = supabase
        .from("feedback_items")
        .select(`
          *,
          care_group:care_group_id(name)
        `);

      // Apply view-specific filters
      if (view === "my-submissions") {
        const { data: { user } } = await supabase.auth.getUser();
        query = query.eq("created_by_user_id", user?.id);
      } else if (view === "group-submissions" && groupId) {
        query = query.eq("care_group_id", groupId);
      }

      // Apply search
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      // Apply filters
      if (filters.status && filters.status !== "all") query = query.eq("status", filters.status as any);
      if (filters.type && filters.type !== "all") query = query.eq("type", filters.type as any);
      if (filters.severity && filters.severity !== "all") query = query.eq("severity", filters.severity as any);
      if (filters.assignee && filters.assignee !== "all") query = query.eq("assigned_to_user_id", filters.assignee);
      if (filters.group && filters.group !== "all") query = query.eq("care_group_id", filters.group);

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("feedback_items")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Feedback deleted",
        description: "The feedback item has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["feedback-items"] });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: "open" | "in_progress" | "resolved" | "closed" | "duplicate" | "wontfix" }) => {
      const { error } = await supabase
        .from("feedback_items")
        .update({ status })
        .eq("id", itemId);
      if (error) throw error;

      // Send notification email in background (don't block UX on failure)
      try {
        await supabase.functions.invoke('notify', {
          body: {
            type: 'feedback-update',
            feedback_id: itemId,
            update_type: 'status',
            baseUrl: window.location.origin,
          },
        });
      } catch (notifyError) {
        console.error('Failed to send feedback status notification:', notifyError);
        // Continue silently - don't block user experience
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback-items"] });
    },
    onError: (error) => {
      toast({
        title: "Status update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canEdit = (item: any) => {
    return isPlatformAdmin || isGroupAdmin || item.created_by_user_id === (supabase.auth.getUser().then(r => r.data.user?.id));
  };

  const canDelete = (item: any) => {
    return isPlatformAdmin || (isGroupAdmin && item.care_group_id === groupId);
  };

  const canChangeStatus = () => {
    return isPlatformAdmin || isGroupAdmin;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters for platform admin */}
      {isPlatformAdmin && view === "all-submissions" && (
        <div className="flex gap-4 flex-wrap">
          <Select value={filters.status} onValueChange={(value: string) => setFilters(f => ({ ...f, status: value }))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="duplicate">Duplicate</SelectItem>
              <SelectItem value="wontfix">Won't Fix</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.type} onValueChange={(value: string) => setFilters(f => ({ ...f, type: value }))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="defect">Defect</SelectItem>
              <SelectItem value="feature">Feature</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.severity} onValueChange={(value: string) => setFilters(f => ({ ...f, severity: value }))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              {(view === "group-submissions" || view === "all-submissions") && (
                <>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Assignee</TableHead>
                </>
              )}
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedbackItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No feedback items found
                </TableCell>
              </TableRow>
            ) : (
              feedbackItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {item.type === "defect" ? "Bug" : "Feature"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSeverityBadgeVariant(item.severity)}>
                      {item.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canChangeStatus() ? (
                      <Select
                        value={item.status}
                        onValueChange={(value: "open" | "in_progress" | "resolved" | "closed" | "duplicate" | "wontfix") => updateStatusMutation.mutate({ itemId: item.id, status: value })}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                          <SelectItem value="duplicate">Duplicate</SelectItem>
                          <SelectItem value="wontfix">Won't Fix</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={getStatusBadgeVariant(item.status)}>
                        {item.status.replace("_", " ")}
                      </Badge>
                    )}
                  </TableCell>
                  {(view === "group-submissions" || view === "all-submissions") && (
                    <>
                      <TableCell>{item.created_by_email}</TableCell>
                      <TableCell>Unassigned</TableCell>
                    </>
                  )}
                  <TableCell>{format(new Date(item.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>{format(new Date(item.updated_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(item.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        {canDelete(item) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete feedback item?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the feedback item and all its comments.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteItemMutation.mutate(item.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}