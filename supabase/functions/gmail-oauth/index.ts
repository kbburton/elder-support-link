import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/gmail-oauth')[1] || '';
    
    // Create Supabase client for auth verification
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    if (path === '/start') {
      // Verify user is authenticated and is platform admin
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if user is platform admin (specifically kbburton3@gmail.com)
      if (user.email !== 'kbburton3@gmail.com') {
        return new Response(JSON.stringify({ error: 'Platform admin access required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Build OAuth URL
      const baseUrl = `${url.protocol}//${url.host}`;
      const redirectUri = `${baseUrl}/gmail-oauth/callback`;
      
      const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      oauthUrl.searchParams.set('client_id', GOOGLE_OAUTH_CLIENT_ID!);
      oauthUrl.searchParams.set('redirect_uri', redirectUri);
      oauthUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.send');
      oauthUrl.searchParams.set('response_type', 'code');
      oauthUrl.searchParams.set('access_type', 'offline');
      oauthUrl.searchParams.set('prompt', 'consent');

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': oauthUrl.toString()
        }
      });
    }

    if (path === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Missing authorization code', {
          status: 400,
          headers: corsHeaders
        });
      }

      // Exchange code for tokens
      const baseUrl = `${url.protocol}//${url.host}`;
      const redirectUri = `${baseUrl}/gmail-oauth/callback`;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_OAUTH_CLIENT_ID!,
          client_secret: GOOGLE_OAUTH_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error('Token exchange failed:', error);
        return new Response('Token exchange failed', {
          status: 400,
          headers: corsHeaders
        });
      }

      const tokens = await tokenResponse.json();
      
      // Store refresh token if present
      if (tokens.refresh_token) {
        const { error: upsertError } = await supabase
          .from('app_settings')
          .upsert({
            key: 'GMAIL_REFRESH_TOKEN',
            value: tokens.refresh_token
          });

        if (upsertError) {
          console.error('Failed to store refresh token:', upsertError);
          return new Response('Failed to store token', {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // Redirect back to admin page with success message
      const adminUrl = `${SUPABASE_URL?.replace('https://', '').replace('.supabase.co', '')}.lovableproject.com/app/demo/admin/email?connected=true`;
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `https://${adminUrl}`
        }
      });
    }

    if (path === '/disconnect') {
      // Verify user is authenticated and is platform admin
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user || user.email !== 'kbburton3@gmail.com') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Remove refresh token
      const { error: deleteError } = await supabase
        .from('app_settings')
        .delete()
        .eq('key', 'GMAIL_REFRESH_TOKEN');

      if (deleteError) {
        return new Response(JSON.stringify({ error: 'Failed to disconnect' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', {
      status: 404,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Gmail OAuth error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});