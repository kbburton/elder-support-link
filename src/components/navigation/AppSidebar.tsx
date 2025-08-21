import { NavLink, useParams } from "react-router-dom";
import { Calendar, FileText, ListTodo, NotebookPen, Search, Shield, User, Settings, Users, MessageSquare, UserPlus } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/navigation/UserMenu";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { useDemo } from "@/hooks/useDemo";

const mainItems = [
  { title: "Calendar", url: "calendar", icon: Calendar },
  { title: "Tasks", url: "tasks", icon: ListTodo },
  { title: "Contacts", url: "contacts", icon: Users },
  { title: "Activity Log", url: "activity", icon: NotebookPen },
  { title: "Search", url: "search", icon: Search },
  { title: "Feedback", url: "settings/feedback", icon: MessageSquare },
  { title: "Profile", url: "profile", icon: User },
  { title: "Group Settings", url: "settings", icon: Settings },
];


export function AppSidebar() {
  const { groupId } = useParams();
  const { state } = useSidebar();
  const { isPlatformAdmin } = usePlatformAdmin();
  const { isDemo } = useDemo();
  
  // Don't render if we don't have a valid groupId
  if (!groupId || groupId === ':groupId') {
    return null;
  }
  
  const base = `/app/${groupId}`;
  
  // Filter items based on demo mode
  const filteredMainItems = isDemo 
    ? mainItems.filter(item => item.title !== "Group Settings")
    : mainItems;

  return (
    <Sidebar className={state === "collapsed" ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={`${base}/${item.url}`} end className={({ isActive }) => isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"}>
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {!isDemo && isPlatformAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/app/system-admin" className={({ isActive }) => isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      <span>System Admin</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
