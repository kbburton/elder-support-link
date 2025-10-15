import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DocumentCategory {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  care_group_id: string | null;
  is_default: boolean;
  display_order: number;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

interface CreateCategoryInput {
  name: string;
  description?: string;
  parent_id?: string;
  care_group_id: string;
  display_order?: number;
}

export function useDocumentCategories(careGroupId: string | null) {
  return useQuery({
    queryKey: ["document-categories", careGroupId],
    queryFn: async () => {
      let query = supabase
        .from("document_categories")
        .select("*")
        .order("display_order", { ascending: true });

      if (careGroupId) {
        query = query.or(`care_group_id.eq.${careGroupId},care_group_id.is.null`);
      } else {
        query = query.is("care_group_id", null);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DocumentCategory[];
    },
    enabled: careGroupId !== undefined,
  });
}

export function useCreateCategory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("document_categories")
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
      queryClient.invalidateQueries({ queryKey: ["document-categories", variables.care_group_id] });
      toast({
        title: "Category created",
        description: "Document category has been created successfully.",
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

export function useUpdateCategory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateCategoryInput> }) => {
      const { data, error } = await supabase
        .from("document_categories")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["document-categories"] });
      toast({
        title: "Category updated",
        description: "Document category has been updated successfully.",
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

export function useDeleteCategory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("document_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-categories"] });
      toast({
        title: "Category deleted",
        description: "Document category has been deleted successfully.",
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
