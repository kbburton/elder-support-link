import { useEffect, useRef, useCallback, useState } from 'react';
import { debounce } from '@/utils/debounce';

interface UseNoteAutoSaveParams {
  noteId: string;
  content: string;
  title: string;
  onSave: (data: { title: string; content: string }) => Promise<void>;
  enabled: boolean;
}

const LOCAL_STORAGE_PREFIX = 'note_backup_';

export const useNoteAutoSave = ({
  noteId,
  content,
  title,
  onSave,
  enabled,
}: UseNoteAutoSaveParams) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const initialContentRef = useRef({ title, content });
  const hasChangesRef = useRef(false);

  // Save to local storage
  const saveToLocalStorage = useCallback(() => {
    if (!enabled) return;
    const backup = {
      title,
      content,
      timestamp: Date.now(),
    };
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${noteId}`, JSON.stringify(backup));
  }, [noteId, title, content, enabled]);

  // Clear local storage
  const clearLocalStorage = useCallback(() => {
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${noteId}`);
  }, [noteId]);

  // Load from local storage on page reload
  useEffect(() => {
    const stored = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${noteId}`);
    if (stored) {
      try {
        const backup = JSON.parse(stored);
        // Check if backup is recent (within last hour)
        if (Date.now() - backup.timestamp < 3600000) {
          // Return the backup data to be used by parent component if needed
          console.log('Found backup for note:', noteId);
        } else {
          clearLocalStorage();
        }
      } catch (error) {
        console.error('Failed to parse backup:', error);
        clearLocalStorage();
      }
    }
  }, [noteId, clearLocalStorage]);

  // Auto-save function
  const performSave = useCallback(async () => {
    if (!enabled || !hasChangesRef.current) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave({ title, content });
      clearLocalStorage();
      hasChangesRef.current = false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save';
      setSaveError(errorMessage);
      saveToLocalStorage();
    } finally {
      setIsSaving(false);
    }
  }, [enabled, title, content, onSave, clearLocalStorage, saveToLocalStorage]);

  // Debounced save (1.5 seconds after typing stops)
  const debouncedSave = useRef(
    debounce(performSave, 1500)
  );

  // Track changes
  useEffect(() => {
    if (!enabled) return;
    
    const hasContentChanged = 
      content !== initialContentRef.current.content ||
      title !== initialContentRef.current.title;
    
    if (hasContentChanged) {
      hasChangesRef.current = true;
      debouncedSave.current();
    }
  }, [content, title, enabled]);

  // Save on blur
  const handleBlur = useCallback(() => {
    if (enabled && hasChangesRef.current) {
      performSave();
    }
  }, [enabled, performSave]);

  // Manual retry
  const retrySave = useCallback(() => {
    performSave();
  }, [performSave]);

  return {
    isSaving,
    saveError,
    handleBlur,
    retrySave,
  };
};
