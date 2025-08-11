import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ImmediatePayload = {
  type: "immediate";
  entity: "appointments" | "tasks" | "documents" | "activity_logs";
  group_id: string;
  item_id: string;
  baseUrl?: string;
};

type RequestBody = ImmediatePayload; // Extend later if needed

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!SUPABASE_URL) console.warn("SUPABASE_URL is not set");
if (!SERVICE_ROLE) console.warn("SUPABASE_SERVICE_ROLE_KEY is not set");
if (!Deno.env.get("RESEND_API_KEY")) console.warn("RESEND_API_KEY is not set");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (body.type !== "immediate") {
      return new Response(JSON.stringify({ error: "Unsupported type" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Map entity -> preference flag + detail query
    const prefFlag: Record<ImmediatePayload["entity"], string> = {
      appointments: "notify_on_new_appointment",
      tasks: "notify_on_new_task",
      documents: "notify_on_new_document",
      activity_logs: "notify_on_new_activity_log",
    };

    // 1) Load recipients from notification_preferences
    const { data: prefs, error: prefErr } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .eq("group_id", body.group_id)
      .eq(prefFlag[body.entity], true);
    if (prefErr) throw prefErr;

    const prefUserIds = (prefs || []).map((p: any) => p.user_id).filter(Boolean);

    // 2) Resolve emails from profiles
    let emails: { user_id: string; email: string }[] = [];
    if (prefUserIds.length > 0) {
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, email")
        .in("user_id", prefUserIds);
      if (profErr) throw profErr;
      emails = (profs || [])
        .filter((p: any) => !!p.email)
        .map((p: any) => ({ user_id: p.user_id as string, email: p.email as string }));
    }

    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "No recipients" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 3) Load a few details for nicer subject/body
    let subject = "New item";
    let description = "";
    let when: string | null = null;

    switch (body.entity) {
      case "appointments": {
        const { data, error } = await supabase
          .from("appointments")
          .select("description, location, date_time")
          .eq("id", body.item_id)
          .maybeSingle();
        if (error) throw error;
        subject = `New appointment: ${data?.description ?? "Appointment"}`;
        description = [data?.location, data?.description].filter(Boolean).join(" • ");
        when = data?.date_time ?? null;
        break;
      }
      case "tasks": {
        const { data, error } = await supabase
          .from("tasks")
          .select("title, due_date")
          .eq("id", body.item_id)
          .maybeSingle();
        if (error) throw error;
        subject = `New task: ${data?.title ?? "Task"}`;
        description = data?.title ?? "Task";
        when = data?.due_date ?? null;
        break;
      }
      case "documents": {
        const { data, error } = await supabase
          .from("documents")
          .select("title, category")
          .eq("id", body.item_id)
          .maybeSingle();
        if (error) throw error;
        subject = `New document: ${data?.title ?? "Document"}`;
        description = [data?.title, data?.category].filter(Boolean).join(" • ");
        break;
      }
      case "activity_logs": {
        const { data, error } = await supabase
          .from("activity_logs")
          .select("title, type, date_time")
          .eq("id", body.item_id)
          .maybeSingle();
        if (error) throw error;
        subject = `New activity: ${data?.title ?? "Update"}`;
        description = [data?.type, data?.title].filter(Boolean).join(" • ");
        when = data?.date_time ?? null;
        break;
      }
    }

    const link = body.baseUrl
      ? `${body.baseUrl}/app/${body.group_id}?openId=${encodeURIComponent(body.item_id)}`
      : undefined;

    const html = `
      <div>
        <h2 style="margin:0 0 8px 0;">${subject}</h2>
        ${when ? `<p style="margin:0 0 8px 0;">When: ${new Date(when).toLocaleString()}</p>` : ""}
        ${description ? `<p style="margin:0 0 12px 0; color:#555;">${description}</p>` : ""}
        ${link ? `<p><a href="${link}">Open in DaveAssist</a></p>` : ""}
      </div>
    `;

    // 4) Send emails (individually to avoid exposing addresses)
    const results = await Promise.allSettled(
      emails.map((e) =>
        resend.emails.send({
          from: "DaveAssist <onboarding@resend.dev>",
          to: [e.email],
          subject,
          html,
        })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;

    console.log("notify summary", { sent, failed, entity: body.entity, group: body.group_id, item: body.item_id });

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("notify error", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
