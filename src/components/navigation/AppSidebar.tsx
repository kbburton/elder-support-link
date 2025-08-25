// File: src/components/navigation/AppSidebar.tsx
import { NavLink, useParams } from "react-router-dom";
import { useMemo } from "react";
import { LayoutDashboard, Calendar, FileText, ListTodo, NotebookPen, Search, MessageSquare, User, Users, Settings, UserPlus, Heart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/navigation/UserMenu";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { useDemo } from "@/hooks/useDemo";

const mainItems = [
  { title: "Dashboard", url: "dashboard", icon: LayoutDashboard },   // Added Dashboard as first menu item
  { title: "Calendar", url: "calendar", icon: Calendar },
  { title: "Tasks", url: "tasks", icon: ListTodo },
  { title: "Contacts", url: "contacts", icon: Users },
  { title: "Documents", url: "documents", icon: FileText },
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

  // Query to fetch care group name (to extract first name for Loved One Info label)
  const { data: careGroup } = useQuery({
    queryKey: ["care_group_name", groupId],
    enabled: !!groupId && groupId !== ":groupId",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_groups")
        .select("name")
        .eq("id", groupId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // If no valid groupId, don't render the sidebar menu
  if (!groupId || groupId === ":groupId") {
    return null;
  }
  const base = `/app/${groupId}`;

  // Insert the "Loved One Info" link dynamically before Group Settings (for non-demo users)
  const firstName = careGroup?.name?.split(" ")[0] || "Loved One";
  const allMainItems = useMemo(() => {
    const lovedOneItem = { title: `${firstName} Info`, url: "loved-one-info", icon: Heart };
    if (isDemo) {
      // In demo mode, hide actual Group Settings
      return mainItems.filter(item => item.title !== "Group Settings");
    }
    // For real users, inject Loved One Info before Group Settings
    const items: typeof mainItems = [];
    for (const item of mainItems) {
      if (item.title === "Group Settings") {
        items.push(lovedOneItem);
      }
      items.push(item);
    }
    return items;
  }, [firstName, isDemo]);

  return (
    <Sidebar className={state === "collapsed" ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allMainItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={`${base}/${item.url}`} 
                      end 
                      className={({ isActive }) => 
                        isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"
                      }
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {!isDemo && isPlatformAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={`${base}/system-admin`} 
                      className={({ isActive }) => 
                        isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"
                      }
                    >
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
