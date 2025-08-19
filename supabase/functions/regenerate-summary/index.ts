import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId } = await req.json();
    console.log('Processing summary regeneration for document:', documentId);
    
    if (!documentId) {
      throw new Error('Document ID is required');
    }

    // Get document details
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('id, full_text, title, original_filename')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error(`Document not found: ${docError?.message}`);
    }

    if (!document.full_text || document.full_text.trim().length === 0) {
      throw new Error('No text content available to summarize');
    }

    console.log('Generating new AI summary for:', document.title || document.original_filename);

    // Generate new summary using GPT
    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise, informative summaries of documents. Focus on key points, important dates, and actionable information. Keep summaries under 200 words and make them useful for healthcare caregivers managing care coordination.'
          },
          {
            role: 'user', 
            content: `Please create a comprehensive summary of this document:\n\n${document.full_text}`
          }
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!summaryResponse.ok) {
      const errorText = await summaryResponse.text();
      throw new Error(`OpenAI API error: ${summaryResponse.status} - ${errorText}`);
    }

    const summaryData = await summaryResponse.json();
    const newSummary = summaryData.choices[0]?.message?.content || 'Could not generate summary';

    // Update document with new summary
    const { error: updateError } = await supabaseClient
      .from('documents')
      .update({
        summary: newSummary,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    console.log('Successfully regenerated summary for document:', documentId);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        summary: newSummary,
        message: 'Summary regenerated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error regenerating summary:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to regenerate summary'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});