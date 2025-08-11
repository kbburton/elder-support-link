import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, useParams } from "react-router-dom";

const groups = [
  { id: "demo", name: "Demo Family" },
  { id: "mom", name: "Mom" },
  { id: "uncle", name: "Uncle Joe" },
];

const AppHeader = () => {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const current = groups.find((g) => g.id === groupId) || groups[0];

  return (
    <header className="h-14 flex items-center border-b px-4 gap-3">
      <SidebarTrigger className="ml-0" />
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-md shadow-glow" style={{ background: "var(--gradient-primary)" }} />
        <span className="font-medium">DaveAssist</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <Select
          defaultValue={current.id}
          onValueChange={(val) => navigate(`/app/${val}/calendar`)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select group" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => navigate(`/app/${current.id}/search`)}>Search</Button>
      </div>
    </header>
  );
};

export default AppHeader;
