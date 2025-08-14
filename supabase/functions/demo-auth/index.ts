import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DemoAuthRequest {
  email: string;
}

interface DemoSession {
  id: string;
  email: string;
  session_count: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: DemoAuthRequest = await req.json();
    const { email } = body;

    console.log('🎭 Demo auth request for email:', email);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Valid email address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if email already exists
    const { data: existingSession, error: fetchError } = await supabase
      .from('demo_sessions')
      .select('*')
      .eq('email', email)
      .single();

    let sessionData: DemoSession;

    if (existingSession && !fetchError) {
      // Update existing session
      console.log('📧 Existing demo session found, updating session count');
      
      const { data: updatedSession, error: updateError } = await supabase
        .from('demo_sessions')
        .update({ 
          last_accessed: new Date().toISOString(),
          session_count: existingSession.session_count + 1 
        })
        .eq('email', email)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating demo session:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      sessionData = updatedSession;
    } else {
      // Create new session
      console.log('🆕 Creating new demo session');
      
      const { data: newSession, error: insertError } = await supabase
        .from('demo_sessions')
        .insert({ email })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating demo session:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      sessionData = newSession;
    }

    // Generate JWT token for demo session
    const token = await generateDemoJWT({
      sessionId: sessionData.id,
      email: sessionData.email,
      isDemo: true
    });

    console.log('✅ Demo authentication successful for:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        token,
        sessionId: sessionData.id,
        sessionCount: sessionData.session_count
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Demo auth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateDemoJWT(payload: any): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + (24 * 60 * 60), // 24 hours
    iss: 'daveassist-demo'
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const secret = encoder.encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  
  const signature = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(key => crypto.subtle.sign('HMAC', key, data));
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}