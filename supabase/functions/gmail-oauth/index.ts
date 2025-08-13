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
  console.log('=== Gmail OAuth Function Started ===');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Function is working - processing request');
    const url = new URL(req.url);
    const path = url.pathname.split('/gmail-oauth')[1] || '';
    console.log('Parsed path:', path);
    
    // Check environment variables first
    console.log('Environment check:', {
      hasGoogleClientId: !!GOOGLE_OAUTH_CLIENT_ID,
      hasGoogleClientSecret: !!GOOGLE_OAUTH_CLIENT_SECRET,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
      clientIdLength: GOOGLE_OAUTH_CLIENT_ID?.length,
      clientIdPreview: GOOGLE_OAUTH_CLIENT_ID?.substring(0, 20) + '...',
      timestamp: new Date().toISOString()
    });

    if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
      console.log('Missing Google OAuth credentials');
      return new Response(JSON.stringify({ 
        error: 'Google OAuth credentials not configured',
        details: 'Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.log('Missing Supabase credentials');
      return new Response(JSON.stringify({ 
        error: 'Supabase credentials not configured',
        details: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Create Supabase client for auth verification
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );
    console.log('Supabase client created successfully');
    
    // Add a debug endpoint to check credentials
    if (path === '/debug' && req.method === 'GET') {
      return new Response(JSON.stringify({
        hasClientId: !!GOOGLE_OAUTH_CLIENT_ID,
        clientIdLength: GOOGLE_OAUTH_CLIENT_ID?.length || 0,
        clientIdStart: GOOGLE_OAUTH_CLIENT_ID?.substring(0, 15) || 'missing',
        hasClientSecret: !!GOOGLE_OAUTH_CLIENT_SECRET,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/start') {
      console.log('Processing /start path');
      console.log('Request method:', req.method);
      
      let authToken = null;
      
      // Try multiple ways to get the auth token
      // 1. URL parameter (for direct redirect)
      const tokenParam = url.searchParams.get('token');
      if (tokenParam) {
        authToken = decodeURIComponent(tokenParam);
        console.log('Token found in URL parameter');
      }
      
      // 2. Authorization header (for API calls)
      if (!authToken) {
        const authHeader = req.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
          authToken = authHeader.split(' ')[1];
          console.log('Token found in Authorization header');
        }
      }
      
      // 3. Form data (for POST requests)
      if (!authToken && req.method === 'POST') {
        try {
          const formData = await req.formData();
          authToken = formData.get('auth_token')?.toString();
          if (authToken) {
            console.log('Token found in form data');
          }
        } catch (e) {
          console.log('Failed to read form data:', e.message);
        }
      }
      
      console.log('Final auth token status:', !!authToken);
      
      if (!authToken) {
        console.log('Returning 401: No valid auth token found');
        return new Response(JSON.stringify({ error: 'Unauthorized - no token provided' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Token extracted, length:', authToken?.length);
      
      console.log('Calling supabase.auth.getUser...');
      const { data: { user }, error } = await supabase.auth.getUser(authToken);
      console.log('getUser result:', { 
        userEmail: user?.email, 
        hasUser: !!user,
        errorMessage: error?.message 
      });
      
      if (error || !user) {
        console.log('Returning 401: Invalid token or no user');
        return new Response(JSON.stringify({ 
          error: 'Invalid token',
          details: error?.message || 'No user found' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('User email:', user.email);
      
      // Check if user is platform admin (specifically kbburton3@gmail.com)
      if (user.email !== 'kbburton3@gmail.com') {
        console.log('Returning 403: Not platform admin, user is:', user.email);
        return new Response(JSON.stringify({ 
          error: 'Platform admin access required',
          details: `User ${user.email} is not authorized` 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('User authorized, building OAuth URL...');
      
      // Build OAuth URL with HTTPS
      const baseUrl = 'https://yfwgegapmggwywrnzqvg.functions.supabase.co';
      const redirectUri = `${baseUrl}/gmail-oauth/callback`;
      console.log('Base URL:', baseUrl);
      console.log('Redirect URI:', redirectUri);
      
      const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      oauthUrl.searchParams.set('client_id', GOOGLE_OAUTH_CLIENT_ID!);
      oauthUrl.searchParams.set('redirect_uri', redirectUri);
      oauthUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.send');
      oauthUrl.searchParams.set('response_type', 'code');
      oauthUrl.searchParams.set('access_type', 'offline');
      oauthUrl.searchParams.set('prompt', 'consent');

      console.log('Final OAuth URL:', oauthUrl.toString());
      console.log('Returning 302 redirect...');
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': oauthUrl.toString()
        }
      });
    }

    if (path === '/callback') {
      console.log('Processing /callback path');
      const code = url.searchParams.get('code');
      if (!code) {
        console.log('No authorization code in callback');
        return new Response('Missing authorization code', {
          status: 400,
          headers: corsHeaders
        });
      }

      // Exchange code for tokens
      const baseUrl = 'https://yfwgegapmggwywrnzqvg.functions.supabase.co';
      const redirectUri = `${baseUrl}/gmail-oauth/callback`;

      console.log('Exchanging code for tokens...');
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
      console.log('Tokens received, has refresh_token:', !!tokens.refresh_token);
      
      // Store refresh token if present
      if (tokens.refresh_token) {
        console.log('Storing refresh token...');
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
        console.log('Refresh token stored successfully');
      }

      // Redirect back to admin page with success message
      const adminUrl = `${SUPABASE_URL?.replace('https://', '').replace('.supabase.co', '')}.lovableproject.com/app/demo/admin/email?connected=true`;
      console.log('Redirecting to:', adminUrl);
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `https://${adminUrl}`
        }
      });
    }

    if (path === '/disconnect') {
      console.log('Processing /disconnect path');
      
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

    console.log('Unknown path requested:', path);
    return new Response('Not found', {
      status: 404,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('=== Gmail OAuth Function Error ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});