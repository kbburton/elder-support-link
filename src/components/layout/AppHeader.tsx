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

  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
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

        const { data: memberships } = await supabase
          .from("care_group_members")
          .select("group_id")
          .eq("user_id", uid);

        const ids = (memberships || []).map((m: any) => m.group_id).filter(Boolean);

        let list: { id: string; name: string }[] = [];
        if (ids.length) {
          const { data: cg } = await supabase
            .from("care_groups")
            .select("id, name")
            .in("id", ids as string[]);
          if (cg) list = cg as any;
        }

        if (currentId && !list.find((g) => g.id === currentId) && currentId !== "demo") {
          const { data: cur } = await supabase
            .from("care_groups")
            .select("id, name")
            .eq("id", currentId)
            .maybeSingle();
          if (cur) list = [{ id: cur.id, name: cur.name }, ...list];
          else list = [{ id: currentId, name: "Current Group" }, ...list];
        }

        const withDemo = [{ id: "demo", name: "Demo Family" }, ...list.filter((g) => g.id !== "demo")];
        setGroups(withDemo);
      } catch (e) {
        // ignore
      }
    };
    load();
  }, [currentId]);

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
        <Select value={currentId} onValueChange={(val) => navigate(`/app/${val}/calendar`)}>
          <SelectTrigger ref={groupSelectRef} className="w-[200px]">
            <SelectValue placeholder="Select group" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
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
