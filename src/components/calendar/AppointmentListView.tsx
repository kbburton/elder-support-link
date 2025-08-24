import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedTableView, TableColumn } from "@/components/shared/UnifiedTableView";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { softDeleteEntity } from "@/lib/delete/rpc";
import { useToast } from "@/hooks/use-toast";
import { Link } from "lucide-react";
import { AppointmentAssociationsModal } from "../appointments/AppointmentAssociationsModal";

interface AppointmentListViewProps {
  groupId: string;
  onEdit: (appointment: any) => void;
}

export function AppointmentListView({ groupId, onEdit }: AppointmentListViewProps) {
  const { toast } = useToast();
  const [selectedAppointmentForAssociations, setSelectedAppointmentForAssociations] = useState<any>(null);
  const [isAssociationsModalOpen, setIsAssociationsModalOpen] = useState(false);

  const { data: appointments = [], refetch, isLoading } = useQuery({
    queryKey: ["appointments-list", groupId],
    enabled: !!groupId && groupId !== ':groupId' && groupId !== 'undefined',
    queryFn: async () => {
      if (!groupId || groupId === ':groupId' || groupId === 'undefined') {
        throw new Error('Invalid group ID');
      }
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .order("date_time", { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const handleDelete = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const result = await softDeleteEntity('appointment', id, user.id, user.email!);
      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }
      
      toast({
        title: "Appointment deleted",
        description: "The appointment has been deleted and can be restored from group settings within 30 days.",
      });
      
      await refetch();
    } catch (error) {
      console.error('Delete failed:', error);
      toast({
        title: "Error",
        description: "Failed to delete appointment.",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const results = await Promise.allSettled(
        ids.map(id => softDeleteEntity('appointment', id, user.id, user.email!))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (successful > 0) {
        toast({
          title: `${successful} appointment${successful > 1 ? 's' : ''} deleted`,
          description: "Items have been deleted and can be restored from group settings within 30 days.",
        });
      }
      
      if (failed > 0) {
        toast({
          title: "Some deletions failed",
          description: `${failed} appointment${failed > 1 ? 's' : ''} could not be deleted.`,
          variant: "destructive",
        });
      }
      
      await refetch();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      toast({
        title: "Error",
        description: "Failed to delete appointments.",
        variant: "destructive",
      });
    }
  };

  const columns: TableColumn[] = [
    {
      key: "description",
      label: "Description",
      sortable: true,
      filterable: true,
      type: "text"
    },
    {
      key: "date_time",
      label: "Date & Time", 
      sortable: true,
      type: "datetime"
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      filterable: true,
      type: "badge",
      getBadgeVariant: (value) => value ? "secondary" : "outline"
    },
    {
      key: "street_address",
      label: "Address",
      sortable: true,
      filterable: true,
      type: "text",
      render: (row) => {
        if (!row) return '';
        const addressParts = [
          row.street_address,
          row.city,
          row.state,
          row.zip_code
        ].filter(Boolean);
        return addressParts.length > 0 ? addressParts.join(', ') : '';
      }
    },
    {
      key: "duration_minutes",
      label: "Duration",
      sortable: true,
      type: "text",
      render: (value) => value ? `${value} min` : "-"
    }
  ];

  return (
    <>
      <UnifiedTableView
        title="Full List of Appointments"
        data={appointments}
        columns={columns}
        loading={isLoading}
        onEdit={onEdit}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        customActions={(row) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAppointmentForAssociations(row);
              setIsAssociationsModalOpen(true);
            }}
            className="h-8 w-8 p-0"
          >
            <Link className="h-4 w-4" />
          </Button>
        )}
        searchable={true}
        searchPlaceholder="Search appointments..."
        defaultSortBy="date_time"
        defaultSortOrder="desc"
        entityType="appointment"
        emptyMessage="No appointments found"
        emptyDescription="Create your first appointment to get started."
      />

      <AppointmentAssociationsModal
        appointment={selectedAppointmentForAssociations}
        isOpen={isAssociationsModalOpen}
        onClose={() => {
          setIsAssociationsModalOpen(false);
          setSelectedAppointmentForAssociations(null);
        }}
        groupId={groupId}
      />
    </>
  );
}