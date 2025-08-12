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

type FeedbackNewPayload = {
  type: "feedback-new";
  feedback_id: string;
  baseUrl?: string;
};

type FeedbackUpdatePayload = {
  type: "feedback-update";
  feedback_id: string;
  update_type: "status" | "comment";
  baseUrl?: string;
};

type RequestBody = ImmediatePayload | FeedbackNewPayload | FeedbackUpdatePayload;

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
    
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (body.type === "immediate") {
      return await handleImmediateNotification(body, supabase);
    } else if (body.type === "feedback-new") {
      return await handleFeedbackNewNotification(body, supabase);
    } else if (body.type === "feedback-update") {
      return await handleFeedbackUpdateNotification(body, supabase);
    } else {
      return new Response(JSON.stringify({ error: "Unsupported type" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  } catch (error: any) {
    console.error("notify error", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

async function handleImmediateNotification(body: ImmediatePayload, supabase: any) {
  console.log('🔔 Starting immediate notification process:', {
    entity: body.entity,
    group_id: body.group_id,
    item_id: body.item_id
  });

  // Map entity -> preference flag + detail query
  const prefFlag: Record<ImmediatePayload["entity"], string> = {
    appointments: "notify_on_new_appointment",
    tasks: "notify_on_new_task",
    documents: "notify_on_new_document",
    activity_logs: "notify_on_new_activity_log",
  };

  console.log('📊 Looking for users with preference:', prefFlag[body.entity]);

  // 1) Load recipients from notification_preferences
  const { data: prefs, error: prefErr } = await supabase
    .from("notification_preferences")
    .select("user_id")
    .eq("group_id", body.group_id)
    .eq(prefFlag[body.entity], true);
  
  console.log('🎯 Notification preferences query result:', { prefs, prefErr });
  
  if (prefErr) {
    console.error('❌ Failed to fetch notification preferences:', prefErr);
    throw prefErr;
  }

  const prefUserIds = (prefs || []).map((p: any) => p.user_id).filter(Boolean);
  console.log('👥 Users with notification preferences enabled:', prefUserIds);

  // 2) Resolve emails from profiles
  let emails: { user_id: string; email: string }[] = [];
  if (prefUserIds.length > 0) {
    console.log('📧 Fetching email addresses for users:', prefUserIds);
    const { data: profs, error: profErr } = await supabase
      .from("profiles")
      .select("user_id, email")
      .in("user_id", prefUserIds);
    
    console.log('📬 Profiles query result:', { profs, profErr });
    
    if (profErr) {
      console.error('❌ Failed to fetch user profiles:', profErr);
      throw profErr;
    }
    
    emails = (profs || [])
      .filter((p: any) => !!p.email)
      .map((p: any) => ({ user_id: p.user_id as string, email: p.email as string }));
  }

  console.log('✅ Final email recipients:', emails);

  if (emails.length === 0) {
    console.warn('⚠️ No email recipients found');
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

  console.log('📮 Sending emails to recipients...', { 
    emailCount: emails.length, 
    subject,
    recipients: emails.map(e => e.email)
  });

  // 4) Send emails (individually to avoid exposing addresses)
  const results = await Promise.allSettled(
    emails.map(async (e) => {
      console.log(`📤 Sending email to: ${e.email}`);
      const result = await resend.emails.send({
        from: "DaveAssist <onboarding@resend.dev>",
        to: [e.email],
        subject,
        html,
      });
      console.log(`📬 Email result for ${e.email}:`, result);
      return result;
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;
  
  // Log failed emails for debugging
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`❌ Email failed for ${emails[index].email}:`, result.reason);
    }
  });

  console.log("📊 Notification summary", { sent, failed, entity: body.entity, group: body.group_id, item: body.item_id });

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleFeedbackNewNotification(body: FeedbackNewPayload, supabase: any) {
  try {
    // Get feedback details
    const { data: feedback, error: feedbackErr } = await supabase
      .from("feedback_items")
      .select(`
        *,
        care_group:care_group_id(name)
      `)
      .eq("id", body.feedback_id)
      .single();

    if (feedbackErr) {
      console.error("Failed to fetch feedback:", feedbackErr);
      return new Response(JSON.stringify({ sent: 0, reason: "Feedback not found" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const link = body.baseUrl
      ? `${body.baseUrl}/app/${feedback.care_group_id || 'demo'}/settings/feedback#${feedback.id}`
      : undefined;

    const groupInfo = feedback.care_group?.name ? ` (Group: ${feedback.care_group.name})` : " (General feedback)";
    
    const subject = `New ${feedback.type === 'defect' ? 'Bug Report' : 'Feature Request'}: ${feedback.title}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #333; margin-bottom: 16px;">${subject}</h2>
        
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <p style="margin: 0 0 8px 0;"><strong>Type:</strong> ${feedback.type === 'defect' ? 'Bug Report' : 'Feature Request'}</p>
          <p style="margin: 0 0 8px 0;"><strong>Severity:</strong> ${feedback.severity.charAt(0).toUpperCase() + feedback.severity.slice(1)}</p>
          <p style="margin: 0 0 8px 0;"><strong>Reporter:</strong> ${feedback.created_by_email}</p>
          <p style="margin: 0;"><strong>Group:</strong> ${feedback.care_group?.name || 'General feedback'}</p>
        </div>
        
        <div style="margin-bottom: 16px;">
          <h3 style="color: #555; margin-bottom: 8px;">Description</h3>
          <p style="color: #666; line-height: 1.5; white-space: pre-wrap;">${feedback.description}</p>
        </div>
        
        ${feedback.steps_to_reproduce ? `
          <div style="margin-bottom: 16px;">
            <h3 style="color: #555; margin-bottom: 8px;">Steps to Reproduce</h3>
            <p style="color: #666; line-height: 1.5; white-space: pre-wrap;">${feedback.steps_to_reproduce}</p>
          </div>
        ` : ''}
        
        ${feedback.expected_result ? `
          <div style="margin-bottom: 16px;">
            <h3 style="color: #555; margin-bottom: 8px;">Expected Result</h3>
            <p style="color: #666; line-height: 1.5; white-space: pre-wrap;">${feedback.expected_result}</p>
          </div>
        ` : ''}
        
        ${feedback.actual_result ? `
          <div style="margin-bottom: 16px;">
            <h3 style="color: #555; margin-bottom: 8px;">Actual Result</h3>
            <p style="color: #666; line-height: 1.5; white-space: pre-wrap;">${feedback.actual_result}</p>
          </div>
        ` : ''}
        
        ${link ? `
          <div style="margin-top: 24px;">
            <a href="${link}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Feedback Item</a>
          </div>
        ` : ''}
      </div>
    `;

    // Send to platform admin (kbburton3@gmail.com)
    const result = await resend.emails.send({
      from: "DaveAssist <onboarding@resend.dev>",
      to: ["kbburton3@gmail.com"],
      subject,
      html,
    });

    console.log("Feedback notification sent to admin:", { feedback_id: body.feedback_id, result });

    return new Response(JSON.stringify({ sent: 1, failed: 0 }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Failed to send feedback notification:", error);
    return new Response(JSON.stringify({ sent: 0, failed: 1, error: error.message }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

async function handleFeedbackUpdateNotification(body: FeedbackUpdatePayload, supabase: any) {
  try {
    // Get feedback details
    const { data: feedback, error: feedbackErr } = await supabase
      .from("feedback_items")
      .select(`
        *,
        care_group:care_group_id(name)
      `)
      .eq("id", body.feedback_id)
      .single();

    if (feedbackErr) {
      console.error("Failed to fetch feedback:", feedbackErr);
      return new Response(JSON.stringify({ sent: 0, reason: "Feedback not found" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const link = body.baseUrl
      ? `${body.baseUrl}/app/${feedback.care_group_id || 'demo'}/settings/feedback#${feedback.id}`
      : undefined;

    let subject = "";
    let bodyText = "";

    if (body.update_type === "status") {
      subject = `Feedback Status Updated: ${feedback.title}`;
      bodyText = `The status of your feedback has been updated to: <strong>${feedback.status.replace('_', ' ')}</strong>`;
    } else if (body.update_type === "comment") {
      subject = `New Comment on Feedback: ${feedback.title}`;
      bodyText = "A new comment has been added to your feedback item.";
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #333; margin-bottom: 16px;">${subject}</h2>
        
        <p style="color: #666; line-height: 1.5; margin-bottom: 16px;">${bodyText}</p>
        
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #555;">Feedback Details</h3>
          <p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${feedback.title}</p>
          <p style="margin: 0 0 8px 0;"><strong>Type:</strong> ${feedback.type === 'defect' ? 'Bug Report' : 'Feature Request'}</p>
          <p style="margin: 0 0 8px 0;"><strong>Status:</strong> ${feedback.status.replace('_', ' ').charAt(0).toUpperCase() + feedback.status.replace('_', ' ').slice(1)}</p>
          <p style="margin: 0;"><strong>Severity:</strong> ${feedback.severity.charAt(0).toUpperCase() + feedback.severity.slice(1)}</p>
        </div>
        
        ${link ? `
          <div style="margin-top: 24px;">
            <a href="${link}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Feedback Item</a>
          </div>
        ` : ''}
      </div>
    `;

    // Send to feedback reporter
    const result = await resend.emails.send({
      from: "DaveAssist <onboarding@resend.dev>",
      to: [feedback.created_by_email],
      subject,
      html,
    });

    console.log("Feedback update notification sent:", { feedback_id: body.feedback_id, update_type: body.update_type, result });

    return new Response(JSON.stringify({ sent: 1, failed: 0 }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Failed to send feedback update notification:", error);
    return new Response(JSON.stringify({ sent: 0, failed: 1, error: error.message }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}
