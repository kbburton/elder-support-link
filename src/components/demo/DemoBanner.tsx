import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const DemoBanner = () => {
  return (
    <Alert className="border-l-4 border-l-destructive bg-destructive/10 text-destructive rounded-none" variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="font-medium">
        Demo mode — data is read-only
      </AlertDescription>
    </Alert>
  );
};