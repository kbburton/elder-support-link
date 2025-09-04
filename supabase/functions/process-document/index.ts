import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// File size limit: 25 MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

      // Process based on file type
      if (fileType.includes('pdf') || mimeType.includes('application/pdf')) {
        extractedText = await processPDF(fileBuffer);
      } else if (fileType.includes('docx') || fileType.includes('word document') || mimeType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || mimeType.includes('Word Document')) {
        extractedText = await processDOCX(fileBuffer);
      } else if (fileType.includes('pptx') || mimeType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')) {
        extractedText = await processPPTX(fileBuffer);
      } else if (fileType.includes('xlsx') || mimeType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        extractedText = await processXLSX(fileBuffer);
      } else if (fileType.includes('xls') || mimeType.includes('application/vnd.ms-excel')) {
        // For older Excel files, try text extraction or OCR
        extractedText = await processXLSX(fileBuffer);
      } else if (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg') || fileType.includes('webp') || mimeType.startsWith('image/')) {
        // For image files, use OpenAI vision for OCR - using chunked approach for large files
        const bytes = new Uint8Array(fileBuffer);
        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) {
          binaryString += String.fromCharCode(bytes[i]);
        }
        const base64File = btoa(binaryString);
        extractedText = await extractTextWithOpenAI(base64File, 'image');
      } else if (fileType.includes('text') || mimeType.includes('text/plain')) {
        // For text files, decode directly
        extractedText = new TextDecoder('utf-8').decode(fileBuffer);
      } else {
        throw new Error(`Unsupported file type: ${fileType}. Supported types: PDF, DOCX, PPTX, XLSX, TXT, JPG, PNG, WebP`);
      }

      // Truncate extremely long text (keep first 50,000 characters)
      if (extractedText.length > 50000) {
        extractedText = extractedText.substring(0, 50000) + '\n\n[Text truncated due to length...]';
      }

      // Generate summary if needed
      let summary = document.summary;
      if (!summary || summary.trim() === '') {
        if (extractedText.length > 0 && !extractedText.includes('No readable text found')) {
          summary = await generateSummary(extractedText);
        } else {
          // No text extracted or error message - this should trigger error modal
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

async function processPDF(fileBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log('Processing PDF with OpenAI vision API');
    
    // Check file size - OpenAI vision API has a 20MB limit
    const fileSizeMB = fileBuffer.byteLength / (1024 * 1024);
    if (fileSizeMB > 19) {
      throw new Error(`PDF file too large for vision API: ${fileSizeMB.toFixed(1)}MB. Maximum is 20MB.`);
    }
    
    console.log(`PDF file size: ${fileSizeMB.toFixed(1)}MB`);
    
    // Use chunked base64 encoding to avoid memory issues
    const base64File = encodeBase64Chunked(fileBuffer);
    return await extractTextWithOpenAI(base64File, 'pdf');
  } catch (error) {
    console.error('Failed to process PDF with OpenAI:', error);
    throw new Error(`PDF processing failed: ${error.message}`);
  }
}

async function processDOCX(fileBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log('Processing DOCX file...');
    
    // DOCX files are compressed ZIP archives containing XML. Simple text decoding won't work.
    // Fall back to OpenAI vision API for text extraction
    console.log('Using OpenAI vision API for DOCX text extraction');
    const bytes = new Uint8Array(fileBuffer);
    const base64File = encodeBase64Chunked(fileBuffer);
    return await extractTextWithOpenAI(base64File, 'docx');
  } catch (error) {
    console.error('Error processing DOCX:', error);
    throw new Error(`DOCX processing failed: ${error.message}`);
  }
}

// Helper function for chunked base64 encoding to handle large files
function encodeBase64Chunked(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB chunks to avoid call stack limits
  let result = '';
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    result += btoa(String.fromCharCode.apply(null, Array.from(chunk)));
  }
  
  return result;
}

async function processPPTX(fileBuffer: ArrayBuffer): Promise<string> {
  // Simple PPTX processing - extract text from slides
  try {
    const text = new TextDecoder().decode(fileBuffer);
    let extractedText = '';
    
    // Look for slide text content
    const textMatches = text.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
    for (const match of textMatches) {
      const content = match.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, '');
      extractedText += content + ' ';
    }
    
    // Also look for paragraph text
    const pMatches = text.match(/<a:p[^>]*>.*?<\/a:p>/gs) || [];
    for (const match of pMatches) {
      const textContent = match.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (textContent.length > 2) {
        extractedText += textContent + ' ';
      }
    }
    
    return extractedText.trim() || 'No readable text found in PPTX file.';
  } catch (error) {
    console.error('Error processing PPTX:', error);
    return 'Error processing PPTX file.';
  }
}

