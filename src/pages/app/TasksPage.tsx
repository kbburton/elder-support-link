import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useDemo } from "@/hooks/useDemo";
import { useDemoOperations } from "@/hooks/useDemoOperations";

type Task = {
  id: string;
  group_id: string | null;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  completed_by_email: string | null;
};

const TasksPage = () => {
  const { groupId } = useParams();
  const queryClient = useQueryClient();
  const { isDemo } = useDemo();
  const { blockCreate } = useDemoOperations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email ?? "");
      }
    })();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", groupId, search, statusFilter],
    enabled: !!groupId,
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select("id, group_id, title, status, priority, due_date, created_at, completed_at, completed_by_email")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .order("due_date", { ascending: true })
        .order("priority", { ascending: true });

      if (search) {
        q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
  });

  const rows = data ?? [];
  const toggleOne = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const allChecked = useMemo(() => rows.length > 0 && rows.every(r => selected[r.id]), [rows, selected]);
  const someChecked = useMemo(() => rows.some(r => selected[r.id]) && !allChecked, [rows, selected, allChecked]);
  const toggleAll = () => {
    if (allChecked) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      rows.forEach(r => { next[r.id] = true; });
      setSelected(next);
    }
  };

  const isOverdue = (t: Task) => {
    if (!t.due_date) return false;
    if (t.completed_at) return false;
    return new Date(t.due_date) < new Date();
  };

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) {
        toast({ title: "Read-only demo", description: "Deletion is disabled in demo mode." });
        return;
      }
      const ok = window.confirm("Move this task to Trash?");
      if (!ok) return;

      const { error } = await supabase.rpc("soft_delete_task", {
        p_task_id: id,
        p_by_user_id: currentUserId,
        p_by_email: currentUserEmail,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Moved to Trash", description: "Task was soft-deleted." });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const deleteBulk = useMutation({
    mutationFn: async (ids: string[]) => {
      if (isDemo) {
        toast({ title: "Read-only demo", description: "Deletion is disabled in demo mode." });
        return;
      }
      const ok = window.confirm(`Move ${ids.length} task(s) to Trash?`);
      if (!ok) return;
      for (const id of ids) {
        const { error } = await supabase.rpc("soft_delete_task", {
          p_task_id: id,
          p_by_user_id: currentUserId,
          p_by_email: currentUserEmail,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setSelected({});
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Moved to Trash", description: "Selected tasks were soft-deleted." });
    },
    onError: (e: any) => toast({ title: "Bulk delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <SEO title="Tasks — DaveAssist" description="Track tasks." />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tasks</h2>
        <Button
          onClick={() => {
            if (blockCreate()) return;
            window.location.href = `/app/${groupId}/tasks/new`;
          }}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Search & Filters</CardTitle></CardHeader>
        <CardContent className="flex gap-3 items-center">
          <Input placeholder="Title or description…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="InProgress">InProgress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40">
                  <th className="w-12 p-3">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => { if (el) el.indeterminate = someChecked; }}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="text-left p-3">Title</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Priority</th>
                  <th className="text-left p-3">Due</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No tasks</td></tr>
                ) : rows.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-3"><input type="checkbox" checked={!!selected[t.id]} onChange={() => toggleOne(t.id)} /></td>
                    <td className="p-3">{t.title}</td>
                    <td className="p-3">{t.status}</td>
                    <td className="p-3">{t.priority ?? ""}</td>
                    <td className={`p-3 ${isOverdue(t) ? "text-red-600 font-medium" : ""}`}>
                      {t.due_date ? new Date(t.due_date).toLocaleDateString() : ""}
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="destructive" size="sm" onClick={() => deleteOne.mutate(t.id)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {Object.keys(selected).filter(id => selected[id]).length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-background border shadow-lg rounded-xl px-4 py-3 flex items-center gap-3">
          <div>{Object.keys(selected).filter(id => selected[id]).length} selected</div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              const ids = Object.keys(selected).filter(id => selected[id]);
              deleteBulk.mutate(ids);
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete selected
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelected({})}>Clear</Button>
        </div>
      )}
    </div>
  );
};

export default TasksPage;
