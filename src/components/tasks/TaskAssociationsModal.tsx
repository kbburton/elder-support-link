import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AssociationManager } from "@/components/shared/AssociationManager";
import { Link, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "Open" | "InProgress" | "Completed";
  priority?: "High" | "Medium" | "Low";
  category?: string;
  due_date?: string;
}

interface TaskAssociationsModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

export function TaskAssociationsModal({ task, isOpen, onClose, groupId }: TaskAssociationsModalProps) {
  const handleNavigate = (type: string, id: string) => {
    // Navigate to the related item
    const baseUrl = `/app/${groupId}`;
    let url = '';
    
    switch (type) {
      case 'contact':
        url = `${baseUrl}/contacts`;
        break;
      case 'appointment':
        url = `${baseUrl}/calendar`;
        break;
      case 'document':
        url = `${baseUrl}/documents`;
        break;
      case 'activity':
        url = `${baseUrl}/activities`;
        break;
      default:
        return;
    }
    
    // Open in new tab to preserve the current modal state
    window.open(url, '_blank');
  };

  if (!task) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Associations for "{task.title}"
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">{task.title}</h4>
                <p className="text-sm text-muted-foreground">
                  Status: {task.status} | Priority: {task.priority}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/app/${groupId}/tasks`, '_blank')}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Task
              </Button>
            </div>
          </div>

          <AssociationManager
            entityId={task.id}
            entityType="task"
            groupId={groupId}
            onNavigate={handleNavigate}
            showTitle={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}