import { useEffect, useMemo, useState } from "react";
import CrudPage, { CrudConfig } from "@/components/crud/CrudPage";
import { supabase } from "@/integrations/supabase/client";
import { useParams } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";

interface Member {
  user_id: string;
  name: string;
  email?: string | null;
}

export default function AppointmentsCrud() {
  const { groupId } = useParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [createdAppointmentId, setCreatedAppointmentId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [sel1d, setSel1d] = useState<Record<string, boolean>>({});
  const [sel3d, setSel3d] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadMembers = async () => {
      if (!groupId) return;
      const { data: cgm, error } = await supabase
        .from("care_group_members")
        .select("user_id")
        .eq("group_id", groupId);
      if (error) return console.error(error);
      const ids = (cgm ?? []).map((m) => m.user_id).filter(Boolean);
      if (ids.length === 0) return setMembers([]);
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", ids as string[]);
      if (pErr) return console.error(pErr);
      const list: Member[] = (profs ?? []).map((p) => ({
        user_id: p.user_id as string,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || (p.user_id as string).slice(0, 8),
        email: (p as any).email ?? null,
      }));
      setMembers(list);
    };
    loadMembers();
  }, [groupId]);

  const config: CrudConfig = useMemo(() => ({
    title: "Appointments",
    table: "appointments",
    groupScoped: true,
    fields: [
      { name: "date_time", label: "Date/Time", type: "datetime" },
      { name: "location", label: "Location" },
      { name: "category", label: "Category" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "created_by_email", label: "Created By", readOnly: true },
      { name: "attending_user_id", label: "Attending User ID" },
      { name: "reminder_days_before", label: "Reminder Days Before", type: "number" },
      { name: "outcome_notes", label: "Outcome Notes", type: "textarea" },
    ],
    creatorFieldName: "created_by_user_id",
    notifyOnCreateEntity: "appointments",
    orderBy: { column: "created_at", ascending: false },
    onAfterSave: ({ action, row }) => {
      if (action === "created" && row?.id) {
        setCreatedAppointmentId(row.id);
        setOpen(true);
      }
    },
  }), []);

  const saveRecipients = async () => {
    if (!createdAppointmentId) return;
    const rows: { appointment_id: string; user_id: string; days_before: number }[] = [];
    members.forEach((m) => {
      if (sel1d[m.user_id]) rows.push({ appointment_id: createdAppointmentId, user_id: m.user_id, days_before: 1 });
      if (sel3d[m.user_id]) rows.push({ appointment_id: createdAppointmentId, user_id: m.user_id, days_before: 3 });
    });
    if (rows.length === 0) {
      setOpen(false);
      return;
    }
    const { error } = await supabase.from("appointment_notification_recipients").insert(rows);
    if (error) {
      toast({ title: "Save failed", description: error.message });
    } else {
      toast({ title: "Reminder recipients saved", description: "Appointment reminders will be sent accordingly." });
    }
    setOpen(false);
    setSel1d({});
    setSel3d({});
  };

  return (
    <>
      <CrudPage config={config} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Who should be reminded?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium">1 day before</h4>
              <div className="mt-2 grid gap-2">
                {members.map((m) => (
                  <label key={`1d-${m.user_id}`} className="flex items-center gap-2">
                    <Checkbox
                      checked={!!sel1d[m.user_id]}
                      onCheckedChange={(v) => setSel1d((s) => ({ ...s, [m.user_id]: !!v }))}
                    />
                    <span className="text-sm">{m.name}{m.email ? ` · ${m.email}` : ""}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium">3 days before</h4>
              <div className="mt-2 grid gap-2">
                {members.map((m) => (
                  <label key={`3d-${m.user_id}`} className="flex items-center gap-2">
                    <Checkbox
                      checked={!!sel3d[m.user_id]}
                      onCheckedChange={(v) => setSel3d((s) => ({ ...s, [m.user_id]: !!v }))}
                    />
                    <span className="text-sm">{m.name}{m.email ? ` · ${m.email}` : ""}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Skip</Button>
              <Button onClick={saveRecipients}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
