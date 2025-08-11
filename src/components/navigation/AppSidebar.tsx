import { NavLink, useParams } from "react-router-dom";
import { Calendar, FileText, ListTodo, NotebookPen, Search, Shield, User, Settings } from "lucide-react";
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
} from "@/components/ui/sidebar";

const items = [
  { title: "Calendar", url: "calendar", icon: Calendar },
  { title: "Tasks", url: "tasks", icon: ListTodo },
  { title: "Documents", url: "documents", icon: FileText },
  { title: "Activity Log", url: "activity", icon: NotebookPen },
  { title: "Search", url: "search", icon: Search },
  { title: "Group Settings", url: "settings", icon: Settings },
  { title: "Profile", url: "profile", icon: User },
  { title: "Admin", url: "admin", icon: Shield },
];

export function AppSidebar() {
  const { groupId = "demo" } = useParams();
  const { state } = useSidebar();
  const base = `/app/${groupId}`;

  return (
    <Sidebar className={state === "collapsed" ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Group</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={`${base}/${item.url}`} end className={({ isActive }) => isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"}>
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
