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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, FileX, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocumentProcessingErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: {
    message: string;
    details?: any;
    documentId?: string;
    filename?: string;
  } | null;
  onRetry?: () => void;
  retrying?: boolean;
}

export function DocumentProcessingErrorModal({
  isOpen,
  onClose,
  error,
  onRetry,
  retrying = false
}: DocumentProcessingErrorModalProps) {
  if (!error) return null;

  const isRetryable = error.message.includes("timeout") || 
                      error.message.includes("network") || 
                      error.message.includes("temporary");

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <FileX className="h-5 w-5" />
            Document Processing Failed
          </AlertDialogTitle>
          <AlertDialogDescription>
            There was an error processing your document. Please review the details below.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {error.filename && (
            <div>
              <strong>Document:</strong> {error.filename}
            </div>
          )}

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-medium">
              {error.message}
            </AlertDescription>
          </Alert>

          {error.details && (
            <div>
              <p className="text-sm font-medium mb-2">Technical Details:</p>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40 whitespace-pre-wrap">
                {typeof error.details === 'string' 
                  ? error.details 
                  : JSON.stringify(error.details, null, 2)
                }
              </pre>
            </div>
          )}

          {isRetryable && (
            <Alert>
              <AlertDescription>
                This appears to be a temporary issue. You can try processing the document again.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
          {onRetry && isRetryable && (
            <Button
              onClick={() => {
                onRetry();
                onClose();
              }}
              disabled={retrying}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Retrying...' : 'Retry Processing'}
            </Button>
          )}
          <AlertDialogAction>
            Understood
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}