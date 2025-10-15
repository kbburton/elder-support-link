import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DocumentTag {
  id: string;
  name: string;
  color: string | null;
  care_group_id: string;
  created_by_user_id: string;
  created_at: string;
}

interface CreateTagInput {
  name: string;
  color?: string;
  care_group_id: string;
}

export function useDocumentTags(careGroupId: string | null) {
  return useQuery({
    queryKey: ["document-tags", careGroupId],
    queryFn: async () => {
      if (!careGroupId) return [];

      const { data, error } = await supabase
        .from("document_tags")
        .select("*")
        .eq("care_group_id", careGroupId)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as DocumentTag[];
    },
    enabled: !!careGroupId,
  });
}

export function useCreateTag() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTagInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("document_tags")
        .insert({
          ...input,
          created_by_user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["document-tags", variables.care_group_id] });
      toast({
        title: "Tag created",
        description: "Document tag has been created successfully.",
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

export function useDeleteTag() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("document_tags")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-tags"] });
      toast({
        title: "Tag deleted",
        description: "Document tag has been deleted successfully.",
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

export function useDocumentTagAssignments(documentId: string | null) {
  return useQuery({
    queryKey: ["document-tag-assignments", documentId],
    queryFn: async () => {
      if (!documentId) return [];

      const { data, error } = await supabase
        .from("document_tag_assignments")
        .select("*, document_tags(*)")
        .eq("document_id", documentId);

      if (error) throw error;
      return data;
    },
    enabled: !!documentId,
  });
}

export function useAssignTag() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, tagId }: { documentId: string; tagId: string }) => {
      const { data, error } = await supabase
        .from("document_tag_assignments")
        .insert({ document_id: documentId, tag_id: tagId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["document-tag-assignments", variables.documentId] });
      toast({
        title: "Tag assigned",
        description: "Tag has been assigned to document.",
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

export function useUnassignTag() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, tagId }: { documentId: string; tagId: string }) => {
      const { error } = await supabase
        .from("document_tag_assignments")
        .delete()
        .eq("document_id", documentId)
        .eq("tag_id", tagId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["document-tag-assignments", variables.documentId] });
      toast({
        title: "Tag removed",
        description: "Tag has been removed from document.",
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
