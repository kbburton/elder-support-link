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

    const GOOGLE_GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');

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
      console.log('No full_text found; attempting on-demand extraction for document:', documentId);

      try {
        const isOfficeDoc = document.mime_type?.includes('officedocument') ||
                            document.mime_type?.includes('ms-excel') ||
                            document.mime_type?.includes('presentationml');
        const isPdf = document.mime_type?.includes('pdf');
        const isImage = document.mime_type?.includes('image');
        const isTextFile = document.mime_type?.includes('text');

        // Create a signed URL to access the file
        const { data: signedUrlData, error: signErr } = await supabaseClient
          .storage
          .from('documents')
          .createSignedUrl(document.file_url, 3600);

        if (signErr || !signedUrlData?.signedUrl) {
          throw new Error(`Failed to create signed URL: ${signErr?.message || 'unknown'}`);
        }

        let extractedText = '';

        if (isImage) {
          // Use Lovable AI Vision (Gemini) to extract text from image
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
                  content: 'You are a document text extraction expert. Extract ALL text content from the image. Preserve formatting, structure, and important details. Return only the extracted text without any commentary.'
                },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'Extract all text from this image:' },
                    { type: 'image_url', image_url: { url: signedUrlData.signedUrl } }
                  ]
                }
              ]
            })
          });

          if (!extractResponse.ok) {
            const errorText = await extractResponse.text();
            console.error('Lovable AI image extraction failed', extractResponse.status, errorText);
          } else {
            const extractData = await extractResponse.json();
            extractedText = extractData.choices?.[0]?.message?.content || '';
          }
        } else if ((isOfficeDoc || isPdf) && GOOGLE_GEMINI_API_KEY) {
          // Fetch bytes via signed URL
          const fileResp = await fetch(signedUrlData.signedUrl);
          if (!fileResp.ok) {
            throw new Error(`Failed to fetch file for extraction: ${fileResp.status} ${fileResp.statusText}`);
          }
          const arrayBuffer = await fileResp.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Prefer inline_data to avoid Google File API upload issues
          const toBase64 = (u8: Uint8Array) => {
            let binary = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < u8.length; i += chunkSize) {
              binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunkSize)) as any);
            }
            return btoa(binary);
          };

          const base64Data = toBase64(uint8Array);

          // Extract with Gemini using inline_data (2.5 Flash, fallback to 2.0 Flash)
          let geminiExtractResp = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: 'Extract all text content from this document. Preserve formatting, structure, and important details. Return only the extracted text without any commentary.' },
                      { inline_data: { mime_type: document.mime_type || 'application/octet-stream', data: base64Data } },
                    ],
                  },
                ],
              }),
            }
          );

          if (!geminiExtractResp.ok && geminiExtractResp.status === 404) {
            console.warn('Gemini 2.5 Flash not available, trying 2.0 Flash');
            geminiExtractResp = await fetch(
              `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-001:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        { text: 'Extract all text content from this document. Preserve formatting, structure, and important details. Return only the extracted text without any commentary.' },
                        { inline_data: { mime_type: document.mime_type || 'application/octet-stream', data: base64Data } },
                      ],
                    },
                  ],
                }),
              }
            );
          }

          if (!geminiExtractResp.ok) {
            const errorText = await geminiExtractResp.text();
            console.error('Gemini text extraction failed', geminiExtractResp.status, errorText);
            throw new Error(`Gemini extract failed: ${geminiExtractResp.status}`);
          }
          const extractData = await geminiExtractResp.json();
          const parts = extractData.candidates?.[0]?.content?.parts || [];
          extractedText = parts.map((p: any) => p.text).filter(Boolean).join('\n').trim();

        } else if (isTextFile) {
          const fileResp = await fetch(signedUrlData.signedUrl);
          if (!fileResp.ok) {
            throw new Error(`Failed to fetch text file: ${fileResp.status} ${fileResp.statusText}`);
          }
          extractedText = await fileResp.text();
        }

        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('Unable to extract text from file for summarization.');
        }

        // Persist extracted full_text for future regenerations
        const { error: ftUpdateError } = await supabaseClient
          .from('documents_v2')
          .update({ full_text: extractedText })
          .eq('id', documentId);
        if (ftUpdateError) {
          console.warn('Failed to update full_text after extraction', ftUpdateError.message);
        } else {
          document.full_text = extractedText;
        }
      } catch (extractionError) {
        console.error('On-demand text extraction failed:', extractionError);
        throw new Error('No text content available for summarization. Please process the document first.');
      }
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
    // Return 200 with error payload so clients can show debug info instead of generic non-2xx
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
