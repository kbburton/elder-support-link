import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UnifiedAssociationManager } from "@/components/shared/UnifiedAssociationManager";
import { ENTITY } from "@/constants/entities";
import { Link, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface Appointment {
  id: string;
  description: string;
  date_time: string;
  category?: string;
  location?: string;
  duration_minutes?: number;
}

interface AppointmentAssociationsModalProps {
  appointment: Appointment | null;
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

export function AppointmentAssociationsModal({ appointment, isOpen, onClose, groupId }: AppointmentAssociationsModalProps) {
  const handleNavigate = (type: string, id: string) => {
    // Navigate to the related item
    const baseUrl = `/app/${groupId}`;
    let url = '';
    
    switch (type) {
      case 'contact':
        url = `${baseUrl}/contacts`;
        break;
      case 'task':
        url = `${baseUrl}/tasks`;
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

  if (!appointment) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Associations for "{appointment.description}"
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">{appointment.description}</h4>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(appointment.date_time), "PPp")}
                  {appointment.category && ` | Category: ${appointment.category}`}
                  {appointment.location && ` | Location: ${appointment.location}`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/app/${groupId}/calendar`, '_blank')}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Calendar
              </Button>
            </div>
          </div>

          <UnifiedAssociationManager
            entityId={appointment.id}
            entityType={ENTITY.appointment}
            groupId={groupId}
            onNavigate={handleNavigate}
            showTitle={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}