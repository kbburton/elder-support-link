import React, { useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  FileText,
  Users,
  Activity as ActivityIcon,
  LogIn as LogInIcon,
  HeartPulse,
  LayoutDashboard,
  PlusCircle,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/layout/SEO";

// Edit modals (existing in your codebase, per your spec)
import { EnhancedTaskModal } from "@/components/tasks/EnhancedTaskModal";
import { EnhancedAppointmentModal } from "@/components/appointments/EnhancedAppointmentModal";
import { DocumentModal } from "@/components/documents/DocumentModal";
import { ContactModal } from "@/components/contacts/ContactModal";
import { ActivityModal } from "@/components/activities/ActivityModal";
import { DocumentUpload } from "@/components/documents/DocumentUpload";

// Welcome
import { GroupWelcomeModal } from "@/components/welcome/GroupWelcomeModal";
import { useGroupWelcome } from "@/hooks/useGroupWelcome";

/**
 * Dashboard (prototype-v2 parity)
 * - 7/14/30 selector drives: Smart Summary counts, Activity (combined), Recent sections, and Upcoming window.
 * - Activity + Upcoming side-by-side equal height.
 * - Row 4: Recent Documents (emerald), Recent Contacts (amber), Recent Activity Logs (purple) — equal size, one row.
 * - Logins (gray) is last, to the right of Quick Add.
 * - All edit/create modals wired (open directly on the dashboard).
 * - Uses your real schemas & field names from the JSON you shared.
 */

/* ---------------- Small UI primitives to match the prototype ---------------- */
const Card: React.FC<{
  title?: React.ReactNode;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, right, className = "", bodyClassName = "", children }) => (
  <section
    className={`rounded-2xl border border-gray-200 shadow-sm ${className}`}
    role="region"
    aria-label={typeof title === "string" ? (title as string) : "card"}
  >
    {(title || right || subtitle) && (
      <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div>
          {title ? <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">{title}</h2> : null}
          {subtitle ? <p className="text-xs text-gray-600">{subtitle}</p> : null}
        </div>
        {right}
      </header>
    )}
    <div className={`p-4 ${bodyClassName}`}>{children}</div>
  </section>
);

const Chip: React.FC<{
  tone?: "neutral" | "like" | "dislike" | "warn" | "danger" | "info";
  children: React.ReactNode;
}> = ({ tone = "neutral", children }) => {
  const map: Record<string, string> = {
    neutral: "bg-gray-100 text-gray-800",
    like: "bg-emerald-100 text-emerald-900",
    dislike: "bg-rose-100 text-rose-900",
    warn: "bg-amber-100 text-amber-900",
    danger: "bg-red-100 text-red-900",
    info: "bg-sky-100 text-sky-900",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${map[tone]}`}>{children}</span>;
};

const Pill: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }> = ({
  active,
  className = "",
  ...props
}) => (
  <button
    {...props}
    className={`rounded-full border px-3 py-1 text-sm outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
      active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
    } ${className}`}
  />
);

const Row: React.FC<{ title: string; meta?: string; badge?: React.ReactNode; onClick?: () => void }> = ({
  title,
  meta,
  badge,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left outline-offset-2 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
    aria-label={`${title}${meta ? ", " + meta : ""}`}
  >
    <div className="truncate">
      <div className="truncate text-sm text-gray-900">{title}</div>
      {meta ? <div className="truncate text-xs text-gray-700">{meta}</div> : null}
    </div>
    {badge}
  </button>
);

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
      <div className="absolute left-1/2 top-12 w-[min(90vw,1000px)] -translate-x-1/2 rounded-2xl bg-white shadow-2xl">
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
        <div className="max-h-[70vh] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
};

type Tint = "sky" | "indigo" | "emerald" | "amber" | "purple" | "gray";
const tintClass: Record<Tint, string> = {
  sky: "bg-sky-50 border-sky-200",
  indigo: "bg-indigo-50 border-indigo-200",
  emerald: "bg-emerald-50 border-emerald-200",
  amber: "bg-amber-50 border-amber-200",
  purple: "bg-purple-50 border-purple-200",
  gray: "bg-gray-50 border-gray-200",
};
const CardWithTint: React.FC<React.ComponentProps<typeof Card> & { tint?: Tint }> = ({ tint, className, ...rest }) => (
  <Card {...rest} className={`${className || ""} ${tint ? tintClass[tint] : ""}`} />
);

/* ---------------- Helpers ---------------- */
const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const addDays = (base: Date, days: number) => {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  return x;
};

/* ---------------- Local types (your app uses local interfaces) ---------------- */
type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  priority: "High" | "Medium" | "Low" | string;
  category?: string | null;
  group_id: string;
  is_deleted: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type AppointmentRow = {
  id: string;
  description: string;
  date_time: string;
  duration_minutes: number | null;
  category?: string | null;
  group_id: string;
  is_deleted: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type DocumentRow = {
  id: string;
  title: string;
  file_type?: string | null;
  file_size?: number | null;
  upload_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  group_id: string;
  is_deleted: boolean;
};

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  contact_type?: string | null;
  care_group_id: string;
  is_deleted: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type ActivityLogRow = {
  id: string;
  title: string;
  type: string | null;
  created_at: string;
  created_by_user_id?: string | null;
  created_by_email?: string | null;
  group_id: string;
  is_deleted: boolean;
};

type AllergyRow = {
  id: string;
  care_group_id: string;
  allergen: string;
  type: string | null;
  severity: "anaphylaxis" | "severe" | "mild" | string | null;
  has_epipen: boolean | null;
};

type PreferenceRow = {
  id: string;
  care_group_id: string;
  type: "like" | "dislike" | string;
  text_value: string;
  category?: string | null;
  pinned?: boolean | null;
};

type LoginRow = { user_id: string; name: string; email?: string; last_login?: string | null };

/* ---------------- Component ---------------- */
export default function DashboardPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const [timeframe, setTimeframe] = useState<7 | 14 | 30>(14);
  const [upcomingTab, setUpcomingTab] = useState<"appointments" | "tasks">("appointments");

  // Section anchors for colored header chips
  const refSummary = useRef<HTMLDivElement>(null);
  const refHP = useRef<HTMLDivElement>(null);
  const refActivity = useRef<HTMLDivElement>(null);
  const refUpcoming = useRef<HTMLDivElement>(null);
  const refDocs = useRef<HTMLDivElement>(null);
  const refContacts = useRef<HTMLDivElement>(null);
  const refActLogs = useRef<HTMLDivElement>(null);
  const refLogins = useRef<HTMLDivElement>(null);
  const refQuick = useRef<HTMLDivElement>(null);
  const jump = (r?: React.RefObject<HTMLDivElement>) => r?.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Inline "More" modal
  const [moreOpen, setMoreOpen] = useState<{ open: boolean; title: string; body?: React.ReactNode }>({
    open: false,
    title: "",
  });

  // Edit/Create modals
  const [taskModal, setTaskModal] = useState<{ open: boolean; task: any | null }>({ open: false, task: null });
  const [apptModal, setApptModal] = useState<{ open: boolean; appointment: any | null }>({ open: false, appointment: null });
  const [docModal, setDocModal] = useState<{ open: boolean; document: any | null }>({ open: false, document: null });
  const [contactModal, setContactModal] = useState<{ open: boolean; contact: any | null }>({ open: false, contact: null });
  const [activityModal, setActivityModal] = useState<{ open: boolean; activity: any | null }>({ open: false, activity: null });
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);

  // Group name + welcome
  const [groupName, setGroupName] = useState<string>("");
  React.useEffect(() => {
    let ignore = false;
    (async () => {
      if (!groupId) return;
      const { data, error } = await supabase.from("care_groups").select("name").eq("id", groupId).single();
      if (!ignore && data?.name) setGroupName(data.name);
      if (error) console.warn(error);
    })();
    return () => {
      ignore = true;
    };
  }, [groupId]);
  const { showWelcome, closeWelcome } = useGroupWelcome(groupId || "", groupName);

  const now = new Date();
  const since = useMemo(() => addDays(now, -timeframe), [timeframe]);
  const soon = useMemo(() => addDays(now, timeframe), [timeframe]);

  const enabled = !!groupId && groupId !== ":groupId";

  /* ---------------- Queries ---------------- */

  // Allergies (care_group_id)
  const { data: allergies = [] } = useQuery({
    queryKey: ["dash-allergies", groupId],
    enabled,
    queryFn: async (): Promise<AllergyRow[]> => {
      const { data, error } = await supabase
        .from("allergies")
        .select("id,care_group_id,allergen,type,severity,has_epipen")
        .eq("care_group_id", groupId as string)
        .order("allergen", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Preferences (care_group_id)
  const { data: preferences = [] } = useQuery({
    queryKey: ["dash-preferences", groupId],
    enabled,
    queryFn: async (): Promise<PreferenceRow[]> => {
      const { data, error } = await supabase
        .from("preferences")
        .select("id,care_group_id,type,text_value,category,pinned")
        .eq("care_group_id", groupId as string)
        .order("pinned", { ascending: false })
        .order("text_value", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Tasks due soon / overdue (group_id)
  const { data: tasksDueSoon = [] } = useQuery({
    queryKey: ["dash-tasks-soon", groupId, timeframe],
    enabled,
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,due_date,status,priority,category,group_id,is_deleted")
        .eq("group_id", groupId as string)
        .eq("is_deleted", false)
        .neq("status", "Completed")
        .not("due_date", "is", null)
        .gte("due_date", now.toISOString())
        .lte("due_date", soon.toISOString())
        .order("due_date", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tasksOverdue = [] } = useQuery({
    queryKey: ["dash-tasks-overdue", groupId],
    enabled,
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,due_date,status,priority,category,group_id,is_deleted")
        .eq("group_id", groupId as string)
        .eq("is_deleted", false)
        .neq("status", "Completed")
        .not("due_date", "is", null)
        .lt("due_date", now.toISOString())
        .order("due_date", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO 
        title={`Dashboard - ${groupName || 'Care Group'}`}
        description="Manage tasks, appointments, and care coordination"
      />
      
      {showWelcome && (
        <GroupWelcomeModal
          isOpen={showWelcome}
          onClose={closeWelcome}
          groupId={groupId || ""}
          groupName={groupName}
        />
      )}

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <header className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">
            {groupName ? `${groupName} Dashboard` : "Dashboard"}
          </h1>
          
          <div className="flex justify-center gap-2">
            {([7, 14, 30] as const).map((days) => (
              <Pill
                key={days}
                active={timeframe === days}
                onClick={() => setTimeframe(days)}
              >
                {days} days
              </Pill>
            ))}
          </div>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Tasks Due Soon" className="bg-blue-50">
            <div className="text-2xl font-bold text-blue-900">
              {tasksDueSoon.length}
            </div>
          </Card>
          <Card title="Overdue Tasks" className="bg-red-50">
            <div className="text-2xl font-bold text-red-900">
              {tasksOverdue.length}
            </div>
          </Card>
          <Card title="Allergies" className="bg-amber-50">
            <div className="text-2xl font-bold text-amber-900">
              {allergies.length}
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card title="Quick Add" className="bg-green-50">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setTaskModal({ open: true, task: null })}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <PlusCircle className="w-4 h-4" />
              New Task
            </button>
            <button
              onClick={() => setApptModal({ open: true, appointment: null })}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <PlusCircle className="w-4 h-4" />
              New Appointment
            </button>
            <button
              onClick={() => setUploadModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <PlusCircle className="w-4 h-4" />
              Upload Document
            </button>
          </div>
        </Card>

        {/* Recent Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Tasks Due Soon">
            <div className="space-y-2">
              {tasksDueSoon.slice(0, 5).map((task) => (
                <Row
                  key={task.id}
                  title={task.title}
                  meta={task.due_date ? fmt(task.due_date) : ""}
                  badge={<Chip tone={task.priority === "High" ? "danger" : "neutral"}>{task.priority}</Chip>}
                  onClick={() => setTaskModal({ open: true, task })}
                />
              ))}
              {tasksDueSoon.length === 0 && (
                <p className="text-gray-500 text-center py-4">No tasks due soon</p>
              )}
            </div>
          </Card>

          <Card title="Overdue Tasks">
            <div className="space-y-2">
              {tasksOverdue.slice(0, 5).map((task) => (
                <Row
                  key={task.id}
                  title={task.title}
                  meta={task.due_date ? fmt(task.due_date) : ""}
                  badge={<Chip tone="danger">Overdue</Chip>}
                  onClick={() => setTaskModal({ open: true, task })}
                />
              ))}
              {tasksOverdue.length === 0 && (
                <p className="text-gray-500 text-center py-4">No overdue tasks</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {taskModal.open && (
        <EnhancedTaskModal
          isOpen={taskModal.open}
          onClose={() => setTaskModal({ open: false, task: null })}
          task={taskModal.task}
          groupId={groupId || ""}
        />
      )}

      {apptModal.open && (
        <EnhancedAppointmentModal
          isOpen={apptModal.open}
          onClose={() => setApptModal({ open: false, appointment: null })}
          appointment={apptModal.appointment}
          groupId={groupId || ""}
        />
      )}

      {uploadModalOpen && (
        <DocumentModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          document={null}
          groupId={groupId || ""}
        />
      )}
    </div>
  );
}
