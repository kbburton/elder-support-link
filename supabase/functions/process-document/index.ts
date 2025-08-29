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
        // For image files, use OpenAI vision for OCR
        const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
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
        if (extractedText.length > 0) {
          summary = await generateSummary(extractedText);
        } else {
          // Don't set summary if no text - let it remain null/empty
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
    // First, try to extract embedded text using a simple approach
    const pdfText = extractEmbeddedTextFromPDF(fileBuffer);
    
    // If we get very little text (< 1000 chars), assume it's scanned and use OCR
    if (pdfText.length < 1000) {
      console.log('PDF has little embedded text, using OCR');
      const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
      return await extractTextWithOpenAI(base64File, 'pdf');
    }
    
    return pdfText;
  } catch (error) {
    console.log('Failed to extract embedded text, falling back to OCR:', error);
    const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
    return await extractTextWithOpenAI(base64File, 'pdf');
  }
}

function extractEmbeddedTextFromPDF(fileBuffer: ArrayBuffer): string {
  // Simple PDF text extraction - look for text objects
  const pdfText = new TextDecoder('latin1').decode(fileBuffer);
  const textMatches = pdfText.match(/\(([^)]+)\)/g) || [];
  
  let extractedText = '';
  for (const match of textMatches) {
    const text = match.slice(1, -1); // Remove parentheses
    if (text.length > 2 && /[a-zA-Z]/.test(text)) {
      extractedText += text + ' ';
    }
  }
  
  // Also look for stream content
  const streamMatches = pdfText.match(/stream\s*(.*?)\s*endstream/gs) || [];
  for (const stream of streamMatches) {
    const content = stream.replace(/^stream\s*/, '').replace(/\s*endstream$/, '');
    const readable = content.replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
    if (readable.length > 10) {
      extractedText += readable + ' ';
    }
  }
  
  return extractedText.trim();
}

async function processDOCX(fileBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log('Processing DOCX file...');
    
    // DOCX files are ZIP archives - we need proper ZIP extraction
    // First, try to extract text using OpenAI's document understanding (not vision)
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured for DOCX processing');
    }

    // Convert to base64 for AI processing
    const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are a document text extraction specialist. You will receive a Microsoft Word document (.docx) file. Extract all the readable text content from this document, preserving the meaning but removing formatting. Return only the actual document text content - no metadata, headers, footers, or technical information about the file structure.'
          },
          {
            role: 'user',
            content: `Please extract all readable text from this DOCX document. Return only the document content that a human would read, formatted as plain text:\n\nFile data: ${base64File.substring(0, 20000)}`
          }
        ],
        max_completion_tokens: 4000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error for DOCX:', errorText);
      throw new Error(`Failed to process DOCX document: ${response.statusText}`);
    }

    const data = await response.json();
    const extractedText = data.choices[0]?.message?.content || '';
    
    // Check if the AI actually extracted meaningful content
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No readable text could be extracted from the DOCX document');
    }
    
    // Check for common error patterns from the AI
    const errorPatterns = [
      'no visible text',
      'cannot read',
      'unable to extract',
      'appears to be corrupted',
      'binary data',
      'file structure data',
      'encoded XML components',
      'compressed or encoded format',
      'could not be processed',
      'cannot extract text from this file',
      'sorry, i can\'t extract text'
    ];
    
    const lowerText = extractedText.toLowerCase();
    const hasErrorPattern = errorPatterns.some(pattern => lowerText.includes(pattern));
    
    if (hasErrorPattern) {
      throw new Error('DOCX document appears to be corrupted or unreadable');
    }
    
    console.log(`Successfully extracted ${extractedText.length} characters from DOCX`);
    return extractedText.trim();
    
  } catch (error) {
    console.error('Error processing DOCX:', error);
    throw new Error(`DOCX processing failed: ${error.message}`);
  }
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

  const prompt = fileType === 'pdf' 
    ? 'Please extract all text content from this PDF document. Return only the text content without any formatting or explanations. If this is a scanned document, perform OCR to extract all visible text.'
    : 'Please extract all text content from this image using OCR. Return only the text content without any formatting or explanations. Include all visible text, even if it appears to be handwritten.';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${fileType === 'pdf' ? 'application/pdf' : 'image/jpeg'};base64,${base64File}`
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
    throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
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
      max_tokens: 400,
      temperature: 0.3
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
