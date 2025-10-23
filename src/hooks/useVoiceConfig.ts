import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VoiceConfig {
  id: string;
  care_group_id: string;
  vad_threshold: number;
  vad_silence_duration_ms: number;
  vad_prefix_padding_ms: number;
  temperature: number;
  response_style_instructions: string;
  created_at: string;
  updated_at: string;
  last_modified_by_user_id: string | null;
}

export function useVoiceConfig(careGroupId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch voice config
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['voice-config', careGroupId],
    queryFn: async () => {
      if (!careGroupId) return null;
      
      try {
        const { data, error } = await supabase
          .from('voice_interview_config' as any)
          .select('*')
          .eq('care_group_id', careGroupId)
          .single();
        
        if (error) throw error;
        return data ? (data as any) as VoiceConfig : null;
      } catch (err) {
        console.error('Error fetching voice config:', err);
        return null;
      }
    },
    enabled: !!careGroupId
  });

  // Update voice config mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<VoiceConfig>) => {
      if (!careGroupId) throw new Error('No care group ID');
      
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('voice_interview_config' as any)
        .update({
          ...updates,
          last_modified_by_user_id: user.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('care_group_id', careGroupId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-config', careGroupId] });
      toast({
        title: "Settings saved",
        description: "Voice interview configuration updated successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving settings",
        description: error.message || "Something went wrong",
        variant: "destructive"
      });
    }
  });

  // Reset to defaults mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!careGroupId) throw new Error('No care group ID');
      
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('voice_interview_config' as any)
        .update({
          vad_threshold: 0.5,
          vad_silence_duration_ms: 2500,
          vad_prefix_padding_ms: 500,
          temperature: 0.7,
          response_style_instructions: 'Keep your responses brief - maximum 1-2 sentences. Ask one focused follow-up question at a time. Wait patiently for the person to finish their thoughts.',
          last_modified_by_user_id: user.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('care_group_id', careGroupId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-config', careGroupId] });
      toast({
        title: "Reset to defaults",
        description: "Voice interview settings have been reset to recommended values"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error resetting settings",
        description: error.message || "Something went wrong",
        variant: "destructive"
      });
    }
  });

  return {
    config,
    isLoading,
    error,
    updateConfig: updateMutation.mutate,
    resetToDefaults: resetMutation.mutate,
    isUpdating: updateMutation.isPending,
    isResetting: resetMutation.isPending
  };
}
