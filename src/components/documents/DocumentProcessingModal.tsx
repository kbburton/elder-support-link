import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { FileText, CheckCircle, XCircle, Clock } from 'lucide-react';

interface DocumentProcessingModalProps {
  isOpen: boolean;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  currentFileName?: string;
}

export function DocumentProcessingModal({
  isOpen,
  processingCount,
  completedCount,
  failedCount,
  currentFileName
}: DocumentProcessingModalProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, [isOpen]);

  const totalCount = processingCount + completedCount + failedCount;
  const progressValue = totalCount > 0 ? ((completedCount + failedCount) / totalCount) * 100 : 0;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Processing Documents
          </DialogTitle>
          <DialogDescription>
            AI is extracting text and generating summaries for your documents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Progress value={progressValue} className="w-full" />
          
          <div className="space-y-2">
            {processingCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>Processing{dots}</span>
                {currentFileName && <span className="text-muted-foreground">({currentFileName})</span>}
              </div>
            )}
            
            {completedCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>{completedCount} completed</span>
              </div>
            )}
            
            {failedCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <XCircle className="h-4 w-4" />
                <span>{failedCount} failed</span>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            This may take a few moments depending on document size and complexity.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}