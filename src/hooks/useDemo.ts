import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useDemoContext } from '@/contexts/DemoContext';

export const useDemo = () => {
  const { isDemo, demoSession, demoData } = useDemoContext();
  
  return {
    isDemo,
    demoSession,
    demoData,
    demoGroupId: demoData.demoGroupId
  };
};

export const useDemoAnalytics = () => {
  const { trackPageVisit, trackPageLeave, isDemo } = useDemoContext();
  const location = useLocation();

  useEffect(() => {
    if (!isDemo) return;

    const pagePath = location.pathname;
    trackPageVisit(pagePath);

    return () => {
      trackPageLeave(pagePath);
    };
  }, [location.pathname, isDemo, trackPageVisit, trackPageLeave]);
};