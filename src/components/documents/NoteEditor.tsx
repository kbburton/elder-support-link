import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, X, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DocumentNote } from '@/hooks/useDocumentNotes';
import { useNoteLock } from '@/hooks/useNoteLock';
import { useNoteAutoSave } from '@/hooks/useNoteAutoSave';

interface NoteEditorProps {
  documentId: string;
  note?: DocumentNote;
  onSave: (data: { title: string; content: string }) => Promise<void>;
  onCancel: () => void;
}

export const NoteEditor = ({ documentId, note, onSave, onCancel }: NoteEditorProps) => {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [isSavingManually, setIsSavingManually] = useState(false);

  const { acquireLock, releaseLock } = useNoteLock(documentId);

  // Acquire lock when editing existing note
  useEffect(() => {
    if (note?.id) {
      acquireLock.mutate(note.id);
      
      return () => {
        releaseLock.mutate(note.id);
      };
    }
  }, [note?.id]);

  const handleSave = async (data: { title: string; content: string }) => {
    await onSave(data);
  };

  const { isSaving, saveError, handleBlur, retrySave } = useNoteAutoSave({
    noteId: note?.id || 'new',
    content,
    title,
    onSave: handleSave,
    enabled: !!note?.id,
  });

  const handleManualSave = async () => {
    if (!title.trim()) {
      return;
    }

    setIsSavingManually(true);
    try {
      await onSave({ title, content });
      onCancel();
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSavingManually(false);
    }
  };

  const handleCancel = () => {
    if (note?.id) {
      releaseLock.mutate(note.id);
    }
    onCancel();
  };

  return (
    <div className="space-y-4">
      {saveError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{saveError}</span>
            <Button variant="outline" size="sm" onClick={retrySave}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="note-title">Title *</Label>
        <Input
          id="note-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter note title..."
          onBlur={handleBlur}
          disabled={acquireLock.isPending}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="note-content">Content (Markdown supported)</Label>
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </div>
          )}
        </div>
        <Textarea
          id="note-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter your note content here..."
          rows={10}
          className="font-mono text-sm"
          onBlur={handleBlur}
          disabled={acquireLock.isPending}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleCancel} disabled={isSavingManually}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={handleManualSave} disabled={!title.trim() || isSavingManually}>
          {isSavingManually ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {note ? 'Save' : 'Create Note'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
