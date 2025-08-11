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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        toast({ title: "Session expired", description: "Please log in again." });
        navigate("/login", { replace: true });
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast({ title: "Session required", description: "Please log in again." });
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
