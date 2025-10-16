import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DocumentGroupShare {
  id: string;
  document_id: string;
  group_id: string;
  shared_by_user_id: string;
  created_at: string;
  care_groups?: {
    id: string;
    name: string;
  };
}

/**
 * Hook to fetch group shares for a specific document
 */
export const useDocumentGroupShares = (documentId: string | null) => {
  return useQuery({
    queryKey: ['document-group-shares', documentId],
    queryFn: async () => {
      if (!documentId) return [];

      const { data, error } = await supabase
        .from('document_v2_group_shares')
        .select('*, care_groups(id, name)')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DocumentGroupShare[];
    },
    enabled: !!documentId,
  });
};

/**
 * Hook to fetch user's care groups (for sharing dropdown)
 */
export const useUserCareGroups = () => {
  return useQuery({
    queryKey: ['user-care-groups'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('care_group_members')
        .select('group_id, care_groups(id, name)')
        .eq('user_id', user.id);

      if (error) throw error;
      return data.map(item => item.care_groups).filter(Boolean);
    },
  });
};

/**
 * Hook to share a document with a care group
 */
export const useShareDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      documentId, 
      groupId 
    }: { 
      documentId: string; 
      groupId: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('document_v2_group_shares')
        .insert({
          document_id: documentId,
          group_id: groupId,
          shared_by_user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-group-shares'] });
      queryClient.invalidateQueries({ queryKey: ['documents-v2'] });
      toast({
        title: "Document shared",
        description: "Document has been shared with the care group.",
      });
    },
    onError: (error: any) => {
      const message = error.message?.includes('duplicate') 
        ? "Document is already shared with this care group"
        : "Failed to share document";
      
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });
};

/**
 * Hook to unshare a document from a care group
 */
export const useUnshareDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from('document_v2_group_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-group-shares'] });
      queryClient.invalidateQueries({ queryKey: ['documents-v2'] });
      toast({
        title: "Document unshared",
        description: "Document has been removed from the care group.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to unshare document.",
        variant: "destructive",
      });
    },
  });
};
