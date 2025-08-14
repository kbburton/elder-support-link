import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import demoData from '@/data/demo-data.json';

interface DemoSession {
  sessionId: string;
  email: string;
  token: string;
  isDemo: boolean;
}

interface DemoContextType {
  isDemo: boolean;
  demoSession: DemoSession | null;
  demoData: typeof demoData;
  startDemoSession: (email: string) => Promise<{ success: boolean; error?: string; redirectToLanding?: boolean }>;
  endDemoSession: () => void;
  trackPageVisit: (pagePath: string) => void;
  trackPageLeave: (pagePath: string, timeSpent?: number) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export const useDemoContext = () => {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemoContext must be used within a DemoProvider');
  }
  return context;
};

interface DemoProviderProps {
  children: ReactNode;
}

export const DemoProvider: React.FC<DemoProviderProps> = ({ children }) => {
  const [demoSession, setDemoSession] = useState<DemoSession | null>(null);
  const [currentPage, setCurrentPage] = useState<string>('');
  const [pageStartTime, setPageStartTime] = useState<number>(0);
  const [hasRealAuth, setHasRealAuth] = useState<boolean>(false);
  
  // Check for real authentication
  const checkForRealAuth = useCallback(() => {
    return hasRealAuth;
  }, [hasRealAuth]);

  // Check for existing demo session on mount and monitor real auth
  useEffect(() => {
    // Check for real Supabase session first
    const checkRealAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        console.log('Real authenticated user found, disabling demo mode');
        setHasRealAuth(true);
        setDemoSession(null);
        localStorage.removeItem('demo-session');
        return;
      }
      
      // Only check for demo session if no real auth
      const storedSession = localStorage.getItem('demo-session');
      if (storedSession) {
        try {
          const session = JSON.parse(storedSession);
          if (session.token && isValidDemoToken(session.token)) {
            setDemoSession(session);
          } else {
            localStorage.removeItem('demo-session');
          }
        } catch (error) {
          console.error('Error parsing stored demo session:', error);
          localStorage.removeItem('demo-session');
        }
      }
    };

    checkRealAuth();

    // Monitor auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        console.log('Real user logged in, ending demo session');
        setHasRealAuth(true);
        setDemoSession(null);
        localStorage.removeItem('demo-session');
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, allowing demo mode');
        setHasRealAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isValidDemoToken = (token: string): boolean => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      
      return payload.exp > now && payload.iss === 'daveassist-demo' && payload.isDemo === true;
    } catch {
      return false;
    }
  };

  const startDemoSession = useCallback(async (email: string): Promise<{ success: boolean; error?: string; redirectToLanding?: boolean }> => {
    try {
      console.log('🎭 Starting demo session for:', email);
      
      const { data, error } = await supabase.functions.invoke('demo-auth', {
        body: { email }
      });

      console.log('📡 Demo auth response:', { data, error });

      if (error) {
        console.error('🚨 Demo auth error:', error);
        let errorMessage = 'Authentication failed';
        
        if (error.message?.includes('fetch')) {
          errorMessage = 'Demo service is temporarily unavailable. Please try again.';
        } else if (error.message?.includes('email')) {
          errorMessage = 'Please enter a valid email address';
        }
        
        return { success: false, error: errorMessage };
      }

      if (!data || !data.success) {
        console.error('🚨 Demo auth failed:', data);
        
        // Handle specific error types
        if (data?.error === 'existing_user') {
          return { 
            success: false, 
            error: data.message || 'You are already registered! Please sign in to access your account.',
            redirectToLanding: true
          };
        } else if (data?.error === 'frequent_user') {
          return { 
            success: false, 
            error: data.message || 'You\'ve used the demo several times. Consider creating a real account!' 
          };
        }
        
        return { success: false, error: data?.error || 'Authentication failed' };
      }

      const session: DemoSession = {
        sessionId: data.sessionId,
        email,
        token: data.token,
        isDemo: true
      };

      setDemoSession(session);
      localStorage.setItem('demo-session', JSON.stringify(session));

      console.log('✅ Demo session started for:', email);
      return { success: true };
    } catch (error) {
      console.error('🚨 Error starting demo session:', error);
      
      let errorMessage = 'Failed to start demo session';
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorMessage = 'Demo service is temporarily unavailable. Please try again in a moment.';
        } else if (error.message.includes('email')) {
          errorMessage = 'Please check your email format and try again.';
        }
      }
      
      return { success: false, error: errorMessage };
    }
  }, []);

  const endDemoSession = useCallback(() => {
    setDemoSession(null);
    localStorage.removeItem('demo-session');
    console.log('🔚 Demo session ended');
  }, []);

  const trackPageVisit = useCallback(async (pagePath: string) => {
    if (!demoSession) return;

    setCurrentPage(pagePath);
    setPageStartTime(Date.now());

    try {
      await supabase.functions.invoke('demo-analytics', {
        body: {
          sessionId: demoSession.sessionId,
          pagePath,
          action: 'enter'
        }
      });
    } catch (error) {
      console.error('Error tracking page visit:', error);
    }
  }, [demoSession]);

  const trackPageLeave = useCallback(async (pagePath: string, timeSpent?: number) => {
    if (!demoSession) return;

    const calculatedTimeSpent = timeSpent || (pageStartTime ? Math.floor((Date.now() - pageStartTime) / 1000) : 0);

    try {
      await supabase.functions.invoke('demo-analytics', {
        body: {
          sessionId: demoSession.sessionId,
          pagePath,
          action: 'leave',
          timeSpentSeconds: calculatedTimeSpent
        }
      });
    } catch (error) {
      console.error('Error tracking page leave:', error);
    }
  }, [demoSession, pageStartTime]);

  // Track page changes automatically
  useEffect(() => {
    if (!currentPage || !demoSession) return;
    
    return () => {
      if (currentPage && demoSession) {
        const timeSpent = pageStartTime ? Math.floor((Date.now() - pageStartTime) / 1000) : 0;
        trackPageLeave(currentPage, timeSpent);
      }
    };
  }, [currentPage]); // Remove demoSession from dependencies to prevent infinite loop

  const value: DemoContextType = useMemo(() => ({
    isDemo: !!demoSession && !checkForRealAuth(), // Only demo if we have demo session AND no real auth
    demoSession,
    demoData,
    startDemoSession,
    endDemoSession,
    trackPageVisit,
    trackPageLeave
  }), [demoSession, startDemoSession, endDemoSession, trackPageVisit, trackPageLeave]);

  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  );
};