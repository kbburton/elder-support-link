import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDeletion } from "@/hooks/useDeletion";
import { useToast } from "@/hooks/use-toast";
import type { EntityType } from "@/lib/delete/types";

export interface DeletedItem {
  id: string;
  type: EntityType;
  title: string;
  deleted_at: string;
  deleted_by_email: string;
  deleted_by_user_id: string;
}

export function useRecentlyDeleted(groupId: string | undefined) {
  const { restore } = useDeletion();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deletedItems = [], isLoading, error } = useQuery({
    queryKey: ["recently-deleted", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      if (!groupId) return [];

      const items: DeletedItem[] = [];

      // Fetch deleted appointments
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, description, deleted_at, deleted_by_email, deleted_by_user_id")
        .eq("group_id", groupId)
        .eq("is_deleted", true)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(50);

      appointments?.forEach(item => {
        items.push({
          id: item.id,
          type: "appointment",
          title: item.description || "Untitled Appointment",
          deleted_at: item.deleted_at!,
          deleted_by_email: item.deleted_by_email!,
          deleted_by_user_id: item.deleted_by_user_id!,
        });
      });

      // Fetch deleted tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, deleted_at, deleted_by_email, deleted_by_user_id")
        .eq("group_id", groupId)
        .eq("is_deleted", true)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(50);

      tasks?.forEach(item => {
        items.push({
          id: item.id,
          type: "task",
          title: item.title || "Untitled Task",
          deleted_at: item.deleted_at!,
          deleted_by_email: item.deleted_by_email!,
          deleted_by_user_id: item.deleted_by_user_id!,
        });
      });

      // Fetch deleted contacts
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, organization_name, deleted_at, deleted_by_email, deleted_by_user_id")
        .eq("care_group_id", groupId)
        .eq("is_deleted", true)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(50);

      contacts?.forEach(item => {
        const name = [item.first_name, item.last_name].filter(Boolean).join(" ") || item.organization_name || "Unnamed Contact";
        items.push({
          id: item.id,
          type: "contact",
          title: name,
          deleted_at: item.deleted_at!,
          deleted_by_email: item.deleted_by_email!,
          deleted_by_user_id: item.deleted_by_user_id!,
        });
      });

      // Fetch deleted documents
      const { data: documents } = await supabase
        .from("documents")
        .select("id, title, original_filename, deleted_at, deleted_by_email, deleted_by_user_id")
        .eq("group_id", groupId)
        .eq("is_deleted", true)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(50);

      documents?.forEach(item => {
        items.push({
          id: item.id,
          type: "document",
          title: item.title || item.original_filename || "Untitled Document",
          deleted_at: item.deleted_at!,
          deleted_by_email: item.deleted_by_email!,
          deleted_by_user_id: item.deleted_by_user_id!,
        });
      });

      // Fetch deleted activities
      const { data: activities } = await supabase
        .from("activity_logs")
        .select("id, title, type, deleted_at, deleted_by_email, deleted_by_user_id")
        .eq("group_id", groupId)
        .eq("is_deleted", true)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(50);

      activities?.forEach(item => {
        items.push({
          id: item.id,
          type: "activity",
          title: item.title || item.type || "Untitled Activity",
          deleted_at: item.deleted_at!,
          deleted_by_email: item.deleted_by_email!,
          deleted_by_user_id: item.deleted_by_user_id!,
        });
      });

      // Sort all items by deletion date (most recent first)
      return items.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
    }
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: EntityType }) => {
      await restore([id], type);
    },
    onSuccess: (_, { type }) => {
      toast({
        title: "Item restored",
        description: `The ${type} has been restored successfully.`,
      });
      
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["recently-deleted", groupId] });
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments", groupId] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks", groupId] });
      
      // Invalidate other relevant queries based on type
      if (type === "contact") {
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
      } else if (type === "document") {
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      } else if (type === "activity") {
        queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      }
    },
    onError: (error) => {
      toast({
        title: "Restore failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    deletedItems,
    isLoading,
    error,
    restoreItem: restoreMutation.mutate,
    isRestoring: restoreMutation.isPending,
  };
}