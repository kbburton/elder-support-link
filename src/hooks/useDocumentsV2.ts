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
}

export const useDocumentsV2 = (groupId: string | undefined, showPersonal: boolean = false) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents-v2', groupId, showPersonal],
    queryFn: async () => {
      let query = supabase
        .from('documents_v2')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (showPersonal) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          query = query.eq('uploaded_by_user_id', user.id);
        }
      } else if (groupId) {
        query = query.eq('group_id', groupId).eq('is_shared_with_group', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DocumentV2[];
    },
    enabled: !!groupId || showPersonal,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ 
      file, 
      groupId, 
      title, 
      categoryId,
      isShared 
    }: { 
      file: File; 
      groupId: string | null; 
      title?: string;
      categoryId?: string;
      isShared?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data: document, error: insertError } = await supabase
        .from('documents_v2')
        .insert({
          group_id: groupId,
          uploaded_by_user_id: user.id,
          uploaded_by_email: user.email,
          title: title || file.name,
          original_filename: file.name,
          file_url: filePath,
          file_size: file.size,
          mime_type: file.type,
          category_id: categoryId || null,
          is_shared_with_group: isShared !== false,
          processing_status: 'pending'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Trigger AI processing
      const { error: processError } = await supabase.functions.invoke('process-document-v2', {
        body: { documentId: document.id }
      });

      if (processError) {
        console.error('Processing error:', processError);
        toast({
          title: "Processing Started",
          description: "Document uploaded but AI processing encountered an issue. You can retry later.",
          variant: "destructive"
        });
      }

      return document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-v2'] });
      toast({
        title: "Success",
        description: "Document uploaded and processing started",
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
