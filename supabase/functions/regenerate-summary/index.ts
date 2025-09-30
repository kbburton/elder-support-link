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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
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

    // Generate new summary using Gemini
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a document summarization expert. Create concise, comprehensive summaries that capture key points, important dates, names, amounts, and actionable information.'
          },
          {
            role: 'user',
            content: `Create a comprehensive summary of this document:\n\n${textContent.substring(0, 10000)}`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Lovable AI Gateway error: ${response.status} - ${errorText}`);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add funds to your Lovable workspace.');
      }
      
      throw new Error(`Summary generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    const newSummary = data.choices?.[0]?.message?.content || 'Summary could not be generated.';

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
