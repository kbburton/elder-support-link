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

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    );
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting full search index rebuild');

    // Call the rebuild_search_index function
    const { error: rebuildError } = await supabaseClient
      .rpc('rebuild_search_index');

    if (rebuildError) {
      throw new Error(`Failed to rebuild search index: ${rebuildError.message}`);
    }

    // Get the count of rebuilt entries
    const { count, error: countError } = await supabaseClient
      .from('search_index')
      .select('*', { count: 'exact', head: true });

    const totalEntries = count || 0;

    console.log(`Search index rebuilt successfully with ${totalEntries} entries`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Search index rebuilt successfully`,
        total_entries: totalEntries
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error rebuilding search index:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});