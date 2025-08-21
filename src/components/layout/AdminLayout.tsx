import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Outlet, useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";
import { AdminSidebar } from "../navigation/AdminSidebar";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const AdminLayout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({ title: "Session required", description: "Please log in to access admin features." });
        navigate("/login", { replace: true });
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
        <AdminSidebar />
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

export default AdminLayout;