import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface DocumentProcessingErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  fileName: string;
  errorMessage: string;
}

export function DocumentProcessingErrorModal({
  isOpen,
  onClose,
  onContinue,
  fileName,
  errorMessage
}: DocumentProcessingErrorModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Processing Error
          </DialogTitle>
          <DialogDescription>
            There was an error processing "{fileName}":
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          </div>
          
          <div className="text-sm">
            <p>The file has been uploaded but AI processing failed.</p>
            <p className="mt-2">Would you like to save the document without a summary?</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onContinue}>
            Save Without Summary
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}