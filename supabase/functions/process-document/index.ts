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
    console.log('Processing PDF with OpenAI');
    
    // Check file size
    const fileSizeMB = fileBuffer.byteLength / (1024 * 1024);
    console.log(`PDF file size: ${fileSizeMB.toFixed(1)}MB`);
    
    if (fileSizeMB > 20) {
      throw new Error('PDF file too large (>20MB). Please use a smaller file.');
    }
    
    // Use OpenAI's text extraction directly
    return await extractPDFTextWithOpenAI(fileBuffer);
    
  } catch (error) {
    console.error('Failed to process PDF:', error);
    throw new Error(`PDF processing failed: ${error.message}`);
  }
}

async function processDOCX(fileBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log('Processing DOCX file...');
    
    // DOCX files are ZIP archives containing XML files
    // Try to extract text content from the document structure
    const bytes = new Uint8Array(fileBuffer);
    const textDecoder = new TextDecoder();
    let content = '';
    
    try {
      const xmlContent = textDecoder.decode(bytes);
      
      // Look for text content in XML structure (simplified approach)
      const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      content = textMatches
        .map(match => match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
        .join(' ')
        .trim();
        
      // Also look for paragraph text
      const paragraphMatches = xmlContent.match(/<w:p[^>]*>.*?<\/w:p>/gs) || [];
      const paragraphText = paragraphMatches
        .map(p => p.replace(/<[^>]*>/g, ' '))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
        
      if (paragraphText.length > content.length) {
        content = paragraphText;
      }
      
    } catch (extractError) {
      console.log('XML extraction failed, trying simple text decode');
      content = textDecoder.decode(bytes);
    }
    
    console.log(`Extracted ${content.length} characters from DOCX`);
    
    if (content && content.length > 50 && !isGarbledText(content)) {
      return content;
    }
    
    // If we couldn't extract meaningful text, inform the user
    throw new Error('Unable to extract readable text from DOCX file. Please try converting to PDF or uploading as plain text.');
    
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

// New function for PDF text extraction with proper approach
async function extractTextFromPDFAsImage(fileBuffer: ArrayBuffer): Promise<string> {
  console.log('Processing PDF with hybrid approach');
  
  try {
    // First try direct text extraction from PDF structure
    const directText = extractDirectTextFromPDF(fileBuffer);
    console.log(`Direct text extraction found ${directText.length} characters`);
    
    if (directText.length > 100 && !isGarbledText(directText)) {
      console.log('Successfully extracted text directly from PDF structure');
      return directText;
    }
    
    // If direct extraction failed, use OpenAI for text extraction
    console.log('Direct extraction insufficient, using OpenAI for PDF text extraction');
    return await extractPDFTextWithOpenAI(fileBuffer);
    
  } catch (error) {
    console.error('PDF text extraction error:', error);
    throw new Error(`No readable text could be extracted from PDF: ${error.message}`);
  }
}

// Extract text directly from PDF structure (for text-based PDFs)
function extractDirectTextFromPDF(fileBuffer: ArrayBuffer): string {
  try {
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = textDecoder.decode(fileBuffer);
    
    let extractedText = '';
    
    // Look for text in parentheses (common PDF text encoding)
    const textInParens = rawText.match(/\(([^)]+)\)\s*Tj/g);
    if (textInParens) {
      for (const match of textInParens) {
        const text = match.replace(/^\(|\)\s*Tj$/g, '');
        if (text && text.length > 1 && /[a-zA-Z]/.test(text)) {
          extractedText += text + ' ';
        }
      }
    }
    
    // Look for text in arrays
    const textInArrays = rawText.match(/\[([^\]]+)\]\s*TJ/g);
    if (textInArrays) {
      for (const match of textInArrays) {
        const content = match.replace(/^\[|\]\s*TJ$/g, '');
        const textParts = content.match(/\(([^)]+)\)/g);
        if (textParts) {
          for (const part of textParts) {
            const text = part.replace(/[()]/g, '');
            if (text && text.length > 1 && /[a-zA-Z]/.test(text)) {
              extractedText += text + ' ';
            }
          }
        }
      }
    }
    
    return extractedText.trim();
  } catch (error) {
    console.error('Direct PDF text extraction failed:', error);
    return '';
  }
}

// Extract text from PDF using OpenAI's text processing
async function extractPDFTextWithOpenAI(fileBuffer: ArrayBuffer): Promise<string> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    console.log('Processing PDF with OpenAI text analysis');
    
    // Convert PDF buffer to base64
    const base64File = encodeBase64Chunked(fileBuffer);
    
    console.log(`Sending PDF to OpenAI for text extraction, size: ${(fileBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
    
    // Use OpenAI's vision model that can handle PDF documents
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Extract all text content from this PDF document. Preserve formatting and structure where possible.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64File}`
                }
              }
            ]
          }
        ],
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI PDF processing error: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`OpenAI PDF processing failed: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const extractedText = data.choices[0]?.message?.content || '';
    
    console.log(`OpenAI extracted ${extractedText.length} characters from PDF`);
    
    // Check if the extracted text looks valid
    if (extractedText && extractedText.length > 20 && !isGarbledText(extractedText)) {
      return extractedText;
    }
    
    // If text seems invalid, provide more context to OpenAI
    console.log('First extraction attempt produced invalid text, trying alternative approach');
    
    const secondResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are processing a PDF document that may be scanned or have complex formatting. Extract any readable text you can find, even if it appears fragmented. If the document appears to be corrupted or unreadable, clearly state that no meaningful text can be extracted.'
          },
          {
            role: 'user',
            content: `This PDF document may be challenging to read. Please attempt to extract any meaningful text content you can identify:

${base64File.substring(0, 50)}...

If no readable text can be found, please explain what type of content you can identify in the document.`
          }
        ],
        max_tokens: 2000
      }),
    });

    if (secondResponse.ok) {
      const secondData = await secondResponse.json();
      const secondText = secondData.choices[0]?.message?.content || '';
      if (secondText && secondText.length > 10) {
        return secondText;
      }
    }
    
    throw new Error('Could not extract meaningful text from PDF document');
    
  } catch (error) {
    console.error('OpenAI PDF processing error:', error);
    throw error;
  }
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

async function extractTextWithOpenAI(base64File: string, fileType: string): Promise<string> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // For other file types (images, docx), use vision API
  let prompt = 'Please extract all text content from this image using OCR. Return only the text content without any formatting or explanations. Include all visible text, even if it appears to be handwritten.';
  let mimeType = 'image/jpeg';
  
  if (fileType === 'docx') {
    prompt = 'Please extract all readable text content from this Microsoft Word document (.docx). Return only the actual document text that a human would read, preserving the meaning but removing formatting. Do not include any metadata, headers, footers, or technical information about the file structure.';
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  console.log(`Calling OpenAI vision API with ${fileType} file, size: ${(base64File.length * 0.75 / 1024 / 1024).toFixed(1)}MB`);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
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
      max_tokens: 4000
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

// Export functions for testing
export { extractTextFromPDFAsImage, extractPDFTextWithOpenAI, isGarbledText };
