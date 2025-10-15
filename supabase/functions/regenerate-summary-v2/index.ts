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

    const { documentId, customPrompt, temperature } = await req.json();
    
    if (!documentId) {
      throw new Error('Document ID is required');
    }

    // Fetch document
    const { data: document, error: docError } = await supabaseClient
      .from('documents_v2')
      .select('*, document_categories(name)')
      .eq('id', documentId)
      .single();

    if (docError) {
      throw new Error(`Document not found: ${docError.message}`);
    }

    if (!document.full_text || document.full_text.trim().length === 0) {
      throw new Error('No text content available for summarization. Please process the document first.');
    }

    console.log('Regenerating summary for document:', documentId);

    // Determine system prompt
    let systemPrompt = 'You are a document summarization expert. Create a concise, comprehensive summary that captures key points, important dates, names, amounts, and actionable information.';
    
    if (customPrompt) {
      systemPrompt = customPrompt;
      console.log('Using custom prompt');
    } else if (document.document_categories?.name) {
      const { data: aiPrompt } = await supabaseClient
        .from('ai_prompts')
        .select('prompt_text')
        .eq('category', document.document_categories.name)
        .eq('target_table', 'documents')
        .eq('target_field', 'summary')
        .single();
      
      if (aiPrompt) {
        systemPrompt = aiPrompt.prompt_text;
        console.log('Using category-specific prompt');
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
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Create a comprehensive summary of this document:\n\n${document.full_text.substring(0, 50000)}`
          }
        ],
        temperature: temperature || 0.7
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

    // Update document with new summary
    const { error: updateError } = await supabaseClient
      .from('documents_v2')
      .update({ summary: newSummary })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    console.log('Summary regenerated successfully');

    return new Response(
      JSON.stringify({ success: true, summary: newSummary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in regenerate-summary-v2 function:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
