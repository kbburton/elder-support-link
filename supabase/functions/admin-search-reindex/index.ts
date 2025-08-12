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
    const { entity_type, entity_id } = await req.json();

    if (!entity_type || !entity_id) {
      return new Response(
        JSON.stringify({ error: 'Missing entity_type or entity_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Reindexing ${entity_type} ${entity_id}`);

    // Call the reindex_row function
    const { error: reindexError } = await supabaseClient
      .rpc('reindex_row', {
        p_entity_type: entity_type,
        p_entity_id: entity_id
      });

    if (reindexError) {
      throw new Error(`Failed to reindex: ${reindexError.message}`);
    }

    console.log(`Successfully reindexed ${entity_type} ${entity_id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully reindexed ${entity_type}`,
        entity_type,
        entity_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search reindex:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});