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

type Contact = {
  id: string;
  care_group_id: string;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  contact_type: string;
  email_personal: string | null;
  email_work: string | null;
  phone_primary: string | null;
  created_at: string;
};

const ContactsPage = () => {
  const { groupId } = useParams();
  const queryClient = useQueryClient();
  const { isDemo } = useDemo();
  const { blockCreate } = useDemoOperations();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [isGroupAdmin, setIsGroupAdmin] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email ?? "");
        const { data: member } = await supabase
          .from("care_group_members")
          .select("is_admin, role")
          .eq("group_id", groupId)
          .eq("user_id", user.id)
          .maybeSingle();
        setIsGroupAdmin(Boolean(member?.is_admin) || member?.role === "admin");
      }
    })();
  }, [groupId]);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", groupId, search],
    enabled: !!groupId,
    queryFn: async () => {
      let q = supabase
        .from("contacts")
        .select("id, care_group_id, first_name, last_name, organization_name, contact_type, email_personal, email_work, phone_primary, created_at")
        .eq("care_group_id", groupId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (search) {
        q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,organization_name.ilike.%${search}%,email_personal.ilike.%${search}%,email_work.ilike.%${search}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Contact[];
    },
  });

  const rows = data ?? [];

  const toggleOne = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const allChecked = useMemo(() => rows.length > 0 && rows.every(r => selected[r.id]), [rows, selected]);
  const someChecked = useMemo(() => rows.some(r => selected[r.id]) && !allChecked, [rows, selected, allChecked]);
  const toggleAll = () => {
    if (allChecked) {
      const cleared: Record<string, boolean> = {};
      setSelected(cleared);
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
      if (!isGroupAdmin) {
        throw new Error("Only group admins can delete contacts.");
      }
      const ok = window.confirm("Move this contact to Trash?");
      if (!ok) return;

      const { error } = await supabase.rpc("soft_delete_contact", {
        p_contact_id: id,
        p_by_user_id: currentUserId,
        p_by_email: currentUserEmail,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Moved to Trash", description: "Contact was soft-deleted." });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const deleteBulk = useMutation({
    mutationFn: async (ids: string[]) => {
      if (isDemo) {
        toast({ title: "Read-only demo", description: "Deletion is disabled in demo mode." });
        return;
      }
      if (!isGroupAdmin) throw new Error("Only group admins can delete contacts.");
      const ok = window.confirm(`Move ${ids.length} contact(s) to Trash?`);
      if (!ok) return;
      for (const id of ids) {
        const { error } = await supabase.rpc("soft_delete_contact", {
          p_contact_id: id,
          p_by_user_id: currentUserId,
          p_by_email: currentUserEmail,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setSelected({});
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Moved to Trash", description: "Selected contacts were soft-deleted." });
    },
    onError: (e: any) => toast({ title: "Bulk delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <SEO title="Contacts — DaveAssist" description="Manage contacts for your care group." />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Contacts</h2>
        <Button
          onClick={() => {
            if (blockCreate()) return;
            // Your existing create contact flow (modal or route)
            window.location.href = `/app/${groupId}/contacts/new`;
          }}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Contact
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Input placeholder="Name, org, email..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  <th className="text-left p-3">Name / Org</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Phone</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No contacts</td></tr>
                ) : (
                  rows.map((c) => {
                    const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
                    const email = c.email_personal || c.email_work || "";
                    return (
                      <tr key={c.id} className="border-t">
                        <td className="p-3">
                          <input type="checkbox" checked={!!selected[c.id]} onChange={() => toggleOne(c.id)} />
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{name || c.organization_name || "(Unnamed)"}</div>
                          {c.organization_name && name && <div className="text-xs text-muted-foreground">{c.organization_name}</div>}
                        </td>
                        <td className="p-3">{c.contact_type}</td>
                        <td className="p-3">{email}</td>
                        <td className="p-3">{c.phone_primary || ""}</td>
                        <td className="p-3 text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={!isGroupAdmin || deleteOne.isPending}
                            onClick={() => deleteOne.mutate(c.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bulk bar */}
      {Object.keys(selected).filter(id => selected[id]).length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-background border shadow-lg rounded-xl px-4 py-3 flex items-center gap-3">
          <div>
            {Object.keys(selected).filter(id => selected[id]).length} selected
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={!isGroupAdmin || deleteBulk.isPending}
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

export default ContactsPage;
