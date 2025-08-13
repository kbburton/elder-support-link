import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
const GMAIL_FROM = Deno.env.get('GMAIL_FROM');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface EmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  groupId?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
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
    // Verify user is authenticated
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

    const { to, subject, html, replyTo, groupId }: EmailRequest = await req.json();

    // Block demo group emails
    if (groupId === 'demo') {
      console.log('Blocking email send for demo group');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Email blocked for demo group' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get refresh token from database
    const { data: tokenData, error: tokenError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'GMAIL_REFRESH_TOKEN')
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ 
        error: 'Gmail not connected',
        needsReconnect: true 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const refreshToken = tokenData.value;

    // Get access token using refresh token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: GOOGLE_OAUTH_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token refresh failed:', error);
      
      // Check if it's an invalid grant error - delete stored token
      if (error.includes('invalid_grant')) {
        await supabase
          .from('app_settings')
          .delete()
          .eq('key', 'GMAIL_REFRESH_TOKEN');
        
        return new Response(JSON.stringify({ 
          error: 'Gmail connection expired',
          needsReconnect: true 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Failed to refresh token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;

    // Prepare recipients
    const recipients = Array.isArray(to) ? to : [to];
    const results = [];

    // Send emails
    for (const recipient of recipients) {
      try {
        // Create email message in RFC 2822 format
        const emailMessage = [
          `From: ${GMAIL_FROM}`,
          `To: ${recipient}`,
          `Subject: ${subject}`,
          replyTo ? `Reply-To: ${replyTo}` : '',
          'Content-Type: text/html; charset=utf-8',
          '',
          html
        ].filter(Boolean).join('\r\n');

        // Base64 encode the message
        const encodedMessage = btoa(unescape(encodeURIComponent(emailMessage)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            raw: encodedMessage
          }),
        });

        if (sendResponse.ok) {
          const result = await sendResponse.json();
          results.push({ recipient, success: true, messageId: result.id });
          console.log(`✅ Email sent to ${recipient}`);
        } else {
          const error = await sendResponse.text();
          console.error(`❌ Failed to send to ${recipient}:`, error);
          results.push({ recipient, success: false, error });
        }
      } catch (error) {
        console.error(`❌ Error sending to ${recipient}:`, error);
        results.push({ recipient, success: false, error: error.message });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Gmail send error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});