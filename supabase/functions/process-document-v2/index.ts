import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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

    console.log('Processing document:', documentId);

    // Fetch document
    const { data: document, error: docError } = await supabaseClient
      .from('documents_v2')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) {
      throw new Error(`Document not found: ${docError.message}`);
    }

    // Update status to processing
    await supabaseClient
      .from('documents_v2')
      .update({ processing_status: 'processing' })
      .eq('id', documentId);

    // File size check using stored metadata to avoid heavy downloads
    if (document.file_size && document.file_size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }

    console.log(`Processing file type: ${document.mime_type}`);

    // Extract text using Gemini or fallback parsers
    let fullText = '';
    let usedGemini = false;
    
    if (document.mime_type?.includes('pdf') || document.mime_type?.includes('image')) {
      console.log('Extracting text with Gemini AI');
      const { data: signed, error: sErr } = await supabaseClient
        .storage
        .from('documents')
        .createSignedUrl(document.file_url, 600);
      if (sErr || !signed?.signedUrl) {
        throw new Error(`Failed to generate signed URL: ${sErr?.message || 'unknown'}`);
      }
      const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              content: 'You are a document text extraction expert. Extract ALL text content from the document. Preserve formatting, structure, and important details. Return only the extracted text without any commentary.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from this document:'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: signed.signedUrl
                  }
                }
              ]
            }
          ]
        })
      });

      if (!extractResponse.ok) {
        const errorText = await extractResponse.text();
        console.error(`Gemini error: ${extractResponse.status} - ${errorText}`);
        throw new Error(`Text extraction failed: ${extractResponse.statusText}`);
      }

      const extractData = await extractResponse.json();
      fullText = extractData.choices?.[0]?.message?.content || '';
      usedGemini = true;
      console.log(`Extracted ${fullText.length} characters`);
    } else if (document.mime_type?.includes('text')) {
      fullText = new TextDecoder().decode(arrayBuffer);
      console.log('Text file processed directly');
    } else if (
      document.mime_type?.includes('officedocument') ||
      document.mime_type?.includes('ms-excel') ||
      document.mime_type?.includes('presentationml')
    ) {
      // Office formats: try XML text extraction first
      const decoder = new TextDecoder('utf-8', { fatal: false } as any);
      const xml = decoder.decode(arrayBuffer);
      const pieces: string[] = [];

      if (document.mime_type.includes('wordprocessingml')) {
        const patterns = [
          /<w:t[^>]*>([^<]+)<\/w:t>/g,
          /<w:t>([^<]+)<\/w:t>/g,
          /<text[^>]*>([^<]+)<\/text>/g,
        ];
        for (const pattern of patterns) {
          const matches = xml.match(pattern);
          if (matches) pieces.push(...matches.map(m => m.replace(/<[^>]+>/g, '').trim()));
        }
      } else if (document.mime_type.includes('spreadsheetml') || document.mime_type.includes('ms-excel')) {
        const patterns = [
          /<t[^>]*>([^<]+)<\/t>/g,
          /<v>([^<]+)<\/v>/g,
          /<si><t>([^<]+)<\/t><\/si>/g,
        ];
        for (const pattern of patterns) {
          const matches = xml.match(pattern);
          if (matches) pieces.push(...matches.map(m => m.replace(/<[^>]+>/g, '').trim()));
        }
      } else if (document.mime_type.includes('presentationml')) {
        const patterns = [
          /<a:t[^>]*>([^<]+)<\/a:t>/g,
          /<a:t>([^<]+)<\/a:t>/g,
        ];
        for (const pattern of patterns) {
          const matches = xml.match(pattern);
          if (matches) pieces.push(...matches.map(m => m.replace(/<[^>]+>/g, '').trim()));
        }
      }

      fullText = pieces
        .filter(t => t.length > 0 && !t.match(/^[\s\n\r]*$/))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      console.log(`Extracted ${fullText.length} characters from Office document using XML parsing`);
      
      // If XML extraction failed, fallback to Gemini vision API
      if (fullText.length < 50) {
        console.log('XML extraction yielded minimal text, trying Gemini vision API');
        try {
          const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                  content: 'You are a document text extraction expert. Extract ALL text content from this Office document. Preserve formatting, structure, and important details. Return only the extracted text without any commentary.'
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Extract all text from this document:'
                    },
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:${document.mime_type};base64,${base64File}`
                      }
                    }
                  ]
                }
              ]
            })
          });

          if (extractResponse.ok) {
            const extractData = await extractResponse.json();
            const geminiText = extractData.choices?.[0]?.message?.content || '';
            if (geminiText.length > fullText.length) {
              fullText = geminiText;
              usedGemini = true;
              console.log(`Gemini extracted ${fullText.length} characters (better than XML)`);
            }
          }
        } catch (geminiError) {
          console.error('Gemini fallback failed:', geminiError);
        }
      }
    }

    // Generate summary using category-specific prompt if available
    let summary = '';
    if (fullText && fullText.length > 50) {
      console.log('Generating summary with Gemini AI');
      
      let systemPrompt = 'You are a document summarization expert. Create a concise, comprehensive summary that captures key points, important dates, names, amounts, and actionable information.';
      
      // Get category-specific prompt if category is set
      if (document.category_id) {
        const { data: category } = await supabaseClient
          .from('document_categories')
          .select('name')
          .eq('id', document.category_id)
          .single();
        
        if (category) {
          const { data: aiPrompt } = await supabaseClient
            .from('ai_prompts')
            .select('prompt_text')
            .eq('category', category.name)
            .eq('target_table', 'documents')
            .eq('target_field', 'summary')
            .single();
          
          if (aiPrompt) {
            systemPrompt = aiPrompt.prompt_text;
            console.log('Using category-specific prompt');
          }
        }
      }

      const summaryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              content: `Create a comprehensive summary of this document:\n\n${fullText.substring(0, 50000)}`
            }
          ]
        })
      });

      if (!summaryResponse.ok) {
        console.error(`Summary generation failed: ${summaryResponse.statusText}`);
      } else {
        const summaryData = await summaryResponse.json();
        summary = summaryData.choices?.[0]?.message?.content || 'Summary could not be generated.';
        console.log('Summary generated successfully');
      }
    }

    // Update document with extracted text and summary
    const { error: updateError } = await supabaseClient
      .from('documents_v2')
      .update({
        full_text: fullText || null,
        summary: summary || null,
        processing_status: 'completed',
        processing_error: null
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    console.log('Document processing completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        fullText: fullText.substring(0, 500),
        summary: summary.substring(0, 500),
        textLength: fullText.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-document-v2 function:', error);
    
    // Try to update document status to failed
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { documentId } = await req.json();
      
      if (documentId) {
        await supabaseClient
          .from('documents_v2')
          .update({
            processing_status: 'failed',
            processing_error: error.message
          })
          .eq('id', documentId);
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
