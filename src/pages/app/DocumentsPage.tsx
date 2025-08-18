import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useDemo } from "@/hooks/useDemo";
import { useDemoOperations } from "@/hooks/useDemoOperations";

type Document = {
  id: string;
  group_id: string | null;
  title: string | null;
  category: string | null;
  file_type: string | null;
  file_size: number | null;
  upload_date: string;
};

const DocumentsPage = () => {
  const { groupId } = useParams();
  const queryClient = useQueryClient();
  const { isDemo } = useDemo();
  const { blockCreate } = useDemoOperations();

  const [search, setSearch] = useState("");
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
    queryKey: ["documents", groupId, search],
    enabled: !!groupId,
    queryFn: async () => {
      let q = supabase
        .from("documents")
        .select("id, group_id, title, category, file_type, file_size, upload_date")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .order("upload_date", { ascending: false });

      if (search) {
        q = q.or(`title.ilike.%${search}%,category.ilike.%${search}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Document[];
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

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) {
        toast({ title: "Read-only demo", description: "Deletion is disabled in demo mode." });
        return;
      }
      const ok = window.confirm("Move this document to Trash?");
      if (!ok) return;

      const { error } = await supabase.rpc("soft_delete_document", {
        p_document_id: id,
        p_by_user_id: currentUserId,
        p_by_email: currentUserEmail,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Moved to Trash", description: "Document was soft-deleted." });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const deleteBulk = useMutation({
    mutationFn: async (ids: string[]) => {
      if (isDemo) {
        toast({ title: "Read-only demo", description: "Deletion is disabled in demo mode." });
        return;
      }
      const ok = window.confirm(`Move ${ids.length} document(s) to Trash?`);
      if (!ok) return;
      for (const id of ids) {
        const { error } = await supabase.rpc("soft_delete_document", {
          p_document_id: id,
          p_by_user_id: currentUserId,
          p_by_email: currentUserEmail,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setSelected({});
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Moved to Trash", description: "Selected documents were soft-deleted." });
    },
    onError: (e: any) => toast({ title: "Bulk delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <SEO title="Documents — DaveAssist" description="Manage documents." />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Documents</h2>
        <Button
          onClick={() => {
            if (blockCreate()) return;
            window.location.href = `/app/${groupId}/documents/upload`;
          }}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Upload
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Search</CardTitle></CardHeader>
        <CardContent className="flex gap-3">
          <Input placeholder="Title or category…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="outline" onClick={() => setSearch("")}>Clear</Button>
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
                  <th className="text-left p-3">Category</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Size</th>
                  <th className="text-left p-3">Uploaded</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No documents</td></tr>
                ) : rows.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="p-3"><input type="checkbox" checked={!!selected[d.id]} onChange={() => toggleOne(d.id)} /></td>
                    <td className="p-3">{d.title || "(Untitled)"}</td>
                    <td className="p-3">{d.category || ""}</td>
                    <td className="p-3">{d.file_type || ""}</td>
                    <td className="p-3">{d.file_size ?? ""}</td>
                    <td className="p-3">{new Date(d.upload_date).toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <Button variant="destructive" size="sm" onClick={() => deleteOne.mutate(d.id)}>
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

export default DocumentsPage;
