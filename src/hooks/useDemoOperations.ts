import { useDemo } from '@/hooks/useDemo';
import { useToast } from '@/components/ui/use-toast';

export const useDemoOperations = () => {
  const { isDemo } = useDemo();
  const { toast } = useToast();

  const blockOperation = (operationName: string = 'operation') => {
    if (isDemo) {
      toast({
        title: "Demo Mode",
        description: `Cannot perform ${operationName} in demo mode. This is read-only.`,
        variant: "default"
      });
      return true;
    }
    return false;
  };

  return {
    isDemo,
    blockOperation,
    blockUpload: () => blockOperation('file upload'),
    blockCreate: () => blockOperation('create'),
    blockUpdate: () => blockOperation('update'),
    blockDelete: () => blockOperation('delete'),
    blockEmail: () => blockOperation('email sending')
  };
};