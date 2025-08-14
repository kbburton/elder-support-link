import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsRequest {
  sessionId: string;
  pagePath: string;
  action: 'enter' | 'leave';
  timeSpentSeconds?: number;
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

    const body: AnalyticsRequest = await req.json();
    const { sessionId, pagePath, action, timeSpentSeconds } = body;

    console.log('📊 Demo analytics:', { sessionId, pagePath, action, timeSpentSeconds });

    if (!sessionId || !pagePath || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'enter') {
      // Record page entry
      const { error: insertError } = await supabase
        .from('demo_analytics')
        .insert({
          session_id: sessionId,
          page_path: pagePath,
          entered_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('❌ Error recording page entry:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to record analytics' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (action === 'leave') {
      // Update the most recent entry for this page with leave time
      const { data: recentEntry } = await supabase
        .from('demo_analytics')
        .select('*')
        .eq('session_id', sessionId)
        .eq('page_path', pagePath)
        .is('left_at', null)
        .order('entered_at', { ascending: false })
        .limit(1)
        .single();

      if (recentEntry) {
        const { error: updateError } = await supabase
          .from('demo_analytics')
          .update({
            left_at: new Date().toISOString(),
            time_spent_seconds: timeSpentSeconds || 0
          })
          .eq('id', recentEntry.id);

        if (updateError) {
          console.error('❌ Error updating page leave:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update analytics' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Demo analytics error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});