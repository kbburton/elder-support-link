import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import SEO from "@/components/layout/SEO";
import { UnifiedTableView } from "@/components/shared/UnifiedTableView";
import ActivityLogForm from "@/components/activity-log/ActivityLogForm";
import { useToast } from "@/hooks/use-toast";
import { useDemoOperations } from "@/hooks/useDemoOperations";
import { softDeleteEntity } from "@/lib/delete/rpc";
import { format } from "date-fns";

export default function ActivityListPage() {
  const { groupId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const { blockOperation } = useDemoOperations();

  const { data: activities = [], isLoading } = useQuery({
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
    enabled: !!groupId && groupId !== ':groupId' && groupId !== 'undefined' && !groupId.startsWith(':'),
  });

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
    return activity.title || `${activity.type} Activity`;
  };

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'medical': return 'bg-red-100 text-red-800';
      case 'personal': return 'bg-blue-100 text-blue-800';
      case 'communication': return 'bg-green-100 text-green-800';
      case 'appointment': return 'bg-purple-100 text-purple-800';
      case 'medication': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const columns = [
    { 
      key: 'title', 
      label: 'Title', 
      sortable: true,
      width: '48',
      render: (value: any, row: any) => getActivityTitle(row)
    },
    { 
      key: 'type', 
      label: 'Type', 
      sortable: true,
      type: 'badge' as const,
      getBadgeVariant: (value: string) => 'secondary',
      width: '24',
      render: (value: any) => (
        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(value)}`}>
          {value || 'Unknown'}
        </div>
      )
    },
    { 
      key: 'date_time', 
      label: 'Date/Time', 
      sortable: true,
      type: 'datetime' as const,
      width: '32'
    },
    { 
      key: 'created_by_email', 
      label: 'Created By', 
      sortable: true,
      width: '32'
    },
    { 
      key: 'notes', 
      label: 'Notes', 
      sortable: false,
      width: '64',
      render: (value: string) => {
        if (!value) return '-';
        return (
          <div className="max-w-md">
            <div className="line-clamp-2 text-sm text-muted-foreground">
              {value}
            </div>
          </div>
        );
      }
    },
    { 
      key: 'associations', 
      label: 'Related Items', 
      type: 'associations' as const,
      width: '48',
      getAssociations: (row: any) => {
        // This would be populated with actual association data
        return [];
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
          onCreateNew={() => setShowForm(true)}
          createButtonLabel="Add Activity"
        />

        {showForm && (
          <ActivityLogForm
            onSave={() => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ["activities"] });
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {showEditModal && selectedActivity && (
          <ActivityEditModal
            activity={selectedActivity}
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedActivity(null);
            }}
            onSave={() => {
              queryClient.invalidateQueries({ queryKey: ["activities"] });
              setShowEditModal(false);
              setSelectedActivity(null);
            }}
          />
        )}
      </div>
    </>
  );
}

// Simple Activity Edit Modal
function ActivityEditModal({ activity, isOpen, onClose, onSave }: {
  activity: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(activity.title || '');
  const [type, setType] = useState(activity.type || '');
  const [notes, setNotes] = useState(activity.notes || '');
  const [dateTime, setDateTime] = useState(
    activity.date_time ? format(new Date(activity.date_time), "yyyy-MM-dd'T'HH:mm") : ''
  );

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('activity_logs')
        .update({ 
          title, 
          type, 
          notes,
          date_time: new Date(dateTime).toISOString()
        })
        .eq('id', activity.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Activity updated successfully." });
      onSave();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background border rounded-xl shadow-xl p-6 w-[600px] max-w-[90vw]">
        <h3 className="text-lg font-semibold mb-4">Edit Activity</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Date & Time *</label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            >
              <option value="">Select type</option>
              <option value="Medical">Medical</option>
              <option value="Personal">Personal</option>
              <option value="Communication">Communication</option>
              <option value="Appointment">Appointment</option>
              <option value="Medication">Medication</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border rounded-md"
              placeholder="Activity title"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border rounded-md h-24"
              placeholder="Additional notes..."
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !title || !type || !dateTime}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}