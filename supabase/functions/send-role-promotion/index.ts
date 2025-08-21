import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface RolePromotionRequest {
  targetEmail: string;
  promotionType: 'system_admin' | 'group_admin';
  groupId?: string;
  groupName?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { targetEmail, promotionType, groupId, groupName }: RolePromotionRequest = await req.json();

    // Check if user is system admin for system_admin promotions, or group admin for group_admin promotions
    if (promotionType === 'system_admin') {
      const { data: isSystemAdmin } = await supabase.rpc('is_platform_admin', { user_uuid: user.id });
      if (!isSystemAdmin) {
        return new Response(JSON.stringify({ error: 'Only system admins can promote system admins' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else if (promotionType === 'group_admin' && groupId) {
      const { data: groupMembers } = await supabase
        .from('care_group_members')
        .select('is_admin')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single();
        
      if (!groupMembers?.is_admin) {
        return new Response(JSON.stringify({ error: 'Only group admins can promote group admins' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Get target user ID
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name')
      .eq('email', targetEmail)
      .single();

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create role promotion confirmation
    const confirmationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

    const { data: confirmation, error: confirmationError } = await supabase
      .from('role_promotion_confirmations')
      .insert({
        confirmation_token: confirmationToken,
        target_user_id: targetProfile.user_id,
        target_email: targetEmail,
        promotion_type: promotionType,
        group_id: groupId,
        requested_by_user_id: user.id,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (confirmationError) {
      console.error('Error creating confirmation:', confirmationError);
      return new Response(JSON.stringify({ error: 'Failed to create confirmation' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get current user info
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('user_id', user.id)
      .single();

    const currentUserName = currentProfile 
      ? `${currentProfile.first_name || ''} ${currentProfile.last_name || ''}`.trim() || currentProfile.email
      : 'Admin';

    const targetUserName = `${targetProfile.first_name || ''} ${targetProfile.last_name || ''}`.trim() || targetEmail;

    // Create confirmation URL
    const baseUrl = req.headers.get('origin') || 'https://yfwgegapmggwywrnzqvg.supabase.co';
    const confirmationUrl = `${baseUrl}/admin/confirm-promotion?token=${confirmationToken}`;

    // Prepare email content
    const subject = promotionType === 'system_admin' 
      ? 'System Admin Role Promotion Confirmation'
      : `Group Admin Role Promotion Confirmation - ${groupName}`;

    const html = `
      <h1>Role Promotion Confirmation Required</h1>
      <p>Hello ${targetUserName},</p>
      <p>${currentUserName} has requested to promote you to <strong>${promotionType === 'system_admin' ? 'System Administrator' : 'Group Administrator'}</strong>${groupName ? ` for "${groupName}"` : ''}.</p>
      <p>To confirm this role promotion, please click the button below:</p>
      <p style="margin: 30px 0;">
        <a href="${confirmationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Confirm Role Promotion</a>
      </p>
      <p><strong>Important:</strong> This confirmation link will expire in 24 hours.</p>
      <p>If you did not expect this promotion or have concerns, please contact your administrator.</p>
      <p>Best regards,<br>Care Management System</p>
    `;

    // Send email using existing gmail-send function
    const emailResponse = await supabase.functions.invoke('gmail-send', {
      body: {
        to: targetEmail,
        subject,
        html,
        groupId: groupId || undefined
      }
    });

    if (emailResponse.error) {
      console.error('Email sending failed:', emailResponse.error);
      
      // Update confirmation status to failed
      await supabase
        .from('role_promotion_confirmations')
        .update({ status: 'failed' })
        .eq('id', confirmation.id);
      
      return new Response(JSON.stringify({ 
        error: 'Failed to send confirmation email',
        details: emailResponse.error 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Log admin action
    await supabase.rpc('log_admin_action', {
      p_action: 'role_promotion_requested',
      p_target_type: promotionType,
      p_target_id: targetProfile.user_id,
      p_details: {
        target_email: targetEmail,
        group_id: groupId,
        group_name: groupName
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: `Role promotion confirmation sent to ${targetEmail}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Role promotion error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});