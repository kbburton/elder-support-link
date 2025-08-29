import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

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

    // Log processing start
    await supabaseClient.from('system_logs').insert({
      level: 'INFO',
      component: 'enhanced-process-document',
      operation: 'processing_start',
      message: `Starting enhanced document processing for ${documentId}`,
      metadata: { documentId }
    });

    // Validate document security first
    const validateResponse = await supabaseClient.functions.invoke('validate-document', {
      body: { documentId }
    });
    
    if (validateResponse.error) {
      await supabaseClient.from('system_logs').insert({
        level: 'ERROR',
        component: 'enhanced-process-document',
        operation: 'validation_failed',
        message: `Document validation failed: ${validateResponse.error.message}`,
        metadata: { documentId, error: validateResponse.error }
      });
      throw new Error(`Document validation failed: ${validateResponse.error.message}`);
    }

    // Fetch document details
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) {
      throw new Error(`Document not found: ${docError.message}`);
    }

    // Update processing status
    await supabaseClient
      .from('documents')
      .update({ processing_status: 'processing' })
      .eq('id', documentId);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(document.file_url);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    const fileBuffer = await fileData.arrayBuffer();
    
    // Check file size
    if (fileBuffer.byteLength > FILE_SIZE_LIMIT) {
      throw new Error(`File size exceeds limit of ${FILE_SIZE_LIMIT / (1024 * 1024)}MB`);
    }

    // Extract file metadata
    const fileMetadata = {
      size: fileBuffer.byteLength,
      mimeType: fileData.type,
      processedAt: new Date().toISOString(),
      processingVersion: '2.0'
    };

    // Extract text based on file type
    let extractedText = '';
    const fileType = document.file_type?.toLowerCase() || '';
    const filename = document.original_filename?.toLowerCase() || '';

    if (fileType.includes('pdf') || filename.endsWith('.pdf')) {
      extractedText = await processPDF(fileBuffer);
    } else if (fileType.includes('word') || filename.endsWith('.docx') || filename.endsWith('.doc')) {
      extractedText = await processDOCX(fileBuffer);
    } else if (fileType.includes('powerpoint') || filename.endsWith('.pptx') || filename.endsWith('.ppt')) {
      extractedText = await processPPTX(fileBuffer);
    } else if (fileType.includes('excel') || filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      extractedText = await processXLSX(fileBuffer);
    } else if (fileType.includes('image') || /\.(jpg|jpeg|png|gif|bmp|tiff)$/i.test(filename)) {
      const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
      extractedText = await extractTextWithOpenAI(base64File, fileType);
    } else if (fileType.includes('text') || filename.endsWith('.txt')) {
      extractedText = new TextDecoder().decode(fileBuffer);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Log text extraction result
    await supabaseClient.from('system_logs').insert({
      level: 'INFO',
      component: 'enhanced-process-document',
      operation: 'text_extraction',
      message: `Extracted ${extractedText.length} characters from document`,
      metadata: { documentId, textLength: extractedText.length, fileType }
    });

    // Truncate if too long
    if (extractedText.length > 50000) {
      extractedText = extractedText.substring(0, 50000) + '\n... (content truncated)';
    }

    // Generate category-specific summary
    let summary = '';
    if (extractedText.trim().length > 0) {
      summary = await generateCategorySpecificSummary(extractedText, document.category, supabaseClient);
    }

    // Update document with results
    const { error: updateError } = await supabaseClient
      .from('documents')
      .update({
        full_text: extractedText,
        summary: summary,
        file_metadata: fileMetadata,
        processing_status: 'completed'
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    // Log successful completion
    await supabaseClient.from('system_logs').insert({
      level: 'INFO',
      component: 'enhanced-process-document',
      operation: 'processing_completed',
      message: `Successfully processed document with ${extractedText.length} characters and ${summary.length} character summary`,
      metadata: { documentId, textLength: extractedText.length, summaryLength: summary.length }
    });

    return new Response(
      JSON.stringify({
        success: true,
        document: {
          id: documentId,
          full_text: extractedText,
          summary: summary,
          file_metadata: fileMetadata
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in enhanced-process-document:', error);
    
    // Log error to system_logs
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabaseClient.from('system_logs').insert({
        level: 'ERROR',
        component: 'enhanced-process-document',
        operation: 'processing_failed',
        message: error.message,
        metadata: { error: error.stack }
      });

      // Update document status to failed
      const { documentId } = await req.json().catch(() => ({}));
      if (documentId) {
        await supabaseClient
          .from('documents')
          .update({ processing_status: 'failed' })
          .eq('id', documentId);
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Text extraction functions
async function processPDF(fileBuffer: ArrayBuffer): Promise<string> {
  // For now, use OpenAI for PDF processing as it's most reliable
  const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
  return await extractTextWithOpenAI(base64File, 'application/pdf');
}

async function processDOCX(fileBuffer: ArrayBuffer): Promise<string> {
  // Basic DOCX text extraction (simplified)
  try {
    const text = new TextDecoder().decode(fileBuffer);
    // Look for document.xml content patterns
    const matches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (matches) {
      return matches.map(match => match.replace(/<[^>]+>/g, '')).join(' ');
    }
    return 'Unable to extract text from DOCX file';
  } catch (error) {
    throw new Error(`DOCX processing failed: ${error.message}`);
  }
}

async function processPPTX(fileBuffer: ArrayBuffer): Promise<string> {
  // Basic PPTX text extraction (simplified)
  try {
    const text = new TextDecoder().decode(fileBuffer);
    // Look for slide content patterns
    const matches = text.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
    if (matches) {
      return matches.map(match => match.replace(/<[^>]+>/g, '')).join(' ');
    }
    return 'Unable to extract text from PPTX file';
  } catch (error) {
    throw new Error(`PPTX processing failed: ${error.message}`);
  }
}

async function processXLSX(fileBuffer: ArrayBuffer): Promise<string> {
  // Basic XLSX text extraction (simplified)
  try {
    const text = new TextDecoder().decode(fileBuffer);
    // Look for cell content patterns
    const matches = text.match(/<t[^>]*>([^<]+)<\/t>/g);
    if (matches) {
      return matches.map(match => match.replace(/<[^>]+>/g, '')).join(' ');
    }
    return 'Unable to extract text from XLSX file';
  } catch (error) {
    throw new Error(`XLSX processing failed: ${error.message}`);
  }
}

async function extractTextWithOpenAI(base64File: string, fileType: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text content from this document. Return only the text, no formatting or explanations.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${fileType};base64,${base64File}`
              }
            }
          ]
        }
      ],
      max_tokens: 4000
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'No text could be extracted';
}

async function generateCategorySpecificSummary(text: string, category: string | null, supabaseClient: any): Promise<string> {
  // Get category-specific prompt
  let promptText = "Create a comprehensive summary of this document, focusing on key points, important dates, and actionable information.";
  
  if (category) {
    const { data: prompts } = await supabaseClient
      .from('ai_prompts')
      .select('prompt_text')
      .eq('category', category)
      .eq('target_table', 'documents')
      .eq('target_field', 'summary')
      .limit(1);
      
    if (prompts && prompts.length > 0) {
      promptText = prompts[0].prompt_text;
    }
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
          content: promptText
        },
        {
          role: 'user',
          content: `Please create a summary of this document:\n\n${text.substring(0, 10000)}`
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'Summary could not be generated.';
}