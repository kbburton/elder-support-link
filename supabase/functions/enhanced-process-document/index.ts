import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FILE_SIZE_LIMIT = 32 * 1024 * 1024; // 32MB

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
      processingVersion: '3.0-gemini'
    };

    // Convert file to base64 for Gemini
    const bytes = new Uint8Array(fileBuffer);
    let binaryString = '';
    for (let i = 0; i < bytes.length; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    const base64File = btoa(binaryString);

    const mimeType = document.file_type || fileData.type || 'application/octet-stream';

    // Extract text using Gemini (handles all file types natively)
    let extractedText = '';
    try {
      extractedText = await extractTextWithGemini(base64File, mimeType, LOVABLE_API_KEY);
    } catch (error) {
      console.error('Text extraction error:', error);
      extractedText = `Text extraction failed: ${error.message}`;
    }

    // Log text extraction result
    await supabaseClient.from('system_logs').insert({
      level: 'INFO',
      component: 'enhanced-process-document',
      operation: 'text_extraction',
      message: `Extracted ${extractedText.length} characters from document`,
      metadata: { documentId, textLength: extractedText.length, fileType: mimeType }
    });

    // Truncate if too long
    if (extractedText.length > 50000) {
      extractedText = extractedText.substring(0, 50000) + '\n... (content truncated)';
    }

    // Generate category-specific summary
    let summary = '';
    if (extractedText.trim().length > 0 && !extractedText.includes('failed')) {
      summary = await generateCategorySpecificSummary(extractedText, document.category, supabaseClient, LOVABLE_API_KEY);
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

async function extractTextWithGemini(base64File: string, mimeType: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text content from this document. Preserve formatting and structure where possible. Return all readable text content. If this is a PDF, image, Word document, PowerPoint, or Excel file, carefully read and transcribe all visible text.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64File}`
                }
              }
            ]
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
      
      throw new Error(`Text extraction failed: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    console.log(`Extracted ${text.length} characters using Gemini`);
    return text || 'No text could be extracted';
    
  } catch (error) {
    console.error('Gemini text extraction error:', error);
    throw error;
  }
}

async function generateCategorySpecificSummary(text: string, category: string | null, supabaseClient: any, apiKey: string): Promise<string> {
  // Get category-specific prompt
  let systemPrompt = "You are a document summarization expert. Create concise, comprehensive summaries that capture key points, important dates, and actionable information.";
  
  if (category) {
    const { data: prompts } = await supabaseClient
      .from('ai_prompts')
      .select('prompt_text')
      .eq('category', category)
      .eq('target_table', 'documents')
      .eq('target_field', 'summary')
      .limit(1);
      
    if (prompts && prompts.length > 0) {
      systemPrompt = prompts[0].prompt_text;
    }
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
            content: `Please create a summary of this document:\n\n${text.substring(0, 10000)}`
          }
        ]
      })
    });

    if (!response.ok) {
      console.error(`Summary generation error: ${response.status}`);
      
      if (response.status === 429) {
        return 'Summary could not be generated due to rate limits. Please try again later.';
      }
      if (response.status === 402) {
        return 'Summary could not be generated. AI credits exhausted.';
      }
      
      return 'Summary could not be generated.';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Summary could not be generated.';
    
  } catch (error) {
    console.error('Summary generation error:', error);
    return 'Summary generation failed.';
  }
}
