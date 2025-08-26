import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import SEO from "@/components/layout/SEO";
import { UnifiedTableView } from "@/components/shared/UnifiedTableView";
import { useToast } from "@/hooks/use-toast";
import { useDemoOperations } from "@/hooks/useDemoOperations";
import { useDemo } from "@/hooks/useDemo";
import { useDemoActivities } from "@/hooks/useDemoData";
import { ActivityModal } from "@/components/activities/ActivityModal";
import { UnifiedAssociationManager } from "@/components/shared/UnifiedAssociationManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { softDeleteEntity } from "@/lib/delete/rpc";
import { format } from "date-fns";
import { Link } from "lucide-react";
import { ENTITY } from "@/constants/entities";

export default function ActivityPage() {
  const { groupId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { blockOperation } = useDemoOperations();
  const { isDemo } = useDemo();
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedActivityForAssociations, setSelectedActivityForAssociations] = useState<any>(null);
  const [isAssociationsModalOpen, setIsAssociationsModalOpen] = useState(false);

  // Use demo data if in demo mode
  const demoActivities = useDemoActivities(groupId);
  
  const { data: realActivities = [], isLoading: realLoading } = useQuery({
    queryKey: ["activities", groupId],
    queryFn: async () => {
      if (!groupId || groupId === ':groupId' || groupId === 'undefined' || groupId.startsWith(':')) {
        return [];
      }
      
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*, created_by_email")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .order("date_time", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && groupId !== ':groupId' && groupId !== 'undefined' && !groupId.startsWith(':') && !isDemo,
  });

  // Use demo data if available, otherwise use real data
  const activities = isDemo && demoActivities.data ? demoActivities.data : realActivities;
  const isLoading = isDemo ? false : realLoading;

  // Get current user for permissions
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Check if user is group admin
  const { data: isGroupAdmin = false } = useQuery({
    queryKey: ["isGroupAdmin", groupId, currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id || !groupId) return false;
      
      const { data } = await supabase
        .from("care_group_members")
        .select("is_admin")
        .eq("group_id", groupId)
        .eq("user_id", currentUser.id)
        .single();
      
      return data?.is_admin || false;
    },
    enabled: !!currentUser?.id && !!groupId,
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      if (blockOperation()) return { success: false, error: "Operation blocked in demo mode" };
      
      if (!currentUser) throw new Error('User not authenticated');
      
      const result = await softDeleteEntity('activity', activityId, currentUser.id, currentUser.email!);
      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast({ title: "Success", description: "Activity moved to trash successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (activityIds: string[]) => {
      if (blockOperation()) return { success: false, error: "Operation blocked in demo mode" };
      
      if (!currentUser) throw new Error('User not authenticated');
      
      const results = [];
      for (const id of activityIds) {
        try {
          const result = await softDeleteEntity('activity', id, currentUser.id, currentUser.email!);
          results.push(result);
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }
      
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        throw new Error(`${failures.length} activities could not be deleted`);
      }
      
      return results;
    },
    onSuccess: (_, activityIds) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast({ 
        title: "Success", 
        description: `${activityIds.length} activity(ies) moved to trash. Items can be restored in group settings for 30 days.`
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleEdit = (activity: any) => {
    setSelectedActivity(activity);
    setShowEditModal(true);
  };

  const handleCreateNew = () => {
    setShowCreateModal(true);
  };

  const handleDelete = async (activityId: string) => {
    await deleteActivityMutation.mutateAsync(activityId);
  };

  const handleBulkDelete = async (activityIds: string[]) => {
    await bulkDeleteMutation.mutateAsync(activityIds);
  };

  const canDeleteActivity = (activity: any) => {
    if (!currentUser) return false;
    return isGroupAdmin || activity.created_by_user_id === currentUser.id;
  };

  const getActivityTitle = (activity: any) => {
    return activity.title || `${activity.type || 'Activity'}`;
  };

  const columns = [
    { 
      key: 'date_time', 
      label: 'Date', 
      sortable: true,
      width: '20',
      render: (value: string) => format(new Date(value), 'MMM dd, yyyy')
    },
    { 
      key: 'type', 
      label: 'Type', 
      sortable: true,
      width: '16',
      render: (value: string) => (
        <span className="capitalize">{value || 'Other'}</span>
      )
    },
    { 
      key: 'title', 
      label: 'Title', 
      sortable: true,
      width: '24',
      render: (value: any, row: any) => getActivityTitle(row)
    },
    { 
      key: 'notes', 
      label: 'Notes', 
      sortable: false,
      width: '32',
      render: (value: string) => {
        if (!value) return '-';
        const truncated = value.length > 100 ? value.substring(0, 100) + '...' : value;
        return (
          <div className="max-w-sm">
            <span className="text-sm text-muted-foreground" title={value}>
              {truncated}
            </span>
          </div>
        );
      }
    },
    { 
      key: 'attachment_url', 
      label: 'URL', 
      sortable: false,
      width: '20',
      render: (value: string) => {
        if (!value) return '-';
        const truncated = value.length > 40 ? value.substring(0, 40) + '...' : value;
        return (
          <button
            onClick={() => window.open(value, '_blank', 'noopener,noreferrer')}
            className="text-primary hover:text-primary/80 underline text-left max-w-full truncate"
            title={value}
          >
            {truncated}
          </button>
        );
      }
    }
  ];

  if (!groupId || groupId === ':groupId' || groupId === 'undefined' || groupId.startsWith(':')) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Invalid Group</h2>
        <p className="text-muted-foreground">Please select a valid care group.</p>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Activity Log - Care Coordination"
        description="Track and manage daily activities and care notes for your care group."
      />
      <div className="container mx-auto p-6 space-y-6">
        <UnifiedTableView
          title="Activity Log"
          data={activities}
          columns={columns}
          loading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          entityType="activity"
          canDelete={canDeleteActivity}
          getItemTitle={getActivityTitle}
          searchPlaceholder="Search activities..."
          defaultSortBy="date_time"
          emptyMessage="No activities found"
          emptyDescription="Start by adding your first activity entry."
          onCreateNew={handleCreateNew}
          createButtonLabel="Add Activity"
          customActions={(activity) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedActivityForAssociations(activity);
                setIsAssociationsModalOpen(true);
              }}
              disabled={blockOperation()}
              title="Manage associations"
              className="h-8 w-8 p-0"
            >
              <Link className="h-4 w-4" />
            </Button>
          )}
        />

        {showEditModal && selectedActivity && (
          <ActivityModal
            activity={selectedActivity}
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedActivity(null);
            }}
            groupId={groupId!}
          />
        )}

        {showCreateModal && (
          <ActivityModal
            activity={null}
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            groupId={groupId!}
          />
        )}

        {/* Associations Modal */}
        <Dialog open={isAssociationsModalOpen} onOpenChange={setIsAssociationsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Activity Associations</DialogTitle>
            </DialogHeader>
            {selectedActivityForAssociations && (
              <UnifiedAssociationManager
                entityId={selectedActivityForAssociations.id}
                entityType={ENTITY.activity_log}
                groupId={groupId!}
                onNavigate={(type: string, id: string) => {
                  const baseUrl = `/app/${groupId}`;
                  let url = '';
                  
                  switch (type) {
                    case ENTITY.contact:
                      url = `${baseUrl}/contacts`;
                      break;
                    case ENTITY.appointment:
                      url = `${baseUrl}/calendar`;
                      break;
                    case ENTITY.task:
                      url = `${baseUrl}/tasks`;
                      break;
                    case ENTITY.document:
                      url = `${baseUrl}/documents`;
                      break;
                    default:
                      return;
                  }
                  
                  window.open(url, '_blank');
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
