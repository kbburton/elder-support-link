import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import SEO from "@/components/layout/SEO";
const sb = supabase as any;
export type CrudField = {
  name: string;
  label?: string;
  type?: "text" | "textarea" | "number" | "date" | "datetime";
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
};

export type CrudConfig = {
  title: string;
  table: string;
  idField?: string;
  groupScoped?: boolean; // if true, filters by group_id from route and sets on insert
  fields: CrudField[];
  orderBy?: { column: string; ascending?: boolean };
  creatorFieldName?: string; // if set, auto-populates with current user id on create
  notifyOnCreateEntity?: "tasks" | "appointments" | "documents" | "activity_logs"; // send immediate notifications
  onAfterSave?: (payload: { action: "created" | "updated"; row: any }) => void; // optional hook
};


function toInputDate(value?: string | null) {
  if (!value) return "";
  return value.split("T")[0];
}

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  // Expecting ISO, convert to local datetime-local format (YYYY-MM-DDTHH:mm)
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromInputDate(value: string) {
  return value || null;
}

function fromInputDateTime(value: string) {
  if (!value) return null;
  // Treat as local time, convert to ISO
  const iso = new Date(value).toISOString();
  return iso;
}

export default function CrudPage({ config }: { config: CrudConfig }) {
  const { groupId } = useParams();
  const qc = useQueryClient();
  const idField = config.idField ?? "id";
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const queryKey = useMemo(() => ["crud", config.table, groupId], [config.table, groupId]);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = sb.from(config.table).select("*");
      if (config.groupScoped && groupId) q = q.eq("group_id", groupId);
      if (config.orderBy) q = q.order(config.orderBy.column, { ascending: config.orderBy.ascending ?? false });
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const openId = searchParams.get("openId");
    if (openId && Array.isArray(data)) {
      const row = data.find((r: any) => String(r[idField]) === openId);
      if (row) setEditing(row);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, data]);

  useEffect(() => {
    if (editing) {
      const initial: Record<string, any> = {};
      for (const f of config.fields) {
        const v = editing[f.name] ?? "";
        if (f.type === "date") initial[f.name] = toInputDate(v);
        else if (f.type === "datetime") initial[f.name] = toInputDateTime(v);
        else initial[f.name] = v ?? "";
      }
      setForm(initial);
    } else {
      const initial: Record<string, any> = {};
      for (const f of config.fields) initial[f.name] = "";
      setForm(initial);
    }
  }, [editing, config.fields]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {};
      for (const f of config.fields) {
        const val = form[f.name];
        if (f.type === "date") payload[f.name] = fromInputDate(val);
        else if (f.type === "datetime") payload[f.name] = fromInputDateTime(val);
        else if (f.type === "number") payload[f.name] = val === "" ? null : Number(val);
        else payload[f.name] = val === "" ? null : val;
      }
      if (config.groupScoped && groupId) payload["group_id"] = groupId;
      if (!editing && config.creatorFieldName && currentUserId) payload[config.creatorFieldName] = currentUserId;

      if (editing && editing[idField]) {
        const { data: updated, error } = await sb
          .from(config.table)
          .update(payload)
          .eq(idField, editing[idField])
          .select()
          .maybeSingle();
        if (error) throw error;
        return { action: "updated" as const, row: updated };
      } else {
        const { data: created, error } = await sb
          .from(config.table)
          .insert(payload)
          .select()
          .maybeSingle();
        if (error) throw error;
        return { action: "created" as const, row: created };
      }
    },
    onSuccess: async ({ action, row }) => {
      toast({ title: `Record ${action}`, description: `Successfully ${action} a record.` });
      qc.invalidateQueries({ queryKey });
      setEditing(null);

      // Immediate notifications on create
      if (action === "created" && config.notifyOnCreateEntity && groupId && row?.[idField]) {
        try {
          await supabase.functions.invoke("notify", {
            body: {
              type: "immediate",
              entity: config.notifyOnCreateEntity,
              group_id: groupId,
              item_id: row[idField],
              baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
            },
          });
        } catch (e) {
          console.warn("Notification send failed", e);
        }
      }

      config.onAfterSave?.({ action, row });
    },
    onError: (e: any) => {
      toast({ title: "Operation failed", description: e.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await sb.from(config.table).delete().eq(idField, row[idField]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Record deleted." });
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message }),
  });

  return (
    <div className="space-y-6">
      <SEO title={`${config.title} — DaveAssist`} description={`Manage ${config.title.toLowerCase()}.`} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{config.title}</h1>
        <Button onClick={() => setEditing({})}>New</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Records</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : error ? (
              <p className="text-destructive">{String((error as any)?.message || error)}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {config.fields.map((f) => (
                      <TableHead key={f.name}>{f.label ?? f.name}</TableHead>
                    ))}
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data && data.length > 0 ? (
                    data.map((row) => (
                      <TableRow key={row[idField] ?? JSON.stringify(row)}>
                        {config.fields.map((f) => (
                          <TableCell key={f.name} className="max-w-[260px] truncate">
                            {(() => {
                              const v = row[f.name];
                              if (v == null) return "—";
                              if (f.type === "date") return toInputDate(v);
                              if (f.type === "datetime") return toInputDateTime(v);
                              return String(v);
                            })()}
                          </TableCell>
                        ))}
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => setEditing(row)}>Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(row)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={config.fields.length + 1} className="text-center text-muted-foreground">No records</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{editing ? (editing[idField] ? "Edit" : "Create") : "Create"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.groupScoped && (
              <p className="text-xs text-muted-foreground">Group: {groupId ?? "(none)"}</p>
            )}
            {config.fields.map((f) => (
              <div key={f.name} className="space-y-1">
                <label className="text-sm font-medium">{f.label ?? f.name}</label>
                {f.type === "textarea" ? (
                  <Textarea
                    placeholder={f.placeholder}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    rows={4}
                  />
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "datetime" ? "datetime-local" : "text"}
                    placeholder={f.placeholder}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    readOnly={f.readOnly}
                  />
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Button onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending}>{upsertMutation.isPending ? "Saving…" : "Save"}</Button>
              {editing && <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
