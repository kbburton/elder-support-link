import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight } from "lucide-react";

interface DemoRedirectModalProps {
  isOpen: boolean;
  onStartDemo: () => void;
}

export const DemoRedirectModal: React.FC<DemoRedirectModalProps> = ({
  isOpen,
  onStartDemo
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>You have accessed the demo</DialogTitle>
          <DialogDescription>
            It looks like you're trying to access a specific page in our demo. 
            Please start from the beginning to get the full experience.
          </DialogDescription>
        </DialogHeader>
        
        <Button onClick={onStartDemo} className="w-full">
          <ArrowRight className="mr-2 h-4 w-4" />
          Start Demo
        </Button>
      </DialogContent>
    </Dialog>
  );
};