import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AppHeader = () => {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const currentId = groupId || "demo";

  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;

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
        <span className="font-medium">DaveAssist</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <Select value={currentId} onValueChange={(val) => navigate(`/app/${val}/calendar`)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select group" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => navigate(`/app/${currentId}/search`)}>Search</Button>
      </div>
    </header>
  );
};

export default AppHeader;
