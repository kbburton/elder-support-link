import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useNoteLock = (documentId: string) => {
  const queryClient = useQueryClient();

  const acquireLock = useMutation({
    mutationFn: async (noteId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if note is already locked
      const { data: note, error: fetchError } = await supabase
        .from('document_notes')
        .select('is_locked, locked_by_user_id')
        .eq('id', noteId)
        .single();

      if (fetchError) throw fetchError;

      if (note.is_locked && note.locked_by_user_id !== user.id) {
        throw new Error('This note is currently being edited by another user.');
      }

      // Acquire lock
      const { data, error } = await supabase
        .from('document_notes')
        .update({
          is_locked: true,
          locked_by_user_id: user.id,
          locked_at: new Date().toISOString(),
        })
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-notes', documentId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Cannot edit note',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const releaseLock = useMutation({
    mutationFn: async (noteId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('document_notes')
        .update({
          is_locked: false,
          locked_by_user_id: null,
          locked_at: null,
        })
        .eq('id', noteId)
        .eq('locked_by_user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-notes', documentId] });
    },
    onError: (error: Error) => {
      console.error('Failed to release lock:', error);
    },
  });

  return {
    acquireLock,
    releaseLock,
  };
};
