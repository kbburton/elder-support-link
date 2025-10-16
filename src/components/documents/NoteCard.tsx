import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Pencil, Trash2, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { DocumentNote } from '@/hooks/useDocumentNotes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface NoteCardProps {
  note: DocumentNote;
  currentUserId: string;
  onEdit: (note: DocumentNote) => void;
  onDelete: (noteId: string) => void;
}

export const NoteCard = ({ note, currentUserId, onEdit, onDelete }: NoteCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isLocked = note.is_locked;
  const isLockedByCurrentUser = isLocked && note.locked_by_user_id === currentUserId;
  const isLockedByOther = isLocked && note.locked_by_user_id !== currentUserId;

  const handleEdit = () => {
    if (!isLockedByOther) {
      onEdit(note);
    }
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    onDelete(note.id);
    setShowDeleteDialog(false);
  };

  const creatorDisplay = note.creator?.display_name || 'Unknown User';
  const editorDisplay = note.last_editor?.display_name;

  return (
    <>
      <Card className="mb-3">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold truncate">{note.title}</h3>
                {isLocked && (
                  <Badge variant={isLockedByCurrentUser ? 'default' : 'secondary'} className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    {isLockedByCurrentUser ? 'Editing' : 'Locked'}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Created by {creatorDisplay}</div>
                <div>
                  {editorDisplay 
                    ? `Last edited by ${editorDisplay} • ${format(new Date(note.updated_at), 'MMM d, yyyy h:mm a')}`
                    : `Created ${format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}`
                  }
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                disabled={isLockedByOther}
                title={isLockedByOther ? 'This note is being edited by another user' : 'Edit note'}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isLockedByOther}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="pt-0">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {note.content || <span className="text-muted-foreground italic">No content</span>}
            </div>
          </CardContent>
        )}
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{note.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
