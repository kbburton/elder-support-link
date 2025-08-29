import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import AppHeader from "./AppHeader";
import { AppSidebar } from "../navigation/AppSidebar";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useDemo, useDemoAnalytics } from "@/hooks/useDemo";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { DemoRedirectModal } from "@/components/demo/DemoRedirectModal";
import { useState } from "react";
const AppLayout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { groupId } = useParams();
  const { isDemo, demoGroupId } = useDemo();
  const [showDemoRedirect, setShowDemoRedirect] = useState(false);
  
  // Track demo analytics
  useDemoAnalytics();
  useEffect(() => {
    // First check if we have a real authenticated session
    const checkAuthFirst = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // If we have a real authenticated session, we should NOT be in demo mode
      if (session?.user) {
        console.log('Real authenticated user detected:', session.user.email);
        // For real users, ensure no demo redirects happen
        setShowDemoRedirect(false);
        return;
      }
      
      // Handle demo mode only if no real session exists AND isDemo is true
      if (!session && isDemo) {
        // If user is trying to access a different group ID in demo mode, redirect to demo group
        if (groupId !== demoGroupId) {
          setShowDemoRedirect(true);
          return;
        }
        // Demo mode - skip auth checks
        return;
      }

      // Regular authentication checks for non-demo mode
      if (!session && !isDemo) {
        console.log('No session found, redirecting to login');
        toast({ title: "Session required", description: "Please log in again." });
        navigate("/login", { replace: true });
      }
    };

    checkAuthFirst();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', { event, hasSession: !!session, userId: session?.user?.id });
      
      if (!session && event !== 'INITIAL_SESSION') {
        toast({ title: "Session expired", description: "Please log in again." });
        navigate("/login", { replace: true });
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [navigate, toast, isDemo, groupId, demoGroupId]);
  const handleDemoRedirect = () => {
    navigate(`/app/${demoGroupId}/calendar`);
    setShowDemoRedirect(false);
  };

  return (
    <>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <SidebarInset>
            {isDemo && <DemoBanner />}
            <AppHeader />
            <div className="p-6 container">
              <Outlet />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
      
      <DemoRedirectModal 
        isOpen={showDemoRedirect}
        onStartDemo={handleDemoRedirect}
      />
    </>
  );
};

export default AppLayout;
