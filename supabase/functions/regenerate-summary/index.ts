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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { documentId } = await req.json();
    
    if (!documentId) {
      throw new Error('Document ID is required');
    }

    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) {
      throw new Error(`Document not found: ${docError.message}`);
    }

    let textContent = document.full_text;
    
    // If no text content, attempt to reprocess the document
    if (!textContent || textContent.trim().length === 0) {
      console.log('No text content found, attempting to reprocess document');
      
      try {
        // Call the process-document function to extract text
        const { error: processError } = await supabaseClient.functions.invoke('process-document', {
          body: { documentId }
        });
        
        if (processError) {
          console.error('Reprocessing failed:', processError);
          throw new Error(`Document reprocessing failed: ${processError.message}`);
        }
        
        // Fetch the updated document with extracted text
        const { data: updatedDoc, error: fetchError } = await supabaseClient
          .from('documents')
          .select('full_text')
          .eq('id', documentId)
          .single();
          
        if (fetchError || !updatedDoc?.full_text) {
          throw new Error('Document reprocessing completed but no text was extracted');
        }
        
        textContent = updatedDoc.full_text;
        console.log(`Reprocessed document, extracted ${textContent.length} characters`);
        
      } catch (reprocessError) {
        console.error('Document reprocessing failed:', reprocessError);
        throw new Error(`No text content available and reprocessing failed: ${reprocessError.message}`);
      }
    }

    // Use OpenAI Responses API for consistent processing
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: `Create a comprehensive summary of this document. Focus on key points, important dates, names, amounts, and actionable information:\n\n${textContent.substring(0, 10000)}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI Responses API error: ${response.status} - ${errorText}`);
      throw new Error(`Summary generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    const newSummary = data.output_text || 'Summary could not be generated.';

    const { error: updateError } = await supabaseClient
      .from('documents')
      .update({ summary: newSummary })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, summary: newSummary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in regenerate-summary function:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});