import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
}

interface CreateVersionInput {
  document_id: string;
  version_number: number;
  file_url: string;
  file_size?: number;
  file_type?: string;
  notes?: string;
}

export function useDocumentVersions(documentId: string | null) {
  return useQuery({
    queryKey: ["document-versions", documentId],
    queryFn: async () => {
      if (!documentId) return [];

      const { data, error } = await supabase
        .from("document_versions")
        .select("*")
        .eq("document_id", documentId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return data as DocumentVersion[];
    },
    enabled: !!documentId,
  });
}

export function useCreateVersion() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVersionInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("document_versions")
        .insert({
          ...input,
          created_by_user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Update the document's current version
      await supabase
        .from("documents")
        .update({ current_version: input.version_number })
        .eq("id", input.document_id);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["document-versions", variables.document_id] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Version created",
        description: "New document version has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
