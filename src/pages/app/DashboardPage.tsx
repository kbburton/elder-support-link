import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  CheckSquare,
  FileText,
  Users,
  History,
  LogIn,
  HeartPulse,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** 
 * CARE DASHBOARD (routes adjusted for CalendarsPage)
 * - Matches the care_dashboard_prototype_v_2 look/behavior
 * - Uses ?edit=<id> navigation so section pages can auto-open their modals
 */

// 🔧 If your app uses /app/:groupId/calendars set this to "calendars".
const APPOINTMENTS_ROUTE_SEGMENT = "calendar";

/* ----------------------------- Local UI primitives ----------------------------- */
const Card: React.FC<{
  title?: React.ReactNode;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, right, className = "", bodyClassName = "", children }) => (
  <section
    className={`rounded-2xl border shadow-sm ${className}`}
    role="region"
    aria-label={typeof title === "string" ? (title as string) : "card"}
  >
    {(title || right || subtitle) && (
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          {title ? (
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              {title}
            </h2>
          ) : null}
          {subtitle ? <p className="text-xs text-gray-600">{subtitle}</p> : null}
        </div>
        {right}
      </header>
    )}
    <div className={`p-4 ${bodyClassName}`}>{children}</div>
  </section>
);

const Row: React.FC<{
  title: string;
  meta?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
}> = ({ title, meta, badge, onClick }) => (
  <button
    onClick={onClick}
    className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
    aria-label={`${title}${meta ? ", " + meta : ""}`}
  >
    <div className="truncate">
      <div className="truncate text-sm text-gray-900">{title}</div>
      {meta ? <div className="truncate text-xs text-gray-700">{meta}</div> : null}
    </div>
    {badge}
  </button>
);

const Pill: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
> = ({ active, className = "", ...props }) => (
  <button
    {...props}
    className={`rounded-full border px-3 py-1 text-sm outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
      active
        ? "bg-gray-900 text-white border-gray-900"
        : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
    } ${className}`}
  />
);

