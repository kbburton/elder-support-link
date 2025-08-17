import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle } from "lucide-react";
import type { DeleteConfirmProps } from "@/lib/delete/types";
import { ENTITY_LABELS, ENTITY_LABELS_PLURAL } from "@/lib/delete/types";

export function DeleteConfirm({
  isOpen,
  onClose,
  onConfirm,
  entityType,
  count,
  isLoading = false
}: DeleteConfirmProps) {
  const entityLabel = count === 1 ? ENTITY_LABELS[entityType] : ENTITY_LABELS_PLURAL[entityType];
  
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete {count} {entityLabel}?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">This will soft delete {count} {entityLabel}.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Items will be moved to trash and recoverable for 30 days. 
                  Administrators can purge items sooner if needed.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Deleting..." : `Delete ${entityLabel}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}