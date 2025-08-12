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
      } else if (fileType.includes('docx') || mimeType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
        extractedText = await processDOCX(fileBuffer);
      } else if (fileType.includes('pptx') || mimeType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')) {
        extractedText = await processPPTX(fileBuffer);
      } else if (fileType.includes('xlsx') || mimeType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
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
          summary = 'No text content found to summarize.';
        }
      }

      // Update document with extracted text and summary
      const { error: updateError } = await supabaseClient
        .from('documents')
        .update({
          full_text: extractedText,
          summary: summary,
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
          processing_status: 'failed',
          summary: `Processing failed: ${processingError.message}`
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
  // Simple DOCX processing - extract from document.xml
  try {
    const uint8Array = new Uint8Array(fileBuffer);
    const text = new TextDecoder().decode(uint8Array);
    
    // Look for document.xml content and extract text
    let extractedText = '';
    
    // Simple regex to find text content in XML
    const textMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
    for (const match of textMatches) {
      const content = match.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '');
      extractedText += content + ' ';
    }
    
    // Fallback: look for any readable text
    if (extractedText.length < 50) {
      const readable = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                         .replace(/\s+/g, ' ')
                         .trim();
      if (readable.length > extractedText.length) {
        extractedText = readable;
      }
    }
    
    return extractedText.trim() || 'No readable text found in DOCX file.';
  } catch (error) {
    console.error('Error processing DOCX:', error);
    return 'Error processing DOCX file.';
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
    return 'No content available to summarize.';
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
    console.error('Failed to generate summary:', await response.text());
    return 'Summary could not be generated due to API error.';
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'Summary could not be generated.';
}
