import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Helper function to upload file to Gemini File API
async function uploadToGeminiFileAPI(
  fileBuffer: Uint8Array, 
  mimeType: string, 
  displayName: string, 
  apiKey: string
): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, displayName);
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      body: formData
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini File API upload failed: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return data.file.uri; // Returns something like "files/abc123"
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GOOGLE_GENAI_API_KEY = Deno.env.get('GOOGLE_GENAI_API_KEY') || '';
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const groupId = formData.get('groupId') as string;
    const uploadedByUserId = formData.get('uploadedByUserId') as string;
    const uploadedByEmail = formData.get('uploadedByEmail') as string;
    const title = formData.get('title') as string;
    const categoryId = formData.get('categoryId') as string | null;
    const notes = formData.get('notes') as string | null;
    const isSharedWithGroup = formData.get('isSharedWithGroup') === 'true';

    if (!file || !groupId || !uploadedByUserId || !uploadedByEmail) {
      throw new Error('Missing required fields');
    }

    console.log(`Processing upload: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }

    // Step 1: Upload file to storage FIRST to get a URL
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${uploadedByUserId}/${crypto.randomUUID()}.${fileExt}`;
    
    console.log('Uploading file to storage:', fileName);
    
    const { error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(fileName, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    // Step 2: Process the file with Lovable AI
    let fullText = '';
    let summary = '';
    let usedGemini = false;

    const isOfficeDoc = file.type?.includes('officedocument') || 
                        file.type?.includes('ms-excel') || 
                        file.type?.includes('presentationml');
    const isPdfOrImage = file.type?.includes('pdf') || file.type?.includes('image');
    const isTextFile = file.type?.includes('text');

    // Process Office documents with Gemini File API
    if (isOfficeDoc) {
      console.log('Processing Office document with Gemini File API');
      
      if (!GOOGLE_GENAI_API_KEY) {
        console.warn('GOOGLE_GENAI_API_KEY not set. Skipping AI extraction for Office document.');
      } else {
        try {
          // Upload to Gemini File API using Google key
          const fileUri = await uploadToGeminiFileAPI(uint8Array, file.type, file.name, GOOGLE_GENAI_API_KEY);
          console.log('File uploaded to Gemini, URI:', fileUri);
          
          // Extract text using file_data reference via Lovable AI gateway
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
                  content: 'You are a document text extraction expert. Extract ALL text content from this document. Preserve formatting, structure, and important details. Return only the extracted text without any commentary.'
                },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'Extract all text from this document:' },
                    { type: 'file_data', file_data: { file_uri: fileUri, mime_type: file.type } }
                  ]
                }
              ]
            })
          });

          if (!extractResponse.ok) {
            const errorText = await extractResponse.text();
            console.error(`Gemini extraction failed: ${extractResponse.status} - ${errorText}`);
            console.log('Document will be stored without AI extraction');
          } else {
            const extractData = await extractResponse.json();
            fullText = extractData.choices?.[0]?.message?.content || '';
            usedGemini = true;
            console.log(`Successfully extracted ${fullText.length} characters from Office document`);
          }
        } catch (error) {
          console.error('Failed to process Office document with File API:', error);
          console.log('Document will be stored without AI extraction');
        }
      }
    }
    // Process PDFs and images with vision API
    else if (isPdfOrImage) {
      console.log('Extracting text with Gemini AI from PDF/image');
      
      // Create a signed URL that Gemini can access (expires in 1 hour)
      const { data: signedUrlData, error: signError } = await supabaseClient.storage
        .from('documents')
        .createSignedUrl(fileName, 3600);

      if (signError || !signedUrlData?.signedUrl) {
        console.warn('Failed to create signed URL, skipping AI extraction');
      } else {
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
                  { type: 'text', text: 'Extract all text from this document:' },
                  { type: 'image_url', image_url: { url: signedUrlData.signedUrl } }
                ]
              }
            ]
          })
        });

        if (!extractResponse.ok) {
          const errorText = await extractResponse.text();
          console.error(`Gemini extraction failed: ${extractResponse.status} - ${errorText}`);
          console.log('Document will be stored without AI extraction');
        } else {
          const extractData = await extractResponse.json();
          fullText = extractData.choices?.[0]?.message?.content || '';
          usedGemini = true;
          console.log(`Successfully extracted ${fullText.length} characters from PDF/image`);
        }
      }
    } 
    // Process text files directly
    else if (isTextFile) {
      console.log('Text file - reading directly');
      const decoder = new TextDecoder();
      fullText = decoder.decode(uint8Array);
    }

    // Generate summary if we have enough text
    if (fullText && fullText.length > 50) {
      console.log('Generating summary with Gemini AI');

      let systemPrompt = 'You are a document summarization expert. Create a concise, comprehensive summary that captures key points, important dates, names, amounts, and actionable information.';

      // Get category-specific prompt if available
      if (categoryId) {
        const { data: category } = await supabaseClient
          .from('document_categories')
          .select('name')
          .eq('id', categoryId)
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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Create a comprehensive summary of this document:\n\n${fullText.substring(0, 50000)}` }
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

    // Step 3: Insert document record with summary already populated
    const { data: insertedDoc, error: insertError } = await supabaseClient
      .from('documents_v2')
      .insert({
        group_id: groupId,
        uploaded_by_user_id: uploadedByUserId,
        uploaded_by_email: uploadedByEmail,
        title: title || file.name,
        original_filename: file.name,
        file_url: fileName,
        file_size: file.size,
        mime_type: file.type,
        category_id: categoryId,
        notes: notes,
        is_shared_with_group: isSharedWithGroup,
        full_text: fullText || null,
        summary: summary || null,
        processing_status: 'completed',
        processing_error: null
      })
      .select()
      .single();

    if (insertError) {
      // Clean up uploaded file if database insert fails
      await supabaseClient.storage.from('documents').remove([fileName]);
      throw new Error(`Failed to create document record: ${insertError.message}`);
    }

    console.log('Document upload and processing completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        document: insertedDoc,
        textLength: fullText.length,
        summaryLength: summary.length,
        usedGemini,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in upload-and-process-document-v2:', error);

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
