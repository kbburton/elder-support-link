import { useEffect, useState, useCallback, useRef } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import { debounce } from "@/utils/debounce";
import { UserMenu } from "@/components/navigation/UserMenu";

const AppHeader = () => {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const currentId = groupId || "demo";

  const [groups, setGroups] = useState<{ id: string; name: string; memberCount: number; taskCount: number }[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [searchValue, setSearchValue] = useState<string>("");
  const groupSelectRef = useRef<HTMLButtonElement>(null);

  // Debounced search navigation
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.trim()) {
        navigate(`/app/${currentId}/search?q=${encodeURIComponent(query.trim())}`);
      }
    }, 250),
    [navigate, currentId]
  );

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    debouncedSearch(value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchValue.trim()) {
      navigate(`/app/${currentId}/search?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };
  
  // Load groups and persist current group selection
  const handleGroupChange = (newGroupId: string) => {
    // Persist to localStorage
    localStorage.setItem('daveassist-current-group', newGroupId);
    
    // Navigate to calendar of the new group
    navigate(`/app/${newGroupId}/calendar`);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;

        // Load user's display name
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("user_id", uid)
            .maybeSingle();
          const name =
            (profile?.first_name || "") + (profile?.last_name ? ` ${profile.last_name}` : "");
          setUserName(name.trim() || auth.user?.email || "User");
        } catch {
          setUserName(auth.user?.email || "User");
        }

        // Get user's group memberships
        const { data: memberships } = await supabase
          .from("care_group_members")
          .select("group_id")
          .eq("user_id", uid);

        const ids = (memberships || []).map((m: any) => m.group_id).filter(Boolean);

        let list: { id: string; name: string; memberCount: number; taskCount: number }[] = [];
        
        if (ids.length) {
          // Get groups with stats
          const { data: cg } = await supabase
            .from("care_groups")
            .select("id, name")
            .in("id", ids as string[]);
          
          if (cg) {
            // Get member counts for each group
            const { data: memberCounts } = await supabase
              .from("care_group_members")
              .select("group_id")
              .in("group_id", ids as string[]);
            
            // Get task counts for each group  
            const { data: taskCounts } = await supabase
              .from("tasks")
              .select("group_id")
              .in("group_id", ids as string[])
              .neq("status", "Completed");

            list = cg.map(group => ({
              id: group.id,
              name: group.name,
              memberCount: memberCounts?.filter(m => m.group_id === group.id).length || 0,
              taskCount: taskCounts?.filter(t => t.group_id === group.id).length || 0
            }));
          }
        }

        // Add current group if not in user's memberships and not demo
        if (currentId && !list.find((g) => g.id === currentId) && currentId !== "demo") {
          const { data: cur } = await supabase
            .from("care_groups")
            .select("id, name")
            .eq("id", currentId)
            .maybeSingle();
          if (cur) {
            // Get stats for current group
            const { data: memberCount } = await supabase
              .from("care_group_members")
              .select("group_id")
              .eq("group_id", currentId);
            
            const { data: taskCount } = await supabase
              .from("tasks")
              .select("group_id")
              .eq("group_id", currentId)
              .neq("status", "Completed");

            list = [{ 
              id: cur.id, 
              name: cur.name,
              memberCount: memberCount?.length || 0,
              taskCount: taskCount?.length || 0
            }, ...list];
          } else {
            list = [{ 
              id: currentId, 
              name: "Current Group",
              memberCount: 0,
              taskCount: 0
            }, ...list];
          }
        }

        // Add demo group with placeholder stats
        const withDemo = [{ 
          id: "demo", 
          name: "Demo Family",
          memberCount: 1,
          taskCount: 2
        }, ...list.filter((g) => g.id !== "demo")];
        
        setGroups(withDemo);

        // Check localStorage for persisted group if not already set
        const savedGroup = localStorage.getItem('daveassist-current-group');
        if (savedGroup && savedGroup !== currentId && withDemo.find(g => g.id === savedGroup)) {
          navigate(`/app/${savedGroup}/calendar`, { replace: true });
        }
      } catch (e) {
        // ignore
      }
    };
    load();
  }, [currentId, navigate]);

  return (
    <header className="h-14 flex items-center border-b px-4 gap-3">
      <SidebarTrigger className="ml-0" />
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-md shadow-glow" style={{ background: "var(--gradient-primary)" }} />
        <span className="font-medium">DaveAssist{userName ? ` — ${userName}` : ""}</span>
      </div>
      
      {/* Search Bar */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search appointments, tasks, documents..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-10"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Select value={currentId} onValueChange={handleGroupChange}>
          <SelectTrigger ref={groupSelectRef} className="w-[240px]">
            <SelectValue placeholder="Select group" />
          </SelectTrigger>
          <SelectContent className="w-[240px]">
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id} className="px-3 py-2">
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">{g.name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{g.memberCount} member{g.memberCount !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{g.taskCount} task{g.taskCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </SelectItem>
            ))}
            
            <div className="border-t my-1" />
            
            <div 
              className="px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
              onClick={() => {
                navigate("/app/groups/new");
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">+</span>
                <span>Create new care group</span>
              </div>
            </div>
            
            <div 
              className="px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
              onClick={() => {
                navigate(`/app/${currentId}/settings`);
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">⚙</span>
                <span>Manage current group</span>
              </div>
            </div>
          </SelectContent>
        </Select>
        
        <UserMenu 
          onSwitchGroup={() => groupSelectRef.current?.click()} 
          variant="desktop" 
        />
      </div>
    </header>
  );
};

export default AppHeader;
