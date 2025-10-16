import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type EntityType = 'document' | 'task' | 'appointment' | 'contact' | 'activity_log';

interface Association {
  id: string;
  entity_1_id: string;
  entity_1_type: EntityType;
  entity_2_id: string;
  entity_2_type: EntityType;
  group_id: string;
  created_at: string;
}

interface AssociatedItem {
  id: string;
  type: EntityType;
  title: string;
}

/**
 * Hook to fetch associations for a specific entity within a group
 * Uses the new entity_associations table
 */
export function useAssociationsV2(entityId: string, entityType: EntityType, groupId: string) {
  return useQuery({
    queryKey: ["associations-v2", entityId, entityType, groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entity_associations")
        .select("*")
        .eq("group_id", groupId)
        .or(`and(entity_1_id.eq.${entityId},entity_1_type.eq.${entityType}),and(entity_2_id.eq.${entityId},entity_2_type.eq.${entityType})`);

      if (error) throw error;

      // Get associated entity details
      const associations = data as Association[];
      const associatedItems: AssociatedItem[] = [];

      for (const assoc of associations) {
        // Determine which entity is the "other" one
        const isEntity1 = assoc.entity_1_id === entityId && assoc.entity_1_type === entityType;
        const otherId = isEntity1 ? assoc.entity_2_id : assoc.entity_1_id;
        const otherType = isEntity1 ? assoc.entity_2_type : assoc.entity_1_type;

        // Fetch the associated entity details
        let title = "Unknown";
        
        try {
          if (otherType === 'document') {
            const { data: doc } = await supabase
              .from('documents_v2')
              .select('title, original_filename')
              .eq('id', otherId)
              .single();
            title = doc?.title || doc?.original_filename || 'Untitled Document';
          } else if (otherType === 'task') {
            const { data: task } = await supabase
              .from('tasks')
              .select('title')
              .eq('id', otherId)
              .eq('is_deleted', false)
              .single();
            title = task?.title || 'Untitled Task';
          } else if (otherType === 'appointment') {
            const { data: appt } = await supabase
              .from('appointments')
              .select('description, category')
              .eq('id', otherId)
              .eq('is_deleted', false)
              .single();
            title = appt?.description || appt?.category || 'Untitled Appointment';
          } else if (otherType === 'contact') {
            const { data: contact } = await supabase
              .from('contacts')
              .select('first_name, last_name, organization_name')
              .eq('id', otherId)
              .eq('is_deleted', false)
              .single();
            const fullName = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ');
            title = fullName || contact?.organization_name || 'Unknown Contact';
          } else if (otherType === 'activity_log') {
            const { data: activity } = await supabase
              .from('activity_logs')
              .select('title, type')
              .eq('id', otherId)
              .eq('is_deleted', false)
              .single();
            title = activity?.title || `${activity?.type} Activity` || 'Untitled Activity';
          }
        } catch (err) {
          console.error(`Error fetching ${otherType} details:`, err);
        }

        associatedItems.push({
          id: otherId,
          type: otherType,
          title
        });
      }

      return associatedItems;
    },
    enabled: !!entityId && !!entityType && !!groupId,
  });
}

/**
 * Hook to fetch available items to associate with (filtered by group and type)
 */
export function useAvailableItemsV2(
  selectedType: EntityType | null,
  groupId: string,
  currentEntityId: string,
  currentEntityType: EntityType
) {
  return useQuery({
    queryKey: ["available-items-v2", selectedType, groupId, currentEntityId],
    queryFn: async () => {
      if (!selectedType) return [];

      let data: any[] = [];

      if (selectedType === 'document') {
        const { data: docs, error } = await supabase
          .from('documents_v2')
          .select(`
            id,
            title,
            original_filename,
            document_v2_group_shares!inner(group_id)
          `)
          .eq('document_v2_group_shares.group_id', groupId)
          .eq('is_deleted', false);
        
        if (error) throw error;
        data = docs?.map(d => ({
          id: d.id,
          type: 'document' as EntityType,
          title: d.title || d.original_filename || 'Untitled Document'
        })) || [];
      } else if (selectedType === 'task') {
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('id, title')
          .eq('group_id', groupId)
          .eq('is_deleted', false);
        
        if (error) throw error;
        data = tasks?.map(t => ({
          id: t.id,
          type: 'task' as EntityType,
          title: t.title || 'Untitled Task'
        })) || [];
      } else if (selectedType === 'appointment') {
        const { data: appts, error } = await supabase
          .from('appointments')
          .select('id, description, category')
          .eq('group_id', groupId)
          .eq('is_deleted', false);
        
        if (error) throw error;
        data = appts?.map(a => ({
          id: a.id,
          type: 'appointment' as EntityType,
          title: a.description || a.category || 'Untitled Appointment'
        })) || [];
      } else if (selectedType === 'contact') {
        const { data: contacts, error } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, organization_name')
          .eq('care_group_id', groupId)
          .eq('is_deleted', false);
        
        if (error) throw error;
        data = contacts?.map(c => {
          const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ');
          return {
            id: c.id,
            type: 'contact' as EntityType,
            title: fullName || c.organization_name || 'Unknown Contact'
          };
        }) || [];
      } else if (selectedType === 'activity_log') {
        const { data: activities, error } = await supabase
          .from('activity_logs')
          .select('id, title, type')
          .eq('group_id', groupId)
          .eq('is_deleted', false);
        
        if (error) throw error;
        data = activities?.map(a => ({
          id: a.id,
          type: 'activity_log' as EntityType,
          title: a.title || `${a.type} Activity` || 'Untitled Activity'
        })) || [];
      }

      // Filter out the current entity itself
      return data.filter(item => !(item.id === currentEntityId && item.type === currentEntityType));
    },
    enabled: !!selectedType && !!groupId,
  });
}

/**
 * Hook to create a new association
 */
export function useCreateAssociationV2(entityId: string, entityType: EntityType, groupId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetId, targetType }: { targetId: string; targetType: EntityType }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("entity_associations")
        .insert({
          entity_1_id: entityId,
          entity_1_type: entityType,
          entity_2_id: targetId,
          entity_2_type: targetType,
          group_id: groupId,
          created_by_user_id: user.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["associations-v2", entityId, entityType, groupId] });
      toast({
        title: "Association created",
        description: "The items have been linked successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Error creating association:", error);
      toast({
        title: "Failed to create association",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to remove an association
 */
export function useRemoveAssociationV2(entityId: string, entityType: EntityType, groupId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetId, targetType }: { targetId: string; targetType: EntityType }) => {
      // Find the association record (could be in either direction)
      const { data: associations, error: fetchError } = await supabase
        .from("entity_associations")
        .select("id")
        .eq("group_id", groupId)
        .or(`and(entity_1_id.eq.${entityId},entity_1_type.eq.${entityType},entity_2_id.eq.${targetId},entity_2_type.eq.${targetType}),and(entity_1_id.eq.${targetId},entity_1_type.eq.${targetType},entity_2_id.eq.${entityId},entity_2_type.eq.${entityType})`);

      if (fetchError) throw fetchError;
      if (!associations || associations.length === 0) {
        throw new Error("Association not found");
      }

      const { error: deleteError } = await supabase
        .from("entity_associations")
        .delete()
        .eq("id", associations[0].id);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["associations-v2", entityId, entityType, groupId] });
      toast({
        title: "Association removed",
        description: "The link has been removed successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Error removing association:", error);
      toast({
        title: "Failed to remove association",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });
}
