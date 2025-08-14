import { useMemo } from 'react';
import { useDemo } from '@/hooks/useDemo';

// Simplified hook that provides stable demo state without causing re-renders
export const useSimpleDemoState = () => {
  const { isDemo } = useDemo();
  
  return useMemo(() => ({
    isDemo,
    blockOperation: () => isDemo,
    demoProfiles: { data: null, isDemo }
  }), [isDemo]);
};