const Chip: React.FC<{
  tone?:
    | "neutral"
    | "like"
    | "dislike"
    | "warn"
    | "danger"
    | "info"
    | "indigo"
    | "sky"
    | "emerald"
    | "amber"
    | "purple";
  children: React.ReactNode;
}> = ({ tone = "neutral", children }) => {
  const map: Record<string, string> = {
    neutral: "bg-gray-100 text-gray-800",
    like: "bg-emerald-100 text-emerald-900",
    dislike: "bg-rose-100 text-rose-900",
    warn: "bg-amber-100 text-amber-900",
    danger: "bg-red-100 text-red-900",
    info: "bg-sky-100 text-sky-900",
    indigo: "bg-indigo-100 text-indigo-900",
    sky: "bg-sky-100 text-sky-900",
    emerald: "bg-emerald-100 text-emerald-900",
    amber: "bg-amber-100 text-amber-900",
    purple: "bg-purple-100 text-purple-900",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${map[tone]}`}
    >
      {children}
    </span>
  );
};

const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-12 w-[min(92vw,900px)] -translate-x-1/2 rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            aria-label="Close"
          >
            Close
          </button>
        </header>
        <div className="max-h-[65vh] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
};

/* ----------------------------- Local types ----------------------------- */
type UUID = string;

type Task = {
  id: UUID;
  group_id: UUID;
  title: string;
  description?: string | null;
  category?: string | null;
  due_date: string | null;
  priority?: "High" | "Medium" | "Low" | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_deleted?: boolean | null;
};

type Appointment = {
  id: UUID;
  group_id: UUID;
  description: string | null;
  category: string | null;
  date_time: string;
  duration_minutes: number | null;
  created_at?: string | null;
  is_deleted?: boolean | null;
};

type Document = {
  id: UUID;
  group_id: UUID;
  title: string;
  file_type?: string | null;
  file_size?: number | null;
  original_filename?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  upload_date?: string | null;
  is_deleted?: boolean | null;
};

type Contact = {
  id: UUID;
  care_group_id: UUID;
  first_name?: string | null;
  last_name?: string | null;
  organization_name?: string | null;
  contact_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_deleted?: boolean | null;
};

type ActivityLog = {
  id: UUID;
  group_id: UUID;
  created_by_user_id: UUID | null;
  title: string | null;
  type: string | null;
  date_time?: string | null;
  created_at?: string | null;
  is_deleted?: boolean | null;
};

type Profile = {
  user_id: UUID;
  first_name?: string | null;
  last_name?: string | null;
  last_login?: string | null;
};

type Allergy = {
  id: UUID;
  care_group_id: UUID;
  allergen: string;
  type?: string | null;
  severity?: string | null;
};

type Preference = {
  id: UUID;
  care_group_id: UUID;
  type: "like" | "dislike";
  text_value: string;
};

type Group = { id: UUID; name: string };

/* ----------------------------- Helpers ----------------------------- */
const toISO = (d: Date) => d.toISOString();
const fromNowMinusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};
const fromNowPlusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};
const fmt = (v: string | Date | null | undefined) =>
  v
    ? new Date(v).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

/* ----------------------------- Component ----------------------------- */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const gid = groupId || "";

  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(14);
  const [tabUpcoming, setTabUpcoming] = useState<"appointments" | "tasks">(
    "appointments"
  );

  const [group, setGroup] = useState<Group | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [moreOpen, setMoreOpen] = useState<null | { title: string; content: React.ReactNode }>(null);

  const summaryRef = useRef<HTMLDivElement>(null);
  const hpRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const upcomingRef = useRef<HTMLDivElement>(null);
  const docsRef = useRef<HTMLDivElement>(null);
  const contactsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gid) return;
    const fetchAll = async () => {
      setLoading(true);
      setErrorText(null);
      try {
        const { data: g, error: gErr } = await supabase
          .from("care_groups")
          .select("id,name")
          .eq("id", gid)
          .single();
        if (gErr) throw gErr;
        setGroup(g as Group);

        const [
          tasksRes,
          apptsRes,
          docsRes,
          contactsRes,
          actsRes,
          allergiesRes,
          prefsRes,
        ] = await Promise.all([
          supabase
            .from("tasks")
            .select(
              "id,group_id,title,description,category,due_date,priority,status,created_at,updated_at,is_deleted"
            )
            .eq("group_id", gid),
          supabase
            .from("appointments")
            .select(
              "id,group_id,description,category,date_time,duration_minutes,created_at,is_deleted"
            )
            .eq("group_id", gid),
          supabase
            .from("documents")
            .select(
              "id,group_id,title,file_type,file_size,original_filename,created_at,updated_at,upload_date,is_deleted"
            )
            .eq("group_id", gid),
          supabase
            .from("contacts")
            .select(
              "id,care_group_id,first_name,last_name,organization_name,contact_type,created_at,updated_at,is_deleted"
            )
            .eq("care_group_id", gid),
          supabase
            .from("activity_logs")
            .select(
              "id,group_id,created_by_user_id,title,type,date_time,created_at,is_deleted"
            )
            .eq("group_id", gid),
          supabase
            .from("allergies")
            .select("id,care_group_id,allergen,type,severity")
            .eq("care_group_id", gid),
          supabase
            .from("preferences")
            .select("id,care_group_id,type,text_value")
            .eq("care_group_id", gid),
        ]);

        if (tasksRes.error) throw tasksRes.error;
        if (apptsRes.error) throw apptsRes.error;
        if (docsRes.error) throw docsRes.error;
        if (contactsRes.error) throw contactsRes.error;
        if (actsRes.error) throw actsRes.error;
        if (allergiesRes.error) throw allergiesRes.error;
        if (prefsRes.error) throw prefsRes.error;

        const cleanTasks = (tasksRes.data as Task[]).filter((t) => !t.is_deleted);
        const cleanAppts = (apptsRes.data as Appointment[]).filter((a) => !a.is_deleted);
        const cleanDocs = (docsRes.data as Document[]).filter((d) => !d.is_deleted);
        const cleanContacts = (contactsRes.data as Contact[]).filter((c) => !c.is_deleted);
        const cleanActs = (actsRes.data as ActivityLog[]).filter((a) => !a.is_deleted);

        setTasks(cleanTasks);
        setAppts(cleanAppts);
        setDocs(cleanDocs);
        setContacts(cleanContacts);
        setActivities(cleanActs);
        setAllergies(allergiesRes.data as Allergy[]);
        setPrefs(prefsRes.data as Preference[]);

        const { data: members, error: memErr } = await supabase.rpc("get_group_members", {
          p_group_id: gid,
        });
        if (memErr) throw memErr;

        const memberIds: UUID[] = (members || []).map((m: any) => m.user_id);
        if (memberIds.length) {
          const { data: profs, error: profErr } = await supabase
            .from("profiles")
            .select("user_id,first_name,last_name,last_login")
            .in("user_id", memberIds);
          if (profErr) throw profErr;
          setProfiles((profs as Profile[]) || []);
        } else {
          setProfiles([]);
        }
      } catch (e: any) {
        console.error(e);
        setErrorText(e.message ?? "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [gid]);

  const now = new Date();
  const lookbackFrom = useMemo(() => fromNowMinusDays(windowDays), [windowDays]);
  const lookaheadTo = useMemo(() => fromNowPlusDays(windowDays), [windowDays]);

  const tasksDueSoon = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            t.due_date &&
            new Date(t.due_date) >= now &&
            new Date(t.due_date) <= lookaheadTo &&
            (t.status || "Open") !== "Completed"
        )
        .sort(
          (a, b) =>
            new Date(a.due_date || 0).getTime() -
            new Date(b.due_date || 0).getTime()
        ),
    [tasks, lookaheadTo]
  );

  const tasksOverdue = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            t.due_date &&
            new Date(t.due_date) < now &&
            (t.status || "Open") !== "Completed"
        )
        .sort(
          (a, b) =>
            new Date(b.due_date || 0).getTime() -
            new Date(a.due_date || 0).getTime()
        ),
    [tasks]
  );

  const apptsSoon = useMemo(
    () =>
      appts
        .filter(
          (a) =>
            a.date_time &&
            new Date(a.date_time) >= now &&
            new Date(a.date_time) <= lookaheadTo
        )
        .sort(
          (a, b) =>
            new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
        ),
    [appts, lookaheadTo]
  );

  const isRecent = (created_at?: string | null, updated_at?: string | null) => {
    const createdOK = created_at ? new Date(created_at) >= lookbackFrom : false;
    const updatedOK = updated_at ? new Date(updated_at) >= lookbackFrom : false;
    return createdOK || updatedOK;
  };

  const recentDocs = useMemo(
    () => docs.filter((d) => isRecent(d.created_at, d.updated_at)),
    [docs, lookbackFrom]
  );
  const recentContacts = useMemo(
    () => contacts.filter((c) => isRecent(c.created_at, c.updated_at)),
    [contacts, lookbackFrom]
  );
  const recentTasks = useMemo(
    () => tasks.filter((t) => isRecent(t.created_at, t.updated_at)),
    [tasks, lookbackFrom]
  );
  const recentAppts = useMemo(
    () => appts.filter((a) => isRecent(a.created_at, a.created_at)),
    [appts, lookbackFrom]
  );
  const recentActs = useMemo(
    () => activities.filter((a) => isRecent(a.created_at, a.created_at)),
    [activities, lookbackFrom]
  );

  type FeedItem = {
    id: UUID;
    type: "Document" | "Contact" | "Appointment" | "Task" | "Activity";
    title: string;
    when: Date;
    meta?: string;
    open: () => void;
  };

  const nameForUser = (uid?: UUID | null) => {
    if (!uid) return "Unknown";
    const p = profiles.find((x) => x.user_id === uid);
    const full = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
    return full || "Unknown";
  };

  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [];

    recentDocs.forEach((d) =>
      items.push({
        id: d.id,
        type: "Document",
        title: d.title,
        when: new Date(d.updated_at || d.created_at || d.upload_date || now),
        meta: `${d.file_type || "File"} · ${fmt(
          d.updated_at || d.created_at || d.upload_date
        )}`,
        open: () => navigate(`/app/${gid}/documents?edit=${d.id}`),
      })
    );

    recentContacts.forEach((c) => {
      const label =
        c.first_name || c.last_name
          ? [c.first_name, c.last_name].filter(Boolean).join(" ")
          : c.organization_name || "Contact";
      items.push({
        id: c.id,
        type: "Contact",
        title: label,
        when: new Date(c.updated_at || c.created_at || now),
        meta: `${c.contact_type || "contact"} · ${fmt(
          c.updated_at || c.created_at
        )}`,
        open: () => navigate(`/app/${gid}/contacts?edit=${c.id}`),
      });
    });

    recentAppts.forEach((a) =>
      items.push({
        id: a.id,
        type: "Appointment",
        title: a.description || "Appointment",
        when: new Date(a.created_at || now),
        meta: `${a.category || "Appointment"} · ${fmt(
          a.created_at
        )}`,
        open: () => navigate(`/app/${gid}/${APPOINTMENTS_ROUTE_SEGMENT}?edit=${a.id}`),
      })
    );

    recentTasks.forEach((t) =>
      items.push({
        id: t.id,
        type: "Task",
        title: t.title,
        when: new Date(t.updated_at || t.created_at || now),
        meta: `${t.category || "Task"} · ${fmt(t.updated_at || t.created_at)}`,
        open: () => navigate(`/app/${gid}/tasks?edit=${t.id}`),
      })
    );

    recentActs.forEach((a) =>
      items.push({
        id: a.id,
        type: "Activity",
        title: a.title || "Activity log",
        when: new Date(a.created_at || a.date_time || now),
        meta: `${nameForUser(a.created_by_user_id)} · ${fmt(
          a.created_at || a.date_time
        )}`,
        open: () => navigate(`/app/${gid}/activity?edit=${a.id}`),
      })
    );

    return items.sort((x, y) => +y.when - +x.when);
  }, [
    gid,
    recentDocs,
    recentContacts,
    recentAppts,
    recentTasks,
    recentActs,
    profiles,
    navigate,
  ]);

  const summary = useMemo(
    () => ({
      apptsSoon: apptsSoon.length,
      dueSoon: tasksDueSoon.length,
      overdue: tasksOverdue.length,
      newDocs: recentDocs.length,
      newContacts: recentContacts.length,
      newActivity:
        recentDocs.length +
        recentContacts.length +
        recentAppts.length +
        recentTasks.length +
        recentActs.length,
    }),
    [
      apptsSoon.length,
      tasksDueSoon.length,
      tasksOverdue.length,
      recentDocs.length,
      recentContacts.length,
      recentAppts.length,
      recentTasks.length,
      recentActs.length,
    ]
  );

  const recentLogins = useMemo(
    () =>
      profiles
        .filter((p) => p.last_login && new Date(p.last_login) >= lookbackFrom)
        .sort(
          (a, b) =>
            new Date(b.last_login || 0).getTime() -
            new Date(a.last_login || 0).getTime()
        ),
    [profiles, lookbackFrom]
  );

  const openMoreModal = (title: string, nodes: React.ReactNode) =>
    setMoreOpen({ title, content: nodes });
  const closeMore = () => setMoreOpen(null);
  const jump = (ref?: React.RefObject<HTMLDivElement>) =>
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const cardTint = {
    summary: "bg-gray-50 border-gray-200",
    health: "bg-gray-50 border-gray-200",
    activity: "bg-gray-50 border-gray-200",
    upcomingAppts: "bg-sky-50 border-sky-200",
    upcomingTasks: "bg-indigo-50 border-indigo-200",
    documents: "bg-emerald-50 border-emerald-200",
    contacts: "bg-amber-50 border-amber-200",
    activityLogs: "bg-purple-50 border-purple-200",
    logins: "bg-gray-50 border-gray-200",
    quick: "bg-gray-50 border-gray-200",
  } as const;

  const SectionNav: React.FC = () => (
    <nav className="mt-3 flex flex-wrap gap-2" aria-label="Section navigation">
      <button className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-sm text-gray-900 hover:bg-gray-100" onClick={() => jump(summaryRef)}>Summary</button>
      <button className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-sm text-gray-900 hover:bg-gray-100" onClick={() => jump(hpRef)}>Health & prefs</button>
      <button className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-sm text-gray-900 hover:bg-gray-100" onClick={() => jump(activityRef)}>Activity</button>
      <button
        className={`rounded-full border px-3 py-1 text-sm ${
          tabUpcoming === "appointments"
            ? "border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100"
            : "border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
        }`}
        onClick={() => jump(upcomingRef)}
      >
        Upcoming
      </button>
      <button className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm text-emerald-900 hover:bg-emerald-100" onClick={() => jump(docsRef)}>Documents</button>
      <button className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-900 hover:bg-amber-100" onClick={() => jump(contactsRef)}>Contacts & Activity logs</button>
    </nav>
  );

  if (!gid) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-700">Missing groupId in route. Navigate via /app/:groupId.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 p-[1px]">
        <div className="rounded-2xl bg-white px-5 py-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Dashboard for {group?.name || "Care group"}
              </h1>
              <p className="text-sm text-gray-700">
                Snapshot of the last {windowDays} days • Upcoming shows the next {windowDays} days
              </p>
            </div>
            <div className="flex items-center gap-2" aria-label="Select window">
              {[7, 14, 30].map((d) => (
                <Pill key={d} active={windowDays === d} onClick={() => setWindowDays(d as 7 | 14 | 30)} aria-pressed={windowDays === d}>
                  {d}d
                </Pill>
              ))}
            </div>
          </header>
          <SectionNav />
        </div>
      </div>

      {/* Smart summary */}
      <div ref={summaryRef} />
      <Card
        className={`${cardTint.summary}`}
        title={<><LayoutDashboard className="h-4 w-4" /> Smart summary</>}
        subtitle="Key signals at a glance"
        right={
          <button className="text-sm text-gray-800 hover:underline" onClick={() =>
            openMoreModal("Summary details",
              <ul className="space-y-2 text-sm">
                <li>Upcoming appointments: {summary.apptsSoon}</li>
                <li>Tasks due soon: {summary.dueSoon}</li>
                <li>Overdue: {summary.overdue}</li>
                <li>New docs: {summary.newDocs}</li>
                <li>New contacts: {summary.newContacts}</li>
                <li>New activity: {summary.newActivity}</li>
              </ul>
            )}>
            More
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <button onClick={() => { setTabUpcoming("appointments"); jump(upcomingRef); }} className="rounded-xl bg-sky-50 p-3 text-left hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
            <div className="text-xs text-sky-800">Upcoming appointments</div>
            <div className="text-2xl font-semibold text-sky-950">{summary.apptsSoon}</div>
          </button>
          <button onClick={() => { setTabUpcoming("tasks"); jump(upcomingRef); }} className="rounded-xl bg-indigo-50 p-3 text-left hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
            <div className="text-xs text-indigo-800">Tasks due soon</div>
            <div className="text-2xl font-semibold text-indigo-950">{summary.dueSoon}</div>
          </button>
          <button className="rounded-xl bg-rose-50 p-3 text-left">
            <div className="text-xs text-rose-800">Overdue</div>
            <div className="text-2xl font-semibold text-rose-950">{summary.overdue}</div>
          </button>
          <button onClick={() => jump(docsRef)} className="rounded-xl bg-emerald-50 p-3 text-left">
            <div className="text-xs text-emerald-800">New docs</div>
            <div className="text-2xl font-semibold text-emerald-950">{summary.newDocs}</div>
          </button>
          <button onClick={() => jump(contactsRef)} className="rounded-xl bg-amber-50 p-3 text-left">
            <div className="text-xs text-amber-800">New contacts</div>
            <div className="text-2xl font-semibold text-amber-950">{summary.newContacts}</div>
          </button>
          <button onClick={() => jump(activityRef)} className="rounded-xl bg-purple-50 p-3 text-left">
            <div className="text-xs text-purple-800">New activity</div>
            <div className="text-2xl font-semibold text-purple-950">{summary.newActivity}</div>
          </button>
        </div>
      </Card>

      {/* Health & preferences */}
      <div ref={hpRef} />
      <Card className={`${cardTint.health}`} title={<><HeartPulse className="h-4 w-4" /> Health & preferences</>} subtitle="Critical notes always visible">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900">Allergies:</span>
          {/* Map severities to tones */}
          {/* anaphylaxis -> danger; severe -> warn; else neutral */}
          {/* null safe */}
          {/* empty state */}
          {allergies.length === 0 && <span className="text-sm text-gray-700">None listed</span>}
          {allergies.map((a) => {
            const sev = a.severity?.toLowerCase();
            const tone = sev === "anaphylaxis" ? "danger" : sev === "severe" ? "warn" : "neutral";
            return (
              <Chip key={a.id} tone={tone as any}>
                {a.allergen}
                {a.severity ? ` • ${a.severity}` : ""}
              </Chip>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900">Preferences:</span>
          {prefs.length === 0 && <span className="text-sm text-gray-700">None listed</span>}
          {prefs.slice(0, 8).map((p) => (
            <Chip key={p.id} tone={p.type === "like" ? "like" : "dislike"}>
              {p.text_value}
            </Chip>
          ))}
        </div>
      </Card>

      {/* Activity + Upcoming */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
        <div ref={activityRef} className="lg:col-span-6">
          <Card
            className={`${cardTint.activity} min-h-[360px] h-full`}
            title={<><History className="h-4 w-4" /> Activity</>}
            subtitle={`Last ${windowDays} days · includes documents, contacts, appointments, tasks, and activities`}
            right={
              <button className="text-sm text-gray-800 hover:underline" onClick={() =>
                openMoreModal("More activity",
                  <div role="list" className="space-y-1">
                    {feed.map((f) => (
                      <Row key={`${f.type}-${f.id}`} title={f.title} meta={`${f.type} · ${fmt(f.when)}${f.meta ? ` · ${f.meta}` : ""}`} onClick={f.open} />
                    ))}
                  </div>
                )}>
                More
              </button>
            }
          >
            <div role="list" className="space-y-1">
              {feed.slice(0, 5).map((f) => (
                <Row key={`${f.type}-${f.id}`} title={f.title} meta={`${f.type} · ${fmt(f.when)}${f.meta ? ` · ${f.meta}` : ""}`} onClick={f.open} />
              ))}
              {feed.length === 0 && <div className="text-sm text-gray-800">No activity in this range.</div>}
            </div>
          </Card>
        </div>

        <div ref={upcomingRef} className="lg:col-span-6">
          <Card
            className={`${tabUpcoming === "appointments" ? cardTint.upcomingAppts : cardTint.upcomingTasks} min-h-[360px] h-full`}
            title={<><CalendarDays className="h-4 w-4" /> Upcoming (next {windowDays} days)</>}
            right={
              <div className="flex items-center gap-2">
                <div className="flex gap-1" role="tablist" aria-label="Upcoming switch">
                  <Pill active={tabUpcoming === "appointments"} onClick={() => setTabUpcoming("appointments")} aria-selected={tabUpcoming === "appointments"}>Appointments</Pill>
                  <Pill active={tabUpcoming === "tasks"} onClick={() => setTabUpcoming("tasks")} aria-selected={tabUpcoming === "tasks"}>Tasks</Pill>
                </div>
              </div>
            }
          >
            {tabUpcoming === "appointments" ? (
              <div className="space-y-1">
                {apptsSoon.slice(0, 5).map((a) => (
                  <Row
                    key={a.id}
                    title={a.description || "Appointment"}
                    meta={`${a.category || "Medical"} · ${fmt(a.date_time)}${a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}`}
                    onClick={() => navigate(`/app/${gid}/${APPOINTMENTS_ROUTE_SEGMENT}?edit=${a.id}`)}
                    badge={a.duration_minutes ? <Chip tone="info">{a.duration_minutes} min</Chip> : undefined}
                  />
                ))}
                {apptsSoon.length === 0 && <div className="text-sm text-gray-900">No appointments in the next {windowDays} days.</div>}
                {apptsSoon.length > 5 && (
                  <button
                    className="mt-2 inline-flex items-center gap-1 text-sm text-blue-700 underline"
                    onClick={() =>
                      openMoreModal("All upcoming appointments",
                        <div className="space-y-1">
                          {apptsSoon.map((a) => (
                            <Row
                              key={a.id}
                              title={a.description || "Appointment"}
                              meta={`${a.category || "Medical"} · ${fmt(a.date_time)}${a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}`}
                              onClick={() => navigate(`/app/${gid}/${APPOINTMENTS_ROUTE_SEGMENT}?edit=${a.id}`)}
                            />
                          ))}
                        </div>
                      )
                    }
                  >
                    More
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {tasksDueSoon.slice(0, 5).map((t) => (
                  <Row
                    key={t.id}
                    title={t.title}
                    meta={`${t.category || "Task"} · due ${fmt(t.due_date)}`}
                    onClick={() => navigate(`/app/${gid}/tasks?edit=${t.id}`)}
                    badge={
                      t.due_date && new Date(t.due_date) < now ? (
                        <Chip tone="danger">Overdue</Chip>
                      ) : t.priority ? (
                        <Chip tone={t.priority === "High" ? "warn" : t.priority === "Low" ? "neutral" : "indigo"}>
                          {t.priority}
                        </Chip>
                      ) : undefined
                    }
                  />
                ))}
                {tasksDueSoon.length === 0 && <div className="text-sm text-gray-900">No open tasks due in the next {windowDays} days.</div>}
                {tasksDueSoon.length > 5 && (
                  <button
                    className="mt-2 inline-flex items-center gap-1 text-sm text-blue-700 underline"
                    onClick={() =>
                      openMoreModal("All upcoming tasks",
                        <div className="space-y-1">
                          {tasksDueSoon.map((t) => (
                            <Row
                              key={t.id}
                              title={t.title}
                              meta={`${t.category || "Task"} · due ${fmt(t.due_date)}`}
                              onClick={() => navigate(`/app/${gid}/tasks?edit=${t.id}`)}
                            />
                          ))}
                        </div>
                      )
                    }
                  >
                    More
                  </button>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Documents + Contacts + Activity Logs */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
        <div ref={docsRef} className="lg:col-span-4">
          <Card
            className={`${cardTint.documents} min-h-[280px] h-full`}
            title={<><FileText className="h-4 w-4" /> Recent documents</>}
            right={
              <button className="text-sm text-gray-800 hover:underline" onClick={() =>
                openMoreModal("More documents",
                  <div className="space-y-1">
                    {recentDocs.map((d) => (
                      <Row key={d.id} title={d.title} meta={`${d.file_type || "File"} · ${fmt(d.updated_at || d.created_at || d.upload_date)}`} onClick={() => navigate(`/app/${gid}/documents?edit=${d.id}`)} />
                    ))}
                  </div>
                )}>
                More
              </button>
            }
          >
            <div className="space-y-1">
              {recentDocs.slice(0, 5).map((d) => (
                <Row key={d.id} title={d.title} meta={`${d.file_type || "File"} · ${fmt(d.updated_at || d.created_at || d.upload_date)}`} onClick={() => navigate(`/app/${gid}/documents?edit=${d.id}`)} />
              ))}
              {recentDocs.length === 0 && <div className="text-sm text-gray-900">No recent documents.</div>}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card
            className={`${cardTint.contacts} min-h-[280px] h-full`}
            title={<><Users className="h-4 w-4" /> Recent contacts</>}
            right={
              <button className="text-sm text-gray-800 hover:underline" onClick={() =>
                openMoreModal("More contacts",
                  <div className="space-y-1">
                    {recentContacts.map((c) => {
                      const title =
                        c.first_name || c.last_name
                          ? [c.first_name, c.last_name].filter(Boolean).join(" ")
                          : c.organization_name || "Contact";
                      return (
                        <Row key={c.id} title={title} meta={`${c.contact_type || "contact"} · ${fmt(c.updated_at || c.created_at)}`} onClick={() => navigate(`/app/${gid}/contacts?edit=${c.id}`)} />
                      );
                    })}
                  </div>
                )}>
                More
              </button>
            }
          >
            <div className="space-y-1">
              {recentContacts.slice(0, 5).map((c) => {
                const title =
                  c.first_name || c.last_name
                    ? [c.first_name, c.last_name].filter(Boolean).join(" ")
                    : c.organization_name || "Contact";
                return (
                  <Row key={c.id} title={title} meta={`${c.contact_type || "contact"} · ${fmt(c.updated_at || c.created_at)}`} onClick={() => navigate(`/app/${gid}/contacts?edit=${c.id}`)} />
                );
              })}
              {recentContacts.length === 0 && <div className="text-sm text-gray-900">No recent contacts.</div>}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card
            className={`${cardTint.activityLogs} min-h-[280px] h-full`}
            title={<><History className="h-4 w-4" /> Recent activity logs</>}
            right={
              <button className="text-sm text-gray-800 hover:underline" onClick={() =>
                openMoreModal("More activity logs",
                  <div className="space-y-1">
                    {recentActs.map((a) => (
                      <Row key={a.id} title={a.title || "Activity log"} meta={`${nameForUser(a.created_by_user_id)} · ${fmt(a.created_at || a.date_time)}`} onClick={() => navigate(`/app/${gid}/activity?edit=${a.id}`)} />
                    ))}
                  </div>
                )}>
                More
              </button>
            }
          >
            <div className="space-y-1">
              {recentActs.slice(0, 5).map((a) => (
                <Row key={a.id} title={a.title || "Activity log"} meta={`${nameForUser(a.created_by_user_id)} · ${fmt(a.created_at || a.date_time)}`} onClick={() => navigate(`/app/${gid}/activity?edit=${a.id}`)} />
              ))}
              {recentActs.length === 0 && <div className="text-sm text-gray-900">No recent activity logs.</div>}
            </div>
          </Card>
        </div>
      </div>

      {/* Quick Navigate + Logins */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
        <div className="lg:col-span-10">
          <Card className={`${cardTint.quick}`} title={<><ArrowRight className="h-4 w-4" /> Quick navigate</>} subtitle="Jump straight to a section">
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Appointments", to: `/app/${gid}/${APPOINTMENTS_ROUTE_SEGMENT}`, tone: "sky", Icon: CalendarDays },
                { label: "Tasks", to: `/app/${gid}/tasks`, tone: "indigo", Icon: CheckSquare },
                { label: "Documents", to: `/app/${gid}/documents`, tone: "emerald", Icon: FileText },
                { label: "Contacts", to: `/app/${gid}/contacts`, tone: "amber", Icon: Users },
                { label: "Activity logs", to: `/app/${gid}/activity`, tone: "purple", Icon: History },
              ].map(({ label, to, tone, Icon }) => {
                const toneClass =
                  tone === "sky"
                    ? "border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100"
                    : tone === "indigo"
                    ? "border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
                    : tone === "emerald"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                    : tone === "amber"
                    ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                    : "border-purple-300 bg-purple-50 text-purple-900 hover:bg-purple-100";
                return (
                  <button key={label} onClick={() => navigate(to)} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm ${toneClass}`}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className={`${cardTint.logins} min-h-[120px] h-full`} title={<><LogIn className="h-4 w-4" /> Logins (last {windowDays}d)</>}>
            <div className="space-y-1">
              {recentLogins.slice(0, 6).map((p) => (
                <Row key={p.user_id} title={[p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown"} meta={fmt(p.last_login)} />
              ))}
              {recentLogins.length === 0 && <div className="text-sm text-gray-900">No recent logins.</div>}
            </div>
          </Card>
        </div>
      </div>

      {loading && <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">Loading dashboard…</div>}
      {errorText && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errorText}</div>}

      <Modal open={!!moreOpen} onClose={() => setMoreOpen(null)} title={moreOpen?.title || ""}>
        {moreOpen?.content}
      </Modal>
    </div>
  );
}
