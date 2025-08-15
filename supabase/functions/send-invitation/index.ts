import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Send invitation function called");
    
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
    
    console.log("Supabase client created");

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
    console.log("JWT extracted, length:", jwt.length);
    
    // Verify JWT and get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) {
      console.error("User error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized", details: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("User verified:", user.id);

    const { email, groupId, resendId } = await req.json();
    console.log("Request data:", { email, groupId, resendId });

    let actualGroupId = groupId;

    // If resending, get the groupId from the existing invitation
    if (resendId && !groupId) {
      const { data: existingInvitation, error: fetchError } = await supabaseClient
        .from('care_group_invitations')
        .select('group_id')
        .eq('id', resendId)
        .single();

      if (fetchError || !existingInvitation) {
        return new Response(JSON.stringify({ error: "Invitation not found for resend" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      actualGroupId = existingInvitation.group_id;
      console.log("Retrieved groupId from existing invitation:", actualGroupId);
    }

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

    // Check if user is admin of the group using direct query (since service role doesn't have auth.uid())
    console.log("Checking if user is admin of group:", actualGroupId);
    const { data: adminCheck, error: adminError } = await supabaseClient
      .from('care_group_members')
      .select('is_admin')
      .eq('group_id', actualGroupId)
      .eq('user_id', user.id)
      .single();

    console.log("Admin check result:", { adminCheck, adminError });
    
    const isAdmin = adminCheck?.is_admin === true;
    
    if (adminError || !isAdmin) {
      console.error("Admin check error:", adminError);
      return new Response(JSON.stringify({ 
        error: "Not authorized to send invitations", 
        details: adminError?.message,
        isAdmin,
        userId: user.id,
        groupId: actualGroupId 
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get group info
    const { data: group } = await supabaseClient
      .from('care_groups')
      .select('name')
      .eq('id', actualGroupId)
      .single();

    const groupName = group?.name || "Care Group";

    // Check if the invited email belongs to an existing user
    const { data: existingUser } = await supabaseClient
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .single();

    if (existingUser && !resendId) {
      // Check if this user is already a member
      const { data: userMember } = await supabaseClient
        .from('care_group_members')
        .select('id')
        .eq('user_id', existingUser.user_id)
        .eq('group_id', actualGroupId)
        .single();

      if (userMember) {
        return new Response(JSON.stringify({ 
          error: "This person is already a member of this care group." 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
        .eq('group_id', actualGroupId)
        .eq('invited_email', email)
        .eq('status', 'pending')
        .single();

      if (existingInvitation) {
        return new Response(JSON.stringify({ error: "The invitation was already sent and is pending." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new invitation
      const { data: newInvitation, error: insertError } = await supabaseClient
        .from('care_group_invitations')
        .insert({
          group_id: actualGroupId,
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

    // Create invitation link - use the project's frontend URL
    const baseUrl = 'https://elder-support-link.lovable.app';
    const registerLink = `${baseUrl}/register?token=${invitationData.id}`;
    const loginLink = `${baseUrl}/login?token=${invitationData.id}`;

    // Send email using Gmail API
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">Care Group Invitation</h1>
          
          <p>Hello!</p>
          
          <p>${senderName} has ${isResend ? 'resent an' : 'sent you an'} invitation to join the <strong>${groupName}</strong> care group.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-style: italic;">"${invitationData.message}"</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="margin-bottom: 15px; color: #555;">Choose an option below:</p>
            
            <div style="margin-bottom: 15px;">
              <a href="${registerLink}" 
                 style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin: 5px;">
                Create New Account
              </a>
            </div>
            
            <div>
              <a href="${loginLink}" 
                 style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin: 5px;">
                Sign In (Existing Account)
              </a>
            </div>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This invitation will expire on ${new Date(invitationData.expires_at).toLocaleDateString()}.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            If you can't click the buttons above, copy and paste one of these links into your browser:<br><br>
            <strong>New users:</strong><br>
            <a href="${registerLink}" style="color: #007bff; word-break: break-all;">${registerLink}</a><br><br>
            <strong>Existing users:</strong><br>
            <a href="${loginLink}" style="color: #28a745; word-break: break-all;">${loginLink}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #888; font-size: 12px; text-align: center;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `;

      // Call Gmail send function
      const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: invitationData.invited_email,
          subject: `${isResend ? 'Reminder: ' : ''}You're invited to join ${groupName}`,
          html: emailHtml,
          groupId: actualGroupId
        }),
      });

      const emailResult = await emailResponse.json();
      console.log("Email sent successfully:", emailResult);

      if (!emailResponse.ok || !emailResult.success) {
        throw new Error(emailResult.error || 'Failed to send email via Gmail');
      }

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

      return new Response(JSON.stringify({ error: "Failed to send email", details: emailError.message }), {
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