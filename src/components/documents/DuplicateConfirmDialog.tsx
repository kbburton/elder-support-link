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

interface DuplicateConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  duplicateFiles: string[];
}

export const DuplicateConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  duplicateFiles 
}: DuplicateConfirmDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Duplicate Files Detected</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>The following files already exist in this care group:</p>
            <ul className="list-disc list-inside space-y-1 text-sm bg-muted p-3 rounded">
              {duplicateFiles.map((filename, index) => (
                <li key={index}>{filename}</li>
              ))}
            </ul>
            <p className="mt-3">
              Do you want to continue uploading? New files will be saved with unique timestamps.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Continue Upload</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};