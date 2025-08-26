import { useDemo } from '@/hooks/useDemo';
import { useToast } from '@/components/ui/use-toast';
import { useCallback } from 'react';

export const useDemoOperations = () => {
  const { isDemo } = useDemo();
  const { toast } = useToast();

  const blockOperation = useCallback((operationName: string = 'operation', showToast: boolean = false) => {
    if (isDemo) {
      if (showToast) {
        toast({
          title: "Demo Mode",
          description: `Cannot perform ${operationName} in demo mode. This is read-only.`,
          variant: "default"
        });
      }
      return true;
    }
    return false;
  }, [isDemo, toast]);

  const blockOperationWithToast = useCallback((operationName: string = 'operation') => {
    return blockOperation(operationName, true);
  }, [blockOperation]);

  return {
    isDemo,
    blockOperation: () => isDemo, // Just return boolean for disabled states
    blockOperationWithToast, // Use this when you want to show a toast
    blockUpload: () => blockOperationWithToast('file upload'),
    blockCreate: () => blockOperationWithToast('create'),
    blockUpdate: () => blockOperationWithToast('update'),
    blockDelete: () => blockOperationWithToast('delete'),
    blockEmail: () => blockOperationWithToast('email sending')
  };
};