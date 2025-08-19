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

export function EnhancedDeleteConfirm({
  isOpen,
  onClose,
  onConfirm,
  entityType,
  count,
  isLoading = false
}: DeleteConfirmProps) {
  const entityLabel = count === 1 ? ENTITY_LABELS[entityType] : ENTITY_LABELS_PLURAL[entityType];
  const countText = count === 1 ? "1 item" : `${count} items`;
  
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-lg">
            <Trash2 className="h-5 w-5 text-destructive" />
            Confirm Deletion
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 text-left">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="font-medium text-foreground">
                  Are you sure you want to delete {countText}?
                </p>
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">
                    • {count === 1 ? "This item" : "These items"} will be moved to trash
                  </p>
                  <p className="text-muted-foreground">
                    • Recoverable for 30 days by administrators
                  </p>
                  <p className="text-muted-foreground">
                    • This action cannot be undone by regular users
                  </p>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isLoading} className="px-6">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 px-6"
          >
            {isLoading ? "Deleting..." : `Delete ${countText}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}