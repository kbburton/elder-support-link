import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Logging utility
function log(level: string, message: string, context?: any) {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
  console.log(`[${timestamp}] [${level}] [upload-and-process-document-v2] ${message}${contextStr}`);
}

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  log('INFO', 'Request received', { requestId, method: req.method });
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log('DEBUG', 'Checking environment variables', { requestId });
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      log('ERROR', 'LOVABLE_API_KEY not configured', { requestId });
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    log('DEBUG', 'Environment variables validated', { requestId });

    log('DEBUG', 'Creating Supabase client', { requestId });
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse multipart form data
    log('DEBUG', 'Parsing form data', { requestId });
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
      log('ERROR', 'Missing required fields', { requestId, hasFile: !!file, hasGroupId: !!groupId });
      throw new Error('Missing required fields');
    }

    log('INFO', 'Processing upload', { 
      requestId,
      fileName: file.name, 
      fileSize: file.size, 
      mimeType: file.type,
      groupId,
      categoryId,
      isSharedWithGroup 
    });

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      log('ERROR', 'File size exceeds limit', { requestId, fileSize: file.size, maxSize: MAX_FILE_SIZE });
      throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }

    // Step 1: Upload file to storage FIRST to get a URL
    log('DEBUG', 'Converting file to buffer', { requestId });
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${uploadedByUserId}/${crypto.randomUUID()}.${fileExt}`;
    
    log('INFO', 'Uploading file to storage', { requestId, fileName, bucketPath: fileName });
    
    const { error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(fileName, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
      });

    if (uploadError) {
      log('ERROR', 'Storage upload failed', { requestId, error: uploadError.message });
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }
    
    log('INFO', 'File uploaded to storage successfully', { requestId, fileName });

    // Step 2: Process the file with Lovable AI
    let fullText = '';
    let summary = '';
    let usedGemini = false;

    const isOfficeDoc = file.type?.includes('officedocument') || 
                        file.type?.includes('ms-excel') || 
                        file.type?.includes('presentationml');
    const isPdfOrImage = file.type?.includes('pdf') || file.type?.includes('image');
    const isTextFile = file.type?.includes('text');

    log('DEBUG', 'File type classification', { 
      requestId, 
      mimeType: file.type,
      isOfficeDoc, 
      isPdfOrImage, 
      isTextFile 
    });

    // Process PDFs and images with Lovable AI (vision API)
    if (isPdfOrImage) {
      log('INFO', 'Processing PDF/Image with Lovable AI vision', { requestId, mimeType: file.type });
      
      // Create a signed URL that Gemini can access (expires in 1 hour)
      log('DEBUG', 'Creating signed URL for vision processing', { requestId });
      const { data: signedUrlData, error: signError } = await supabaseClient.storage
        .from('documents')
        .createSignedUrl(fileName, 3600);

      if (signError || !signedUrlData?.signedUrl) {
        log('WARN', 'Failed to create signed URL', { requestId, error: signError?.message });
      } else {
        log('DEBUG', 'Signed URL created, calling Lovable AI', { requestId, urlLength: signedUrlData.signedUrl.length });
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

        log('DEBUG', 'Lovable AI response received', { requestId, status: extractResponse.status });

        if (!extractResponse.ok) {
          const errorText = await extractResponse.text();
          log('ERROR', 'Lovable AI extraction failed', { 
            requestId, 
            status: extractResponse.status, 
            error: errorText 
          });
        } else {
          const extractData = await extractResponse.json();
          fullText = extractData.choices?.[0]?.message?.content || '';
          usedGemini = true;
          log('INFO', 'Text extraction successful', { 
            requestId, 
            textLength: fullText.length,
            hasContent: fullText.length > 0
          });
        }
      }
    }
    // Office documents cannot be processed via vision API - skip AI extraction
    else if (isOfficeDoc) {
      log('WARN', 'Office document detected - AI extraction not available', { 
        requestId, 
        mimeType: file.type,
        reason: 'Office documents require file upload API which needs separate Google API key'
      });
      log('INFO', 'Document will be stored without AI summary', { requestId });
    }
    // Process text files directly
    else if (isTextFile) {
      log('INFO', 'Reading text file directly', { requestId });
      const decoder = new TextDecoder();
      fullText = decoder.decode(uint8Array);
      log('DEBUG', 'Text file read', { requestId, textLength: fullText.length });
    }

    // Generate summary if we have enough text
    if (fullText && fullText.length > 50) {
      log('INFO', 'Generating AI summary', { requestId, textLength: fullText.length });

      let systemPrompt = 'You are a document summarization expert. Create a concise, comprehensive summary that captures key points, important dates, names, amounts, and actionable information.';

      // Get category-specific prompt if available
      if (categoryId) {
        log('DEBUG', 'Fetching category-specific prompt', { requestId, categoryId });
        const { data: category } = await supabaseClient
          .from('document_categories')
          .select('name')
          .eq('id', categoryId)
          .single();

        if (category) {
          log('DEBUG', 'Category found', { requestId, categoryName: category.name });
          const { data: aiPrompt } = await supabaseClient
            .from('ai_prompts')
            .select('prompt_text')
            .eq('category', category.name)
            .eq('target_table', 'documents')
            .eq('target_field', 'summary')
            .single();

          if (aiPrompt) {
            systemPrompt = aiPrompt.prompt_text;
            log('INFO', 'Using category-specific prompt', { requestId, categoryName: category.name });
          } else {
            log('DEBUG', 'No custom prompt for category', { requestId, categoryName: category.name });
          }
        }
      }

      log('DEBUG', 'Calling Lovable AI for summary generation', { requestId, textPreview: fullText.substring(0, 100) });
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

      log('DEBUG', 'Summary response received', { requestId, status: summaryResponse.status });

      if (!summaryResponse.ok) {
        const errorText = await summaryResponse.text();
        log('ERROR', 'Summary generation failed', { requestId, status: summaryResponse.status, error: errorText });
      } else {
        const summaryData = await summaryResponse.json();
        summary = summaryData.choices?.[0]?.message?.content || 'Summary could not be generated.';
        log('INFO', 'Summary generated successfully', { requestId, summaryLength: summary.length });
      }
    } else {
      log('INFO', 'Skipping summary generation', { requestId, reason: fullText.length === 0 ? 'No text extracted' : 'Text too short', textLength: fullText.length });
    }

    // Step 3: Insert document record with summary already populated
    log('INFO', 'Inserting document record', { 
      requestId,
      hasText: !!fullText,
      hasSummary: !!summary,
      processingStatus: 'completed'
    });
    
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
      log('ERROR', 'Database insert failed', { requestId, error: insertError.message });
      // Clean up uploaded file if database insert fails
      await supabaseClient.storage.from('documents').remove([fileName]);
      throw new Error(`Failed to create document record: ${insertError.message}`);
    }

    log('INFO', 'Document processing completed successfully', { 
      requestId,
      documentId: insertedDoc.id,
      textLength: fullText.length,
      summaryLength: summary.length,
      usedGemini
    });

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
    log('ERROR', 'Request failed', { 
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
