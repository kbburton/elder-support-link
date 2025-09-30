import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FILE_SIZE = 32 * 1024 * 1024; // 32 MB

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
      return new Response(
        JSON.stringify({ error: 'Document ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Processing document:', documentId);

    // Validate the document with security checks
    try {
      const { error: validationError } = await supabaseClient.functions.invoke('validate-document', {
        body: { documentId }
      });

      if (validationError) {
        console.error('Document validation failed:', validationError);
        return new Response(
          JSON.stringify({ error: 'Document validation failed', details: validationError }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    } catch (validationError) {
      console.error('Validation service error:', validationError);
    }

    // Get document from database
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document not found:', docError);
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Update processing status
    await supabaseClient
      .from('documents')
      .update({ processing_status: 'processing' })
      .eq('id', documentId);

    let extractedText = '';
    
    try {
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from('documents')
        .download(document.file_url.split('/').pop() || '');

      if (downloadError) {
        throw new Error(`Failed to download file: ${downloadError.message}`);
      }

      const fileBuffer = await fileData.arrayBuffer();
      
      // Check file size limit
      if (fileBuffer.byteLength > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds 32 MB limit. File size: ${Math.round(fileBuffer.byteLength / (1024 * 1024))} MB`);
      }

      const fileType = document.file_type?.toLowerCase() || '';
      const mimeType = document.file_type || '';

      console.log(`Processing file type: ${fileType}, MIME: ${mimeType}`);

      // For all files, try to extract text using basic methods first
      // This will work for Office docs, plain text, etc.
      let basicExtractedText = '';
      
      if (mimeType.includes('officedocument') || mimeType.includes('ms-excel')) {
        basicExtractedText = await extractOfficeText(fileBuffer, mimeType);
      } else if (mimeType.includes('text/plain')) {
        basicExtractedText = new TextDecoder('utf-8').decode(fileBuffer);
      }

      // If basic extraction got substantial text, use it
      if (basicExtractedText.trim().length > 100) {
        extractedText = basicExtractedText;
        console.log(`Used basic extraction: ${extractedText.length} characters`);
      } else {
        // Otherwise use Gemini for PDFs and images
        const bytes = new Uint8Array(fileBuffer);
        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) {
          binaryString += String.fromCharCode(bytes[i]);
        }
        const base64File = btoa(binaryString);

        extractedText = await extractTextWithGemini(base64File, mimeType, LOVABLE_API_KEY);
      }

      // Truncate extremely long text (keep first 50,000 characters)
      if (extractedText.length > 50000) {
        extractedText = extractedText.substring(0, 50000) + '\n\n[Text truncated due to length...]';
      }

      // Generate summary
      let summary = document.summary;
      if (!summary || summary.trim() === '') {
        if (extractedText.length > 0 && !extractedText.includes('No readable text found')) {
          summary = await generateSummaryWithGemini(extractedText, LOVABLE_API_KEY);
        } else {
          throw new Error('No text content could be extracted from the document for summarization');
        }
      }

      // Sanitize text to prevent database errors
      const sanitizedText = sanitizeTextForDatabase(extractedText);
      const sanitizedSummary = sanitizeTextForDatabase(summary);

      // Update document with extracted text and summary
      const { error: updateError } = await supabaseClient
        .from('documents')
        .update({
          full_text: sanitizedText,
          summary: sanitizedSummary,
          processing_status: 'completed'
        })
        .eq('id', documentId);

      if (updateError) {
        throw new Error(`Failed to update document: ${updateError.message}`);
      }

      console.log('Document processing completed successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Document processed successfully',
          summary: summary,
          textLength: extractedText.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (processingError) {
      console.error('Processing error:', processingError);
      
      // Update status to failed
      await supabaseClient
        .from('documents')
        .update({ 
          processing_status: 'failed'
        })
        .eq('id', documentId);

      throw processingError;
    }

  } catch (error) {
    console.error('Error in process-document function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
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
                text: 'Extract all text content from this document. Preserve formatting and structure where possible. Return all readable text content. If this is a PDF, image, or office document, carefully read and transcribe all visible text.'
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
      
      // Handle rate limits and payment errors
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
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the document');
    }
    
    console.log(`Extracted ${text.length} characters using Gemini`);
    return text;
    
  } catch (error) {
    console.error('Gemini text extraction error:', error);
    throw new Error(`Text extraction failed: ${error.message}`);
  }
}

async function generateSummaryWithGemini(text: string, apiKey: string): Promise<string> {
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
            content: 'You are a document summarization expert. Create concise, comprehensive summaries that capture key points, important dates, names, amounts, and actionable information.'
          },
          {
            role: 'user',
            content: `Create a comprehensive summary of this document:\n\n${text.substring(0, 10000)}`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Summary generation error: ${response.status} - ${errorText}`);
      
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

async function extractOfficeText(fileBuffer: ArrayBuffer, mimeType: string): Promise<string> {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(fileBuffer);
    
    // Try multiple extraction patterns for Office formats
    let extractedText = '';
    const allMatches: string[] = [];
    
    if (mimeType.includes('wordprocessingml')) {
      // DOCX - try multiple patterns
      const patterns = [
        /<w:t[^>]*>([^<]+)<\/w:t>/g,
        /<w:t>([^<]+)<\/w:t>/g,
        /<text[^>]*>([^<]+)<\/text>/g,
      ];
      
      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          allMatches.push(...matches.map(m => m.replace(/<[^>]+>/g, '').trim()));
        }
      }
    } else if (mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel')) {
      // XLSX - extract cell values
      const patterns = [
        /<t[^>]*>([^<]+)<\/t>/g,
        /<v>([^<]+)<\/v>/g,
        /<si><t>([^<]+)<\/t><\/si>/g,
      ];
      
      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          allMatches.push(...matches.map(m => m.replace(/<[^>]+>/g, '').trim()));
        }
      }
    } else if (mimeType.includes('presentationml')) {
      // PPTX - extract slide text
      const patterns = [
        /<a:t[^>]*>([^<]+)<\/a:t>/g,
        /<a:t>([^<]+)<\/a:t>/g,
      ];
      
      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          allMatches.push(...matches.map(m => m.replace(/<[^>]+>/g, '').trim()));
        }
      }
    }
    
    // Clean and combine extracted text
    extractedText = allMatches
      .filter(t => t.length > 0 && !t.match(/^[\s\n\r]*$/))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (extractedText.length > 0) {
      console.log(`Extracted ${extractedText.length} characters from Office document`);
      return extractedText;
    }
    
    console.log('No text extracted from Office document, returning empty');
    return '';
    
  } catch (error) {
    console.error('Office text extraction error:', error);
    return '';
  }
}

function sanitizeTextForDatabase(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\x00/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .trim();
}
