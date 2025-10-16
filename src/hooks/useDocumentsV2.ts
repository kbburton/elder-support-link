import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DocumentV2 {
  id: string;
  group_id: string | null;
  uploaded_by_user_id: string;
  uploaded_by_email: string | null;
  title: string | null;
  original_filename: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  category_id: string | null;
  full_text: string | null;
  summary: string | null;
  ai_metadata: any;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error: string | null;
  is_shared_with_group: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by_user_id: string | null;
  deleted_by_email: string | null;
  created_at: string;
  updated_at: string;
  document_v2_group_shares?: Array<{
    id: string;
    group_id: string;
    care_groups?: { id: string; name: string };
  }>;
}

export const useDocumentsV2 = (groupId: string | undefined, showPersonal: boolean = false) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents-v2', groupId, showPersonal],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      if (showPersonal) {
        // Personal documents: All documents uploaded by the user, with their shares
        const { data, error } = await supabase
          .from('documents_v2')
          .select(`
            *,
            document_categories(name),
            document_v2_group_shares(
              id,
              group_id,
              care_groups(id, name)
            )
          `)
          .eq('uploaded_by_user_id', user.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data as DocumentV2[];
      } else if (groupId) {
        // Care group documents: Documents shared with this specific group via junction table
        const { data, error } = await supabase
          .from('documents_v2')
          .select(`
            *,
            document_categories(name),
            document_v2_group_shares!inner(
              id,
              group_id,
              care_groups(id, name)
            )
          `)
          .eq('document_v2_group_shares.group_id', groupId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data as DocumentV2[];
      }

      return [];
    },
    enabled: !!groupId || showPersonal,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ 
      file, 
      groupId, 
      title, 
      categoryId,
      notes,
      isShared 
    }: { 
      file: File; 
      groupId: string | null; 
      title?: string;
      categoryId?: string;
      notes?: string;
      isShared?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create FormData for the new upload-and-process function
      const formData = new FormData();
      formData.append('file', file);
      formData.append('groupId', groupId || '');
      formData.append('uploadedByUserId', user.id);
      formData.append('uploadedByEmail', user.email || '');
      formData.append('title', title || file.name);
      if (categoryId) formData.append('categoryId', categoryId);
      if (notes) formData.append('notes', notes);
      formData.append('isSharedWithGroup', String(isShared !== false));

      // Call the new upload-and-process function that processes BEFORE storing
      const { data, error } = await supabase.functions.invoke('upload-and-process-document-v2', {
        body: formData
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Upload failed');

      return data.document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-v2'] });
      toast({
        title: "Success",
        description: "Document uploaded and processed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<DocumentV2> 
    }) => {
      const { data, error } = await supabase
        .from('documents_v2')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-v2'] });
      toast({
        title: "Success",
        description: "Document updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('documents_v2')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by_user_id: user.id,
          deleted_by_email: user.email
        })
        .eq('id', documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-v2'] });
      toast({
        title: "Success",
        description: "Document deleted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    documents: documents || [],
    isLoading,
    uploadDocument: uploadMutation.mutate,
    updateDocument: updateMutation.mutate,
    deleteDocument: deleteMutation.mutate,
    isUploading: uploadMutation.isPending,
  };
};
