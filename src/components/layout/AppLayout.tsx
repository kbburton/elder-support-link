import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Outlet, useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";
import { AppSidebar } from "../navigation/AppSidebar";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
const AppLayout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('AppLayout session check:', { hasSession: !!session, error, userId: session?.user?.id });
      
      if (!session && !error) {
        console.log('No session found, redirecting to login');
        toast({ title: "Session required", description: "Please log in again." });
        navigate("/login", { replace: true });
      }
    };

    checkAuth();

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
  }, [navigate, toast]);
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="p-6 container">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
