import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, X } from "lucide-react";
import type { BulkDeleteBarProps } from "@/lib/delete/types";
import { ENTITY_LABELS_PLURAL } from "@/lib/delete/types";

export function BulkDeleteBar({
  selectedIds,
  entityType,
  onDelete,
  onClearSelection,
  isLoading = false
}: BulkDeleteBarProps) {
  if (selectedIds.length === 0) return null;

  const entityLabel = ENTITY_LABELS_PLURAL[entityType];
  
  return (
    <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {selectedIds.length} {entityLabel} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(selectedIds)}
            disabled={isLoading}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {isLoading ? "Deleting..." : "Delete Selected"}
          </Button>
        </div>
      </div>
    </Card>
  );
}