import { NavLink, useNavigate } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/navigation/UserMenu";
import { Button } from "@/components/ui/button";

export function AdminSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();

  const handleBackToApp = () => {
    navigate("/app");
  };

  return (
    <Sidebar className={state === "collapsed" ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            System Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Button 
                    variant="ghost" 
                    onClick={handleBackToApp}
                    className="w-full justify-start"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    <span>Back to App</span>
                  </Button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/app/system-admin" 
                    className="bg-muted text-primary font-medium"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    <span>System Admin</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <UserMenu variant="mobile" className="border-t" />
      </SidebarFooter>
    </Sidebar>
  );
}