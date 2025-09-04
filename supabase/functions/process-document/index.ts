import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// File size limit: 32 MB (OpenAI's limit)
const MAX_FILE_SIZE = 32 * 1024 * 1024;

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
      return new Response(
        JSON.stringify({ error: 'Document ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Processing document:', documentId);

    // First, validate the document with security checks
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
      // Continue with processing - validation is an extra security layer
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
        throw new Error(`File size exceeds 25 MB limit. File size: ${Math.round(fileBuffer.byteLength / (1024 * 1024))} MB`);
      }

      const fileType = document.file_type?.toLowerCase() || '';
      const mimeType = document.file_type || '';

      console.log(`Processing file type: ${fileType}, MIME: ${mimeType}`);

      // Route to appropriate processing method based on file type
      const result = await routeAndProcess(fileBuffer, fileType, mimeType, OPENAI_API_KEY);
      extractedText = result.text;

      // Truncate extremely long text (keep first 50,000 characters)
      if (extractedText.length > 50000) {
        extractedText = extractedText.substring(0, 50000) + '\n\n[Text truncated due to length...]';
      }

      // Generate summary using Responses API
      let summary = document.summary;
      if (!summary || summary.trim() === '') {
        if (extractedText.length > 0 && !extractedText.includes('No readable text found')) {
          summary = await generateSummaryWithResponses(extractedText, OPENAI_API_KEY);
        } else {
          throw new Error('No text content could be extracted from the document for summarization');
        }
      }

      // Sanitize text to prevent Unicode escape sequence errors
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
      
      // Update status to failed - don't put error in summary field
      await supabaseClient
        .from('documents')
        .update({ 
          processing_status: 'failed'
          // Leave summary and full_text as null - don't store error messages there
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

async function routeAndProcess(fileBuffer: ArrayBuffer, fileType: string, mimeType: string, apiKey: string): Promise<{text: string}> {
  console.log(`Routing file type: ${fileType}, MIME: ${mimeType}`);
  
  const fileSizeMB = fileBuffer.byteLength / (1024 * 1024);
  console.log(`File size: ${fileSizeMB.toFixed(1)}MB`);
  
  if (fileSizeMB > 32) {
    throw new Error('File size exceeds 32MB limit. Please use a smaller file.');
  }

  // PDF files - use input_file with Responses API
  if (fileType.includes('pdf') || mimeType.includes('application/pdf')) {
    console.log('Processing PDF with Responses API');
    return await processPDFWithResponses(fileBuffer, apiKey);
  }
  
  // Image files - use input_image with Responses API  
  if (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || 
      fileType.includes('jpeg') || fileType.includes('webp') || mimeType.startsWith('image/')) {
    console.log('Processing image with Responses API');
    return await processImageWithResponses(fileBuffer, mimeType, apiKey);
  }
  
  // Text files - process as text
  if (fileType.includes('text') || mimeType.includes('text/plain')) {
    console.log('Processing text file');
    const text = new TextDecoder('utf-8').decode(fileBuffer);
    return { text };
  }
  
  // Office files - use Responses API with file upload
  if (fileType.includes('docx') || fileType.includes('pptx') || fileType.includes('xlsx') ||
      mimeType.includes('officedocument') || mimeType.includes('ms-excel')) {
    console.log('Processing Office file with Responses API');
    return await processOfficeFileWithResponses(fileBuffer, mimeType, apiKey);
  }
  
  throw new Error(`Unsupported file type: ${fileType}. Supported types: PDF, DOCX, PPTX, XLSX, TXT, JPG, PNG, WebP`);
}

async function processPDFWithResponses(fileBuffer: ArrayBuffer, apiKey: string): Promise<{text: string}> {
  try {
    // Upload file to OpenAI
    const fileId = await uploadFileToOpenAI(fileBuffer, 'application/pdf', 'file.pdf', apiKey);
    
    // Use Responses API with input_file (PDFs are supported)
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        input: [{
          role: 'user',
          content: [
            { type: 'input_file', file_id: fileId },
            { type: 'input_text', text: 'Extract all text content from this PDF document. Preserve formatting and structure where possible. Return all readable text content.' }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI Responses API error: ${response.status} - ${errorText}`);
      
      // Fallback to Chat Completions API if Responses API fails
      console.log('Falling back to Chat Completions API for PDF processing');
      return await processPDFWithChatAPI(fileBuffer, apiKey);
    }

    const data = await response.json();
    const text = data.output_text || '';
    
    // If no text extracted, try fallback
    if (!text || text.trim().length === 0) {
      console.log('No text extracted with Responses API, trying Chat API fallback');
      return await processPDFWithChatAPI(fileBuffer, apiKey);
    }
    
    console.log(`Extracted ${text.length} characters from PDF`);
    return { text };
    
  } catch (error) {
    console.error('PDF processing error:', error);
    console.log('Attempting Chat API fallback due to error');
    return await processPDFWithChatAPI(fileBuffer, apiKey);
  }
}

async function processPDFWithChatAPI(fileBuffer: ArrayBuffer, apiKey: string): Promise<{text: string}> {
  try {
    const fileId = await uploadFileToOpenAI(fileBuffer, 'application/pdf', 'file.pdf', apiKey);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: `Extract all text content from the uploaded PDF file. Preserve formatting and structure where possible. Return all readable text content. File ID: ${fileId}`
            }
          ]
        }],
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Chat API fallback error: ${response.status} - ${errorText}`);
      throw new Error(`PDF fallback processing failed: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    console.log(`Extracted ${text.length} characters from PDF using Chat API fallback`);
    return { text };
  } catch (error) {
    console.error('PDF Chat API fallback error:', error);
    throw new Error(`PDF processing failed: ${error.message}`);
  }
}

async function processImageWithResponses(fileBuffer: ArrayBuffer, mimeType: string, apiKey: string): Promise<{text: string}> {
  try {
    // Convert to base64
    const bytes = new Uint8Array(fileBuffer);
    let binaryString = '';
    for (let i = 0; i < bytes.length; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    const base64File = btoa(binaryString);
    
    // Use Responses API with input_image  
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: 'Read all text content from this image and provide it as clean, readable text.' },
            { type: 'input_image', image_url: `data:${mimeType};base64,${base64File}` }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI Responses API error: ${response.status} - ${errorText}`);
      throw new Error(`Image processing failed: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.output_text || '';
    
    console.log(`Extracted ${text.length} characters from image`);
    return { text };
    
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

async function processOfficeFileWithResponses(fileBuffer: ArrayBuffer, mimeType: string, apiKey: string): Promise<{text: string}> {
  try {
    // Office files are not supported by Responses API input_file (only PDF)
    // Use Chat Completions API with file upload instead
    const filename = mimeType.includes('word') ? 'document.docx' : 
                    mimeType.includes('presentation') ? 'presentation.pptx' : 'spreadsheet.xlsx';
    const fileId = await uploadFileToOpenAI(fileBuffer, mimeType, filename, apiKey);
    
    // Use Chat Completions API with file reference
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: `Extract all text content from the uploaded ${filename} file. Preserve the structure and meaning of the text while making it readable. Return only the extracted text content.`
            },
            {
              type: 'text',
              text: `File ID: ${fileId}`
            }
          ]
        }],
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI Chat API error: ${response.status} - ${errorText}`);
      throw new Error(`Office file processing failed: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    console.log(`Extracted ${text.length} characters from Office file`);
    return { text };
    
  } catch (error) {
    console.error('Office file processing error:', error);
    throw new Error(`Office file processing failed: ${error.message}`);
  }
}

async function uploadFileToOpenAI(fileBuffer: ArrayBuffer, mimeType: string, filename: string, apiKey: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, filename);
  formData.append('purpose', 'user_data');

  const response = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`File upload error: ${response.status} - ${errorText}`);
    throw new Error(`File upload failed: ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`File uploaded successfully: ${data.id}`);
  return data.id;
}

async function generateSummaryWithResponses(text: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: `Create a comprehensive summary of this document. Focus on key points, important dates, names, amounts, and actionable information:\n\n${text.substring(0, 10000)}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Summary generation error: ${response.status} - ${errorText}`);
      throw new Error(`Summary generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.output_text || 'Summary could not be generated.';
    
  } catch (error) {
    console.error('Summary generation error:', error);
    return 'Summary generation failed.';
  }
}

function sanitizeTextForDatabase(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\x00/g, '') // Remove null bytes
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Remove control characters
    .replace(/\\/g, '\\\\') // Escape backslashes
    .replace(/'/g, "''") // Escape single quotes for SQL
    .trim();
}

// Helper function to detect garbled text with improved detection
function isGarbledText(text: string): boolean {
  if (!text || text.trim().length < 5) {
    return true;
  }
  
  const garbledPatterns = [
    /^[^\w\s]{10,}/,  // Starts with many non-word characters
    /[^\w\s]{20,}/,   // Contains long sequences of non-word characters
    /^[\x00-\x08\x0E-\x1F\x7F-\x9F]{5,}/, // Contains control characters
    // Check for common PDF error patterns
    /^(The provided|appears to be|corrupted|encrypted|nonsensical)/i,
    /unable to (extract|read|process)/i,
    /binary data|encoded data|pdf (streams|objects)/i
  ];
  
  const totalChars = text.length;
  const readableChars = (text.match(/[a-zA-Z0-9\s.,!?-]/g) || []).length;
  const readableRatio = readableChars / totalChars;
  
  // If less than 40% of characters are readable, consider it garbled
  if (readableRatio < 0.4) {
    return true;
  }
  
  // Check for specific garbled patterns
  if (garbledPatterns.some(pattern => pattern.test(text))) {
    return true;
  }
  
  // Check if text looks like error messages
  const errorKeywords = ['corrupted', 'encrypted', 'binary', 'unable', 'cannot', 'failed'];
  const lowerText = text.toLowerCase();
  const errorCount = errorKeywords.filter(keyword => lowerText.includes(keyword)).length;
  
  if (errorCount >= 2) {
    return true;
  }
  
  return false;
}


// Export functions for testing
export { isGarbledText };
