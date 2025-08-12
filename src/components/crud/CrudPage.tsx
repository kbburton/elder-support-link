import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import SEO from "@/components/layout/SEO";
import { TaskAppointmentDocumentLinker } from "@/components/documents/TaskAppointmentDocumentLinker";
import ContactMultiSelect from "@/components/contacts/ContactMultiSelect";
import { useContactLinkOperations } from "@/hooks/useContactLinkOperations";
import { triggerReindex } from "@/utils/reindex";
const sb = supabase as any;
export type CrudField = {
  name: string;
  label?: string;
  type?: "text" | "textarea" | "number" | "date" | "datetime" | "select" | "user_select" | "contact_multiselect";
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  options?: Array<{ value: string; label: string }>;
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
  const { persistContactLinks } = useContactLinkOperations();
  const [searchParams] = useSearchParams();
  const { groupId } = useParams();
  const qc = useQueryClient();
  const idField = config.idField ?? "id";
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<Array<{ id: string; email: string; name: string }>>([]);
  const [relatedContacts, setRelatedContacts] = useState<string[]>([]);

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

  // Handle URL parameters for pre-filling forms
  useEffect(() => {
    const contactId = searchParams.get("contactId");
    if (contactId && !editing && config.fields.some(f => f.type === "contact_multiselect")) {
      setRelatedContacts([contactId]);
    }
  }, [searchParams, editing, config.fields]);

  // Load existing row data from URL
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
      setCurrentUserEmail(data.user?.email ?? null);
    });
  }, []);

  // Load group members for user_select fields
  useEffect(() => {
    if (groupId && config.fields.some(f => f.type === "user_select")) {
      const loadGroupMembers = async () => {
        try {
          // Get care group members using the explicit foreign key relationship
          const { data: members, error } = await supabase
            .from('care_group_members')
            .select(`
              user_id,
              profiles!care_group_members_user_id_fkey(email, first_name, last_name)
            `)
            .eq('group_id', groupId);

          if (error) throw error;

          const formattedMembers = members?.map((member: any) => ({
            id: member.user_id,
            email: member.profiles?.email || '',
            name: `${member.profiles?.first_name || ''} ${member.profiles?.last_name || ''}`.trim() || member.profiles?.email || 'Unknown'
          })) || [];

          setGroupMembers(formattedMembers);
        } catch (error) {
          console.error('Failed to load group members:', error);
          // Fallback: try without the relationship if it fails
          try {
            const { data: rawMembers, error: rawError } = await supabase
              .from('care_group_members')
              .select('user_id')
              .eq('group_id', groupId);
            
            if (rawError) throw rawError;
            
            if (rawMembers && rawMembers.length > 0) {
              const userIds = rawMembers.map(m => m.user_id);
              const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('user_id, email, first_name, last_name')
                .in('user_id', userIds);
                
              if (profilesError) throw profilesError;
              
              const formattedMembers = profiles?.map((profile: any) => ({
                id: profile.user_id,
                email: profile.email || '',
                name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown'
              })) || [];
              
              setGroupMembers(formattedMembers);
            }
          } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
          }
        }
      };

      loadGroupMembers();
    }
  }, [groupId, config.fields]);

  // Pre-fill creator field for new records so it shows in the read-only input
  useEffect(() => {
    if (!editing && config.creatorFieldName && currentUserId && currentUserEmail) {
      setForm((prev) => {
        const newForm = { ...prev };
        if (prev[config.creatorFieldName!] == null || prev[config.creatorFieldName!] === "") {
          newForm[config.creatorFieldName!] = currentUserId;
        }
        // Always auto-populate creator email for new records
        if (config.fields.some(f => f.name === 'created_by_email')) {
          newForm.created_by_email = currentUserEmail;
        }
        return newForm;
      });
    }
  }, [editing, config.creatorFieldName, currentUserId, currentUserEmail, config.fields]);

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
      
      // Auto-fill creator fields with user ID and email on create
      if (!editing && config.creatorFieldName && currentUserId) {
        payload[config.creatorFieldName] = currentUserId;
        console.log('Setting creator field:', config.creatorFieldName, 'to:', currentUserId);
        
        // Always set email if field exists and we have current user email
        if (currentUserEmail && config.fields.some(f => f.name === 'created_by_email')) {
          payload.created_by_email = currentUserEmail;
          console.log('Setting created_by_email to:', currentUserEmail);
        }
      }

      console.log('Final payload before insert:', payload);
      console.log('Current user ID:', currentUserId);
      console.log('Is editing:', !!editing);

      // Handle task completion tracking
      if (config.table === "tasks") {
        const wasCompleted = editing?.status === "completed";
        const isNowCompleted = payload.status === "completed";
        
        if (!wasCompleted && isNowCompleted) {
          // Task is being marked as completed - auto-fill unless already set
          if (!payload.completed_at) {
            payload.completed_at = new Date().toISOString();
          }
          if (!payload.completed_by_user_id) {
            payload.completed_by_user_id = currentUserId;
          }
          if (!payload.completed_by_email) {
            payload.completed_by_email = currentUserEmail;
          }
        } else if (wasCompleted && !isNowCompleted) {
          // Task is being unmarked as completed
          payload.completed_at = null;
          payload.completed_by_user_id = null;
          payload.completed_by_email = null;
        }
      }

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
      
      // Handle contact linking for newly created items
      if (action === "created" && row?.[idField] && relatedContacts.length > 0) {
        try {
          if (config.table === 'tasks') {
            const linkPromises = relatedContacts.map((contactId) => 
              supabase.from('contact_tasks').insert({
                contact_id: contactId,
                task_id: row[idField],
              })
            );
            await Promise.all(linkPromises);
          } else if (config.table === 'appointments') {
            const linkPromises = relatedContacts.map((contactId) => 
              supabase.from('contact_appointments').insert({
                contact_id: contactId,
                appointment_id: row[idField],
              })
            );
            await Promise.all(linkPromises);
          }
          toast({ title: "Contacts linked", description: `${relatedContacts.length} contact(s) linked to the new ${config.table.slice(0, -1)}.` });
        } catch (e) {
          console.warn("Contact linking failed", e);
        }
      }
      
      // Handle document linking for newly created items
      if (action === "created" && row?.[idField] && form.documentLinks && form.documentLinks.length > 0) {
        try {
          // Use the appropriate table based on item type
          if (config.table === 'tasks') {
            const linkPromises = form.documentLinks.map((docId: string) => 
              supabase.from('task_documents').insert({
                document_id: docId,
                task_id: row[config.idField || 'id'],
                created_by_user_id: currentUserId
              })
            );
            await Promise.all(linkPromises);
          } else if (config.table === 'appointments') {
            const linkPromises = form.documentLinks.map((docId: string) => 
              supabase.from('appointment_documents').insert({
                document_id: docId,
                appointment_id: row[config.idField || 'id'],
                created_by_user_id: currentUserId
              })
            );
            await Promise.all(linkPromises);
          }
          toast({ title: "Documents linked", description: `${form.documentLinks.length} document(s) linked to the new ${config.table.slice(0, -1)}.` });
        } catch (e) {
          console.warn("Document linking failed", e);
          toast({ title: "Warning", description: "Item created but document linking failed." });
        }
      }
      
      setEditing(null);
      setRelatedContacts([]);

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
                    <TableHead className="w-20">Actions</TableHead>
                    {config.fields.map((f) => (
                      <TableHead key={f.name}>{f.label ?? f.name}</TableHead>
                    ))}
                    {(config.table === 'tasks' || config.table === 'appointments') && (
                      <TableHead className="w-32">Documents</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data && data.length > 0 ? (
                    data.map((row) => (
                      <TableRow key={row[idField] ?? JSON.stringify(row)}>
                        <TableCell className="space-x-1">
                          <Button size="sm" variant="outline" onClick={() => setEditing(row)}>Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(row)}>Del</Button>
                        </TableCell>
                        {config.fields.map((f) => (
                          <TableCell key={f.name} className="max-w-[260px] truncate">
                            {(() => {
                              const v = row[f.name];
                              if (v == null) return "—";
                              if (f.type === "date") return toInputDate(v);
                              if (f.type === "datetime") return toInputDateTime(v);
                              if (f.type === "user_select") {
                                // Display email for user_select fields
                                const userProfile = groupMembers.find(member => member.id === v);
                                return userProfile ? userProfile.email : String(v);
                              }
                              return String(v);
                            })()}
                          </TableCell>
                        ))}
                        {(config.table === 'tasks' || config.table === 'appointments') && (
                          <TableCell>
                            <TaskAppointmentDocumentLinker
                              itemId={row[idField]}
                              itemType={config.table === 'tasks' ? 'task' : 'appointment'}
                              itemTitle={row.title || row.description || 'Unnamed item'}
                              onLinksChange={() => qc.invalidateQueries({ queryKey })}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={config.fields.length + 1 + ((config.table === 'tasks' || config.table === 'appointments') ? 1 : 0)} className="text-center text-muted-foreground">No records</TableCell>
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
            {config.fields
              .filter((f) => {
                // Hide completion fields unless status is completed
                if (config.table === "tasks" && (f.name === "completed_at" || f.name === "completed_by_email")) {
                  return form.status === "completed";
                }
                return true;
              })
              .map((f) => (
              <div key={f.name} className="space-y-1">
                <label className="text-sm font-medium">{f.label ?? f.name}</label>
                {f.type === "textarea" ? (
                  <Textarea
                    placeholder={f.placeholder}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    rows={4}
                    readOnly={f.readOnly}
                  />
                ) : f.type === "select" ? (
                  <Select
                    value={form[f.name] ?? ""}
                    onValueChange={(value) => setForm((s) => ({ ...s, [f.name]: value }))}
                    disabled={f.readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={f.placeholder || `Select ${f.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.type === "user_select" ? (
                  <Select
                    value={form[f.name] ?? "none"}
                    onValueChange={(value) => setForm((s) => ({ ...s, [f.name]: value === "none" ? null : value }))}
                    disabled={f.readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={f.placeholder || `Select ${f.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {groupMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} ({member.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.type === "contact_multiselect" ? (
                  <ContactMultiSelect
                    selectedContactIds={relatedContacts}
                    onSelectionChange={setRelatedContacts}
                    entityType={config.table as "appointments" | "tasks" | "activity_logs" | "documents"}
                    placeholder="Select related contacts..."
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
            
            {/* Document linking section for new tasks and appointments */}
            {!editing && (config.table === 'tasks' || config.table === 'appointments') && (
              <div className="border-t pt-4 space-y-3">
                <label className="text-sm font-medium">Link Documents (optional)</label>
                <TaskAppointmentDocumentLinker
                  itemId={null}
                  itemType={config.table === 'tasks' ? 'task' : 'appointment'}
                  itemTitle="New item"
                  onLinksChange={() => {}}
                  isCreationMode={true}
                  onDocumentLinksChange={(links) => {
                    setForm((s) => ({ ...s, documentLinks: links }));
                  }}
                />
              </div>
            )}
            
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
