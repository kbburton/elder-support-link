import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Plus, Upload, List, Calendar, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isSameDay, isSameWeek, isBefore, addWeeks, startOfWeek, addDays, parseISO, compareAsc } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

type Appointment = {
  id: string;
  date_time: string; // ISO
  location: string | null;
  category: string | null;
  description: string | null;
  attending_user_id: string | null;
  group_id: string | null;
  outcome_notes: string | null;
  reminder_days_before: number | null;
  created_by_user_id: string | null;
  created_by_email: string | null;
};

const CATEGORIES = ["Medical", "Financial/Legal", "Personal/Social", "Other"] as const;

type Category = typeof CATEGORIES[number];

const categoryToToken: Record<Category, { badgeVariant: "default" | "secondary" | "outline"; dotClass: string }> = {
  "Medical": { badgeVariant: "default", dotClass: "bg-primary" },
  "Financial/Legal": { badgeVariant: "secondary", dotClass: "bg-accent" },
  "Personal/Social": { badgeVariant: "outline", dotClass: "bg-muted-foreground" },
  "Other": { badgeVariant: "outline", dotClass: "bg-border" },
};

const CalendarPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { groupId = "demo" } = useParams();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [activeView, setActiveView] = useState<"month" | "week" | "agenda">("month");
  const [categoryFilter, setCategoryFilter] = useState<"all" | Category>("all");

  // New/Edit dialog
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [formDate, setFormDate] = useState<Date | undefined>(new Date());
  const [formTime, setFormTime] = useState<string>("09:00");
  const [formTitle, setFormTitle] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formCategory, setFormCategory] = useState<Category | undefined>(undefined);
  const [formAttending, setFormAttending] = useState<string>("");
  const [formReminderDays, setFormReminderDays] = useState<string>("1");
  const [formOutcome, setFormOutcome] = useState("");

  const isDemo = groupId === "demo";

  const loadAppointments = async () => {
    if (isDemo) {
      // Demo data
      const now = new Date();
      const demo: Appointment[] = [
        {
          id: "d1",
          date_time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30).toISOString(),
          location: "Mercy Hospital",
          category: "Medical",
          description: "Checkup with Dr. Lee",
          attending_user_id: null,
          group_id: groupId,
          outcome_notes: null,
          reminder_days_before: 1,
          created_by_user_id: null,
          created_by_email: "demo@example.com",
        },
        {
          id: "d2",
          date_time: addDays(now, 2).toISOString(),
          location: "Zoom",
          category: "Financial/Legal",
          description: "Meet with attorney",
          attending_user_id: null,
          group_id: groupId,
          outcome_notes: null,
          reminder_days_before: 1,
          created_by_user_id: null,
          created_by_email: "demo@example.com",
        },
      ];
      setAppointments(demo);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, date_time, location, category, description, attending_user_id, group_id, outcome_notes, reminder_days_before, created_by_user_id, created_by_email")
        .eq("group_id", groupId)
        .order("date_time", { ascending: true });
      if (error) throw error;
      setAppointments((data as Appointment[]) || []);
    } catch (err: any) {
      console.error("Failed to load appointments", err);
      toast({ title: "Error", description: "Could not load appointments." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const filtered = useMemo(() => {
    return appointments.filter((a) => (categoryFilter === "all" ? true : (a.category || "Other") === categoryFilter));
  }, [appointments, categoryFilter]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(viewDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [viewDate]);

  const onOpenNew = () => {
    setEditing(null);
    setFormTitle("");
    setFormLocation("");
    setFormCategory(undefined);
    setFormAttending("");
    setFormReminderDays("1");
    setFormOutcome("");
    setFormDate(new Date());
    setFormTime("09:00");
    setOpenDialog(true);
  };

  const onEdit = (appt: Appointment) => {
    setEditing(appt);
    const dt = parseISO(appt.date_time);
    setFormDate(dt);
    setFormTime(format(dt, "HH:mm"));
    setFormTitle(appt.description || "");
    setFormLocation(appt.location || "");
    setFormCategory(((appt.category as Category) || undefined));
    setFormAttending(appt.attending_user_id || "");
    setFormReminderDays(String(appt.reminder_days_before ?? ""));
    setFormOutcome(appt.outcome_notes || "");
    setOpenDialog(true);
  };

  const composeISO = (date?: Date, time?: string) => {
    if (!date || !time) return undefined;
    const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
    const d = new Date(date);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  };

  const upsertAppointment = async () => {
    if (isDemo) {
      toast({ title: "Demo mode", description: "Create a real care group to add appointments." });
      setOpenDialog(false);
      return;
    }
    if (!formDate || !formTime || !formTitle) {
      toast({ title: "Missing info", description: "Please add date, time and title." });
      return;
    }
    const iso = composeISO(formDate, formTime);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const userEmail = (await supabase.auth.getUser()).data.user?.email;
      const payload: any = {
        ...(editing?.id ? { id: editing.id } : {}),
        group_id: groupId,
        date_time: iso as string,
        location: formLocation || null,
        category: formCategory || "Other",
        description: formTitle,
        attending_user_id: formAttending ? formAttending : null,
        reminder_days_before: formReminderDays ? parseInt(formReminderDays, 10) : null,
        outcome_notes: formOutcome || null,
      };
      if (!editing?.id && userId) payload.created_by_user_id = userId;
      if (!editing?.id && userEmail) payload.created_by_email = userEmail;

      const { error } = await supabase.from("appointments").upsert(payload as any, { onConflict: "id" });
      if (error) throw error;
      if (iso) setViewDate(parseISO(iso));
      setEditing(null);
      toast({ title: editing ? "Appointment updated" : "Appointment created" });
      setOpenDialog(false);
      await loadAppointments();
    } catch (err: any) {
      console.error("Failed to save appointment", err);
      toast({ title: "Error", description: "Could not save appointment." });
    }
  };

  const deleteAppointment = async (id: string) => {
    if (isDemo) {
      toast({ title: "Demo mode", description: "Create a real care group to delete appointments." });
      return;
    }
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Appointment deleted" });
      await loadAppointments();
    } catch (err: any) {
      console.error("Failed to delete", err);
      toast({ title: "Error", description: "Could not delete appointment." });
    }
  };

  const createFollowUpTask = async (appt: Appointment) => {
    if (isDemo) {
      toast({ title: "Demo mode", description: "Create a real care group to create tasks." });
      return;
    }
    try {
      const due = addWeeks(parseISO(appt.date_time), 1);
      const payload = {
        group_id: groupId,
        title: `Follow-up: ${appt.description ?? "Appointment"}`,
        description: appt.outcome_notes ?? "",
        category: appt.category ?? "Other",
        due_date: format(due, "yyyy-MM-dd"),
        status: "open",
      } as any;
      const { error } = await supabase.from("tasks").insert(payload);
      if (error) throw error;
      toast({ title: "Follow-up task created" });
      navigate(`/app/${groupId}/tasks`);
    } catch (err: any) {
      console.error("Failed to create task", err);
      toast({ title: "Error", description: "Could not create follow-up." });
    }
  };

  const downloadIcs = (appt: Appointment) => {
    const start = parseISO(appt.date_time);
    const dtstamp = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
    const dtstart = format(start, "yyyyMMdd'T'HHmmss'Z'");
    const dtend = format(addDays(start, 0), "yyyyMMdd'T'HHmmss'Z'");
    const title = (appt.description || "Appointment").replace(/\n/g, " ");
    const loc = (appt.location || "").replace(/\n/g, ", ");
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//DaveAssist//Calendar//EN\nBEGIN:VEVENT\nUID:${appt.id}\nDTSTAMP:${dtstamp}\nDTSTART:${dtstart}\nDTEND:${dtend}\nSUMMARY:${title}\nLOCATION:${loc}\nEND:VEVENT\nEND:VCALENDAR`;
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const MonthView = () => (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start w-full md:w-auto"><CalendarIcon className="mr-2 h-4 w-4" /> {format(viewDate, "PPP")}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <DatePicker mode="single" selected={viewDate} onSelect={(d) => d && setViewDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <p className="text-sm text-muted-foreground mt-2">Select a date to focus the list of events.</p>
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="md:col-span-2 grid gap-4">
        {filtered
          .filter((a) => isSameDay(parseISO(a.date_time), viewDate))
          .sort((a, b) => compareAsc(parseISO(a.date_time), parseISO(b.date_time)))
          .map((a) => (
            <Card key={a.id} className="border-l-4">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  {(a.category && categoryToToken[a.category as Category]) ? (
                    <span className={cn("h-2 w-2 rounded-full", categoryToToken[a.category as Category].dotClass)} aria-hidden />
                  ) : null}
                  {a.description || "Appointment"}
                  {a.category && (
                    <Badge variant={categoryToToken[a.category as Category]?.badgeVariant ?? "outline"}>{a.category}</Badge>
                  )}
                  {isBefore(parseISO(a.date_time), new Date()) && a.outcome_notes && (
                    <Badge variant="secondary">Outcome recorded</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>{format(parseISO(a.date_time), "EEE, p")} • {a.location || "No location"}</p>
                <p className="text-xs">Created by: {a.created_by_email || "Unknown"}</p>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => onEdit(a)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => downloadIcs(a)}>Add to my Calendar</Button>
                  <Button size="sm" variant="ghost" onClick={() => createFollowUpTask(a)}>Create follow-up task</Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteAppointment(a.id)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        {filtered.filter((a) => isSameDay(parseISO(a.date_time), viewDate)).length === 0 && (
          <p className="text-sm text-muted-foreground">No events for this date.</p>
        )}
      </div>
    </div>
  );

  const WeekView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setViewDate(addDays(viewDate, -7))}>Previous</Button>
          <Button variant="outline" onClick={() => setViewDate(addDays(viewDate, 7))}>Next</Button>
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day) => (
          <div key={day.toISOString()} className="rounded-md border p-2">
            <div className="text-sm font-medium">{format(day, "EEE d")}</div>
            <div className="mt-2 space-y-2">
              {filtered
                .filter((a) => isSameDay(parseISO(a.date_time), day))
                .sort((a, b) => compareAsc(parseISO(a.date_time), parseISO(b.date_time)))
                .map((a) => (
                  <button key={a.id} onClick={() => onEdit(a)} className="w-full text-left text-xs rounded-md border p-2 hover:bg-muted transition">
                    <div className="flex items-center gap-2">
                      {a.category && <span className={cn("h-1.5 w-1.5 rounded-full", categoryToToken[a.category as Category]?.dotClass)} />}
                      <span className="font-medium">{format(parseISO(a.date_time), "p")}</span>
                      <span className="truncate">{a.description}</span>
                    </div>
                    {a.location && <div className="text-muted-foreground truncate">{a.location}</div>}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const AgendaView = () => (
    <div className="space-y-3">
      {filtered
        .sort((a, b) => compareAsc(parseISO(a.date_time), parseISO(b.date_time)))
        .map((a) => (
          <Card key={a.id} className="border-l-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {(a.category && categoryToToken[a.category as Category]) ? (
                  <span className={cn("h-2 w-2 rounded-full", categoryToToken[a.category as Category].dotClass)} aria-hidden />
                ) : null}
                {a.description || "Appointment"}
                {a.category && (
                  <Badge variant={categoryToToken[a.category as Category]?.badgeVariant ?? "outline"}>{a.category}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>{format(parseISO(a.date_time), "PPPP p")} • {a.location || "No location"}</p>
              <p className="text-xs">Created by: {a.created_by_email || "Unknown"}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(a)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => downloadIcs(a)}>Add to my Calendar</Button>
                <Button size="sm" variant="ghost" onClick={() => createFollowUpTask(a)}>Create follow-up task</Button>
                <Button size="sm" variant="destructive" onClick={() => deleteAppointment(a.id)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No appointments yet.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <SEO title="Calendar — DaveAssist" description="Shared appointments for your care group." />
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Shared Calendar</h1>
        <div className="flex gap-2">
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button variant="hero" onClick={onOpenNew}><Plus className="mr-2 h-4 w-4" /> New appointment</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit appointment" : "New appointment"}</DialogTitle>
              </DialogHeader>
              {isDemo && (
                <div className="text-sm text-muted-foreground">You are viewing the demo group. Create or switch to a real group to save appointments.</div>
              )}
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title/Description</Label>
                  <Input id="title" placeholder="e.g. Cardiology check-up with Dr. Smith" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start font-normal", !formDate && "text-muted-foreground")}> <CalendarIcon className="mr-2 h-4 w-4" /> {formDate ? format(formDate, "PPP") : <span>Pick a date</span>} </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <DatePicker mode="single" selected={formDate} onSelect={setFormDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="time">Time</Label>
                    <Input id="time" type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="Address or virtual/phone" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select value={formCategory} onValueChange={(v) => setFormCategory(v as Category)}>
                      <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="attending">Attending (optional)</Label>
                    <Input id="attending" placeholder="User ID (optional)" value={formAttending} onChange={(e) => setFormAttending(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="reminder">Reminder (days before)</Label>
                    <Input id="reminder" type="number" min={0} value={formReminderDays} onChange={(e) => setFormReminderDays(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="outcome">Outcome notes (after event)</Label>
                  <Textarea id="outcome" placeholder="Add notes or outcomes after the appointment" value={formOutcome} onChange={(e) => setFormOutcome(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled><Upload className="mr-2 h-4 w-4" /> Add attachment (coming soon)</Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setOpenDialog(false)}>Cancel</Button>
                <Button onClick={upsertAppointment}>{editing ? "Save changes" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={loadAppointments}>Refresh</Button>
        </div>
      </header>

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
        <TabsList>
          <TabsTrigger value="month" className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Month</TabsTrigger>
          <TabsTrigger value="week" className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Week</TabsTrigger>
          <TabsTrigger value="agenda" className="flex items-center gap-2"><List className="h-4 w-4" /> Agenda</TabsTrigger>
        </TabsList>
        <TabsContent value="month"><MonthView /></TabsContent>
        <TabsContent value="week"><WeekView /></TabsContent>
        <TabsContent value="agenda"><AgendaView /></TabsContent>
      </Tabs>
    </div>
  );
};

export default CalendarPage;
