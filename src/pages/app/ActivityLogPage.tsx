import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Filter, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ActivityLogEntry from "@/components/activity-log/ActivityLogEntry";
import ActivityLogForm from "@/components/activity-log/ActivityLogForm";
import { useDemoActivities } from "@/hooks/useDemoData";
import { useDemo } from "@/hooks/useDemo";
import { useDemoOperations } from "@/hooks/useDemoOperations";

const ActivityLogPage = () => {
  const { groupId } = useParams();
  const queryClient = useQueryClient();
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all_types");
  const [dateFilter, setDateFilter] = useState("all_dates");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const { isDemo } = useDemo();
  const demoActivities = useDemoActivities(groupId);
  const { blockCreate } = useDemoOperations();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email ?? "");

        // Prefer boolean flag if present
        const { data: memberData } = await supabase
          .from("care_group_members")
          .select("is_admin, role")
          .eq("user_id", user.id)
          .eq("group_id", groupId)
          .maybeSingle();

        setIsGroupAdmin(Boolean(memberData?.is_admin) || memberData?.role === "admin");
      }
    };
    getUser();
  }, [groupId]);

  const { data: activityLogs, isLoading } = demoActivities.isDemo
    ? demoActivities
    : useQuery({
        queryKey: ["activity-logs", groupId, searchTerm, typeFilter, dateFilter],
        queryFn: async () => {
          let query = supabase
            .from("activity_logs")
            .select("*")
            .eq("group_id", groupId)
            .eq("is_deleted", false) // exclude soft-deleted
            .order("date_time", { ascending: false });

          if (searchTerm) {
            query = query.or(`title.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
          }

          if (typeFilter && typeFilter !== "all_types") {
            query = query.eq("type", typeFilter);
          }

          if (dateFilter && dateFilter !== "all_dates") {
            const now = new Date();
            let startDate: Date;

            switch (dateFilter) {
              case "today":
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
              case "week":
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
              case "month":
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
              default:
                startDate = new Date(0);
            }

            query = query.gte("date_time", startDate.toISOString());
          }

          const { data, error } = await query;
          if (error) throw error;
          return data;
        },
        enabled: !!groupId && !isDemo,
      });

  // Soft delete using RPC; logs in deletion_audit and sets is_deleted flags.
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) {
        toast({
          title: "Read-only demo",
          description: "Deletion is disabled in demo mode.",
        });
        return;
      }

      // Call your SECURITY DEFINER function:
      // expected args: p_activity_id, p_by_user_id, p_by_email
      const { error } = await supabase.rpc("soft_delete_activity", {
        p_activity_id: id,
        p_by_user_id: currentUserId,
        p_by_email: currentUserEmail,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      toast({ title: "Moved to Trash", description: "Activity was soft-deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  // Keep the callback signature expected by ActivityLogEntry, but route to soft delete
  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingEntry(null);
    queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEntry(null);
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        <SEO title="Activity Log — DaveAssist" description="Log calls, visits, and interactions." />
        <ActivityLogForm
          editingEntry={editingEntry}
          onSave={handleFormSave}
          onCancel={handleFormCancel}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEO title="Activity Log — DaveAssist" description="Log calls, visits, and interactions." />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Activity Log</h2>
        <Button
          onClick={() => {
            if (blockCreate()) return;
            setShowForm(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Entry
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Input
                placeholder="Search title and notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_types">All types</SelectItem>
                  <SelectItem value="inperson">In-Person Visit</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="video">Video Call</SelectItem>
                  <SelectItem value="email">Email/Message</SelectItem>
                  <SelectItem value="observation">Observation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_dates">All dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Past week</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setTypeFilter("all_types");
                  setDateFilter("all_dates");
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log Entries */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Loading activity logs...</p>
            </CardContent>
          </Card>
        ) : activityLogs && activityLogs.length > 0 ? (
          activityLogs.map((entry: any) => (
            <ActivityLogEntry
              key={entry.id}
              entry={entry}
              onEdit={handleEdit}
              onDelete={() => handleDelete(entry.id)} // unified soft delete
              currentUserId={currentUserId}
              isGroupAdmin={isGroupAdmin}
            />
          ))
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">No activity log entries found.</p>
                {(searchTerm ||
                  (typeFilter && typeFilter !== "all_types") ||
                  (dateFilter && dateFilter !== "all_dates")) && (
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your search or filter criteria.
                  </p>
                )}
                <Button
                  onClick={() => {
                    if (blockCreate()) return;
                    setShowForm(true);
                  }}
                  className="mt-4"
                >
                  Create your first entry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ActivityLogPage;
