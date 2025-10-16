import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type SortBy = 'recent' | 'title' | 'creator';

export interface DocumentNote {
  id: string;
  document_id: string;
  title: string;
  content: string;
  care_group_id: string | null;
  owner_user_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  last_edited_by_user_id: string | null;
  is_locked: boolean;
  locked_by_user_id: string | null;
  locked_at: string | null;
  creator?: {
    display_name: string | null;
    user_id: string;
  };
  last_editor?: {
    display_name: string | null;
    user_id: string;
  };
}

interface UseDocumentNotesParams {
  documentId: string;
  careGroupId?: string | null;
  isPersonal: boolean;
  sortBy?: SortBy;
  page?: number;
  pageSize?: number;
}

export const useDocumentNotes = ({
  documentId,
  careGroupId,
  isPersonal,
  sortBy = 'recent',
  page = 1,
  pageSize = 10,
}: UseDocumentNotesParams) => {
  const queryClient = useQueryClient();

  // Fetch notes with pagination
  const { data, isLoading, error } = useQuery({
    queryKey: ['document-notes', documentId, isPersonal, sortBy, page],
    queryFn: async () => {
      // Release stale locks before fetching
      await supabase.rpc('release_stale_note_locks');

      let query = supabase
        .from('document_notes')
        .select('*')
        .eq('document_id', documentId);

      if (isPersonal) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        query = query.eq('owner_user_id', user.id);
      } else if (careGroupId) {
        query = query.eq('care_group_id', careGroupId);
      }

      // Apply sorting
      if (sortBy === 'recent') {
        query = query.order('updated_at', { ascending: false });
      } else if (sortBy === 'title') {
        query = query.order('title', { ascending: true });
      } else if (sortBy === 'creator') {
        query = query.order('created_by_user_id', { ascending: true });
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: notes, error } = await query;
      if (error) throw error;

      // Fetch user profiles for creators and editors
      const userIds = new Set<string>();
      notes?.forEach((note) => {
        userIds.add(note.created_by_user_id);
        if (note.last_edited_by_user_id) {
          userIds.add(note.last_edited_by_user_id);
        }
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', Array.from(userIds));

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      // Enrich notes with user information
      const enrichedNotes: DocumentNote[] = notes?.map((note) => {
        const creator = profileMap.get(note.created_by_user_id);
        const lastEditor = note.last_edited_by_user_id 
          ? profileMap.get(note.last_edited_by_user_id)
          : null;

        const getDisplayName = (profile: any) => {
          if (!profile) return null;
          const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
          return fullName || null;
        };

        return {
          ...note,
          creator: creator ? {
            user_id: creator.user_id,
            display_name: getDisplayName(creator),
          } : undefined,
          last_editor: lastEditor ? {
            user_id: lastEditor.user_id,
            display_name: getDisplayName(lastEditor),
          } : undefined,
        };
      }) || [];

      return enrichedNotes;
    },
    enabled: !!documentId && (isPersonal || !!careGroupId),
  });

  // Create note
  const createNote = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const noteData = {
        document_id: documentId,
        title,
        content,
        created_by_user_id: user.id,
        ...(isPersonal 
          ? { owner_user_id: user.id, care_group_id: null }
          : { care_group_id: careGroupId, owner_user_id: null }
        ),
      };

      const { data, error } = await supabase
        .from('document_notes')
        .insert(noteData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-notes', documentId] });
      toast({
        title: 'Note created',
        description: 'Your note has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create note',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update note
  const updateNote = useMutation({
    mutationFn: async ({ 
      noteId, 
      title, 
      content 
    }: { 
      noteId: string; 
      title: string; 
      content: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('document_notes')
        .update({
          title,
          content,
          last_edited_by_user_id: user.id,
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
        title: 'Failed to update note',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete note
  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('document_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-notes', documentId] });
      toast({
        title: 'Note deleted',
        description: 'Your note has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete note',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    notes: data || [],
    isLoading,
    error,
    createNote,
    updateNote,
    deleteNote,
  };
};
