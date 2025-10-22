import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the user from the auth header
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: userData, error: userErr } = await supabaseClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { documentId, path, bucket } = await req.json();
    
    // Handle memory interview audio
    if (path && bucket === 'memory-interview-audio') {
      // Extract care group ID from path: {care_group_id}/{interview_id}/{recording_sid}.mp3
      const pathParts = path.split('/');
      const careGroupId = pathParts[0];
      
      if (!careGroupId) {
        return new Response(JSON.stringify({ error: 'Invalid audio path' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      // Verify group membership
      const { data: membership } = await supabaseClient
        .from('care_group_members')
        .select('user_id')
        .eq('group_id', careGroupId)
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (!membership) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Create signed URL for audio
      const { data: signed, error: signErr } = await supabaseClient
        .storage
        .from('memory-interview-audio')
        .createSignedUrl(path, 600);

      if (signErr || !signed?.signedUrl) {
        return new Response(JSON.stringify({ error: 'Unable to obtain audio link' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      return new Response(JSON.stringify({ signedUrl: signed.signedUrl }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    // Handle document downloads (original functionality)
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Document ID is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch the document row
    const { data: document, error: docErr } = await supabaseClient
      .from('documents_v2')
      .select('id, group_id, file_url')
      .eq('id', documentId)
      .single();
    if (docErr || !document) {
      return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify group membership
    const { data: membership } = await supabaseClient
      .from('care_group_members')
      .select('user_id')
      .eq('group_id', document.group_id)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create signed URL
    const { data: signed, error: signErr } = await supabaseClient
      .storage
      .from('documents')
      .createSignedUrl(document.file_url as string, 600);

    if (signErr || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: 'Unable to obtain link' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ url: signed.signedUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('sign-document-download error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});