async function processXLSX(fileBuffer: ArrayBuffer): Promise<string> {
  // Simple XLSX processing - extract cell values
  try {
    const text = new TextDecoder().decode(fileBuffer);
    let extractedText = '';
    
    // Look for shared strings
    const stringMatches = text.match(/<t[^>]*>([^<]+)<\/t>/g) || [];
    for (const match of stringMatches) {
      const content = match.replace(/<t[^>]*>/, '').replace(/<\/t>/, '');
      if (content.length > 1 && /[a-zA-Z]/.test(content)) {
        extractedText += content + ' ';
      }
    }
    
    // Look for inline text
    const inlineMatches = text.match(/<is><t[^>]*>([^<]+)<\/t><\/is>/g) || [];
    for (const match of inlineMatches) {
      const content = match.replace(/<[^>]*>/g, '');
      if (content.length > 1) {
        extractedText += content + ' ';
      }
    }
    
    return extractedText.trim() || 'No readable text found in XLSX file.';
  } catch (error) {
    console.error('Error processing XLSX:', error);
    return 'Error processing XLSX file.';
  }
}

async function extractTextWithOpenAI(base64File: string, fileType: string): Promise<string> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  let prompt = 'Please extract all text content from this image using OCR. Return only the text content without any formatting or explanations. Include all visible text, even if it appears to be handwritten.';
  let mimeType = 'image/jpeg';
  
  if (fileType === 'pdf') {
    prompt = 'Extract all readable text from this PDF document. Focus on the actual content that would be useful for healthcare professionals and caregivers. Return only the extracted text without any formatting, explanations, or metadata. If this is a scanned document, use OCR to extract all visible text.';
    mimeType = 'application/pdf';
  } else if (fileType === 'docx') {
    prompt = 'Please extract all readable text content from this Microsoft Word document (.docx). Return only the actual document text that a human would read, preserving the meaning but removing formatting. Do not include any metadata, headers, footers, or technical information about the file structure.';
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  console.log(`Calling OpenAI with ${fileType} file, size: ${(base64File.length * 0.75 / 1024 / 1024).toFixed(1)}MB`);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
      body: JSON.stringify({
        model: 'gpt-4o',  // Use gpt-4o for better PDF handling like ChatGPT
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64File}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000  // gpt-4o uses max_tokens, not max_completion_tokens
      }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const extractedText = data.choices[0]?.message?.content || '';
  console.log(`Extracted ${extractedText.length} characters from ${fileType}`);
  return extractedText;
}

async function generateSummary(text: string): Promise<string> {
  if (!text || text.trim().length === 0) {
    throw new Error('No content available to summarize');
  }
  
  // Check for error messages that shouldn't be summarized
  const errorPatterns = [
    'no visible text',
    'cannot read',
    'unable to extract',
    'processing failed',
    'could not be extracted',
    'compressed or encoded format',
    'could not be processed',
    'cannot extract text from this file',
    'sorry, i can\'t extract text'
  ];
  
  const lowerText = text.toLowerCase();
  const hasErrorPattern = errorPatterns.some(pattern => lowerText.includes(pattern));
  
  if (hasErrorPattern) {
    throw new Error('Document content appears to contain error messages rather than actual document text');
  }

  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
      body: JSON.stringify({
        model: 'gpt-4.1-mini-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise summaries of documents. Focus on key points, important dates, medications, actions needed, and critical information. Keep summaries under 300 words and make them useful for caregivers and healthcare professionals.'
          },
          {
            role: 'user',
            content: `Please provide a concise summary of the following document content, highlighting the most important information:\n\n${text.substring(0, 10000)}`
          }
        ],
        max_completion_tokens: 400
      }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to generate summary:', errorText);
    throw new Error(`Summary generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  const summary = data.choices[0]?.message?.content;
  if (!summary) {
    throw new Error('No summary content returned from AI');
  }
  return summary;
}

// Sanitize text to prevent Unicode escape sequence errors in PostgreSQL
function sanitizeTextForDatabase(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    // Remove null bytes which can cause PostgreSQL issues
    .replace(/\0/g, '')
    // Replace problematic Unicode escape sequences
    .replace(/\\u[0-9a-fA-F]{4}/g, '')
    // Replace other control characters that might cause issues
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
