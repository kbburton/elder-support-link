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

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const entityType = pathParts[pathParts.length - 2];
    const entityId = pathParts[pathParts.length - 1];

    console.log('Reindexing entity:', { entityType, entityId });

    if (!entityType || !entityId) {
      return new Response(
        JSON.stringify({ error: 'Entity type and ID are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate entity type
    const validEntityTypes = ['contact', 'appointment', 'task', 'document', 'activity'];
    if (!validEntityTypes.includes(entityType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid entity type. Must be one of: ' + validEntityTypes.join(', ') }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get the record based on entity type
    let record = null;
    let tableName = '';
    
    switch (entityType) {
      case 'contact':
        tableName = 'contacts';
        break;
      case 'appointment':
        tableName = 'appointments';
        break;
      case 'task':
        tableName = 'tasks';
        break;
      case 'document':
        tableName = 'documents';
        break;
      case 'activity':
        tableName = 'activity_logs';
        break;
    }

    const { data: recordData, error: recordError } = await supabaseClient
      .from(tableName)
      .select('*')
      .eq('id', entityId)
      .single();

    if (recordError || !recordData) {
      return new Response(
        JSON.stringify({ error: `${entityType} not found` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    record = recordData;

    // Delete existing search index entry
    await supabaseClient
      .from('search_index')
      .delete()
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    // Rebuild the search index entry based on entity type
    let searchTitle = '';
    let searchSnippet = '';
    let searchBody = '';
    let searchUrl = '';
    let careGroupId = '';

    switch (entityType) {
      case 'contact':
        const contactName = [record.first_name, record.last_name].filter(Boolean).join(' ').trim();
        searchTitle = contactName || record.organization_name || 'Contact';
        searchSnippet = [
          [record.city, record.state].filter(Boolean).join(', '),
          record.phone_primary,
          record.contact_type
        ].filter(Boolean).join(' • ');
        searchBody = [
          record.email_personal,
          record.email_work, 
          record.phone_primary,
          record.phone_secondary,
          record.organization_name,
          record.notes
        ].filter(Boolean).join(' ');
        searchUrl = `/app/contacts/${record.id}`;
        careGroupId = record.care_group_id;
        break;

      case 'appointment':
        searchTitle = record.description || 'Appointment';
        searchSnippet = record.outcome_notes || '';
        searchBody = [record.outcome_notes, record.location, record.category].filter(Boolean).join(' ');
        searchUrl = `/app/appointments/${record.id}`;
        careGroupId = record.group_id;
        break;

      case 'task':
        searchTitle = record.title || 'Task';
        searchSnippet = record.description ? record.description.substring(0, 240) : '';
        searchBody = record.description || '';
        searchUrl = `/app/tasks/${record.id}`;
        careGroupId = record.group_id;
        break;

      case 'document':
        searchTitle = record.title || record.original_filename || 'Document';
        searchSnippet = record.summary || '';
        searchBody = record.full_text || '';
        searchUrl = `/app/documents/${record.id}`;
        careGroupId = record.group_id;
        break;

      case 'activity':
        searchTitle = record.title || [record.type, record.date_time ? new Date(record.date_time).toISOString().split('T')[0] : ''].filter(Boolean).join(' ') || 'Activity';
        searchSnippet = record.notes ? record.notes.substring(0, 240) : '';
        searchBody = record.notes || '';
        searchUrl = `/app/activities/${record.id}`;
        careGroupId = record.group_id;
        break;
    }

    if (!careGroupId) {
      return new Response(
        JSON.stringify({ error: 'No care group ID found for this entity' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Build weighted text search vector
    const { data: ftsData, error: ftsError } = await supabaseClient
      .rpc('build_weighted_tsv', {
        title_text: searchTitle,
        snippet_text: searchSnippet, 
        body_text: searchBody
      });

    if (ftsError) {
      throw new Error(`Failed to build search vector: ${ftsError.message}`);
    }

    // Insert new search index entry
    const { error: insertError } = await supabaseClient
      .from('search_index')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        care_group_id: careGroupId,
        title: searchTitle,
        snippet: searchSnippet,
        url_path: searchUrl,
        fts: ftsData
      });

    if (insertError) {
      throw new Error(`Failed to insert search index: ${insertError.message}`);
    }

    console.log('Successfully reindexed entity:', { entityType, entityId });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully reindexed ${entityType} ${entityId}`,
        entity_type: entityType,
        entity_id: entityId,
        title: searchTitle
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reindex function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});