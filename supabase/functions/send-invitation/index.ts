import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract JWT token
    const jwt = authHeader.replace("Bearer ", "");
    
    // Verify JWT and get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) {
      console.error("User error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, groupId, resendId } = await req.json();

    // Get user profile using service role (bypassing RLS)
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('user_id', user.id)
      .single();

    const senderEmail = profile?.email || user.email;
    const senderName = profile?.first_name && profile?.last_name 
      ? `${profile.first_name} ${profile.last_name}` 
      : senderEmail;

    // Check if user is admin of the group using service role
    const { data: isAdmin, error: adminError } = await supabaseClient
      .rpc('is_user_admin_of_group', { group_uuid: groupId });

    if (adminError || !isAdmin) {
      console.error("Admin check error:", adminError);
      return new Response(JSON.stringify({ error: "Not authorized to send invitations" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get group info
    const { data: group } = await supabaseClient
      .from('care_groups')
      .select('name')
      .eq('id', groupId)
      .single();

    const groupName = group?.name || "Care Group";

    let invitationData;
    let isResend = false;

    if (resendId) {
      // Resending existing invitation
      const { data: existingInvitation, error: fetchError } = await supabaseClient
        .from('care_group_invitations')
        .select('*')
        .eq('id', resendId)
        .single();

      if (fetchError || !existingInvitation) {
        return new Response(JSON.stringify({ error: "Invitation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update the invitation with new expiration date
      const { data: updatedInvitation, error: updateError } = await supabaseClient
        .from('care_group_invitations')
        .update({ 
          expires_at: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        })
        .eq('id', resendId)
        .select()
        .single();

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(JSON.stringify({ error: "Failed to update invitation" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      invitationData = updatedInvitation;
      isResend = true;
    } else {
      // Check if email is already invited or is a member
      const { data: existingInvitation } = await supabaseClient
        .from('care_group_invitations')
        .select('*')
        .eq('group_id', groupId)
        .eq('invited_email', email)
        .eq('status', 'pending')
        .single();

      if (existingInvitation) {
        return new Response(JSON.stringify({ error: "Email already has a pending invitation" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new invitation
      const { data: newInvitation, error: insertError } = await supabaseClient
        .from('care_group_invitations')
        .insert({
          group_id: groupId,
          invited_email: email,
          invited_by_user_id: user.id,
          message: `${senderName} has invited you to join the ${groupName} care group.`,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to create invitation" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      invitationData = newInvitation;
    }

    // Create invitation link
    const inviteLink = `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovableproject.com')}/invite/accept?token=${invitationData.token}`;

    // Send email
    try {
      const emailResponse = await resend.emails.send({
        from: "Care Group <onboarding@resend.dev>",
        to: [invitationData.invited_email],
        subject: `${isResend ? 'Reminder: ' : ''}You're invited to join ${groupName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; text-align: center;">Care Group Invitation</h1>
            
            <p>Hello!</p>
            
            <p>${senderName} has ${isResend ? 'resent an' : 'sent you an'} invitation to join the <strong>${groupName}</strong> care group.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-style: italic;">"${invitationData.message}"</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" 
                 style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Accept Invitation
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              This invitation will expire on ${new Date(invitationData.expires_at).toLocaleDateString()}.
            </p>
            
            <p style="color: #666; font-size: 14px;">
              If you can't click the button above, copy and paste this link into your browser:<br>
              <a href="${inviteLink}" style="color: #007bff; word-break: break-all;">${inviteLink}</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #888; font-size: 12px; text-align: center;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `,
      });

      console.log("Email sent successfully:", emailResponse);

      return new Response(JSON.stringify({ 
        success: true, 
        message: isResend ? "Invitation resent successfully" : "Invitation sent successfully",
        invitationId: invitationData.id 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (emailError) {
      console.error("Email error:", emailError);
      
      // If email fails, mark invitation as failed but don't delete it
      await supabaseClient
        .from('care_group_invitations')
        .update({ status: 'failed' })
        .eq('id', invitationData.id);

      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});