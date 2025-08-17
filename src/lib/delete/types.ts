export type EntityType = 'contact' | 'appointment' | 'task' | 'activity' | 'document';

export interface DeleteableEntity {
  id: string;
  [key: string]: any;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export interface BulkDeleteResult {
  successful: string[];
  failed: Array<{ id: string; error: string }>;
}

export interface DeleteConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  entityType: EntityType;
  count: number;
  isLoading?: boolean;
}

export interface BulkDeleteBarProps {
  selectedIds: string[];
  entityType: EntityType;
  onDelete: (ids: string[]) => void;
  onClearSelection: () => void;
  isLoading?: boolean;
}

export const ENTITY_LABELS = {
  contact: 'contact',
  appointment: 'appointment', 
  task: 'task',
  activity: 'activity',
  document: 'document'
} as const;

export const ENTITY_LABELS_PLURAL = {
  contact: 'contacts',
  appointment: 'appointments',
  task: 'tasks', 
  activity: 'activities',
  document: 'documents'
} as const;