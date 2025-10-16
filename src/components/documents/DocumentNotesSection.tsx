import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, SortAsc } from 'lucide-react';
import { useDocumentNotes, SortBy, DocumentNote } from '@/hooks/useDocumentNotes';
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface DocumentNotesSectionProps {
  documentId: string;
  careGroupId?: string | null;
  isPersonal: boolean;
}

export const DocumentNotesSection = ({
  documentId,
  careGroupId,
  isPersonal,
}: DocumentNotesSectionProps) => {
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingNote, setEditingNote] = useState<DocumentNote | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const {
    notes,
    isLoading,
    createNote,
    updateNote,
    deleteNote,
  } = useDocumentNotes({
    documentId,
    careGroupId,
    isPersonal,
    sortBy,
    page: currentPage,
    pageSize: 10,
  });

  const handleCreateNote = async (data: { title: string; content: string }) => {
    await createNote.mutateAsync(data);
    setIsCreating(false);
  };

  const handleUpdateNote = async (data: { title: string; content: string }) => {
    if (!editingNote) return;
    await updateNote.mutateAsync({
      noteId: editingNote.id,
      ...data,
    });
    setEditingNote(null);
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteNote.mutateAsync(noteId);
  };

  const handleEdit = (note: DocumentNote) => {
    setEditingNote(note);
    setIsCreating(false);
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setIsCreating(false);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading notes...</div>;
  }

  if (isCreating || editingNote) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {isCreating ? 'Create New Note' : 'Edit Note'}
          </h3>
        </div>
        <NoteEditor
          documentId={documentId}
          note={editingNote || undefined}
          onSave={isCreating ? handleCreateNote : handleUpdateNote}
          onCancel={handleCancelEdit}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <SortAsc className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent Changes</SelectItem>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="creator">Creator/Editor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Note
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No notes yet. Create your first note to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              currentUserId={user?.id || ''}
              onEdit={handleEdit}
              onDelete={handleDeleteNote}
            />
          ))}
        </div>
      )}

      {notes.length >= 10 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={notes.length < 10}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};
