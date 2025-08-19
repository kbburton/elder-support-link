import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AssociationManager } from "@/components/shared/AssociationManager";
import { Link, ExternalLink, FileText } from "lucide-react";

interface Document {
  id: string;
  title: string;
  original_filename?: string;
  category?: string;
  file_type?: string;
}

interface DocumentAssociationsModalProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

export function DocumentAssociationsModal({ document, isOpen, onClose, groupId }: DocumentAssociationsModalProps) {
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
      case 'task':
        url = `${baseUrl}/tasks`;
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

  if (!document) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Associations for "{document.title || document.original_filename || 'Untitled Document'}"
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">{document.title || document.original_filename || 'Untitled Document'}</h4>
                <p className="text-sm text-muted-foreground">
                  Type: {document.file_type || 'Unknown'} | Category: {document.category || 'Uncategorized'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/app/${groupId}/documents`, '_blank')}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Documents
              </Button>
            </div>
          </div>

          <AssociationManager
            entityId={document.id}
            entityType="document"
            groupId={groupId}
            onNavigate={handleNavigate}
            showTitle={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}