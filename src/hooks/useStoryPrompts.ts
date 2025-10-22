import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StoryPrompt {
  id: string;
  title: string;
  prompt_text: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const useStoryPrompts = () => {
  return useQuery({
    queryKey: ['story-prompts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('story_generation_prompts')
        .select('*')
        .order('is_default', { ascending: false })
        .order('title');
      
      if (error) throw error;
      return data as StoryPrompt[];
    }
  });
};

export const useDefaultPrompt = () => {
  return useQuery({
    queryKey: ['story-prompts', 'default'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('story_generation_prompts')
        .select('*')
        .eq('is_default', true)
        .single();
      
      if (error) throw error;
      return data as StoryPrompt;
    }
  });
};

export const useCreatePrompt = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (prompt: Omit<StoryPrompt, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('story_generation_prompts')
        .insert(prompt)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-prompts'] });
      toast.success('Story prompt created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create prompt: ' + error.message);
    }
  });
};

export const useUpdatePrompt = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StoryPrompt> & { id: string }) => {
      const { data, error } = await supabase
        .from('story_generation_prompts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-prompts'] });
      toast.success('Story prompt updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update prompt: ' + error.message);
    }
  });
};

export const useDeletePrompt = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (promptId: string) => {
      const { error } = await supabase
        .from('story_generation_prompts')
        .delete()
        .eq('id', promptId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-prompts'] });
      toast.success('Story prompt deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete prompt: ' + error.message);
    }
  });
};