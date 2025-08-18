import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    console.log('Processing document:', documentId);

    // Get document details
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) {
      throw new Error(`Document not found: ${docError.message}`);
    }

    if (!document.file_url) {
      throw new Error('Document has no file URL');
    }

    // Update status to processing
    await supabaseClient
      .from('documents')
      .update({ processing_status: 'processing' })
      .eq('id', documentId);

    let extractedText = '';
    let summary = '';

    try {
      // Download the file
      console.log('Downloading file from:', document.file_url);
      const fileResponse = await fetch(document.file_url);
      if (!fileResponse.ok) {
        throw new Error(`Failed to download file: ${fileResponse.statusText}`);
      }

      const fileBuffer = await fileResponse.arrayBuffer();
      const fileType = document.file_type?.toLowerCase() || '';
      
      console.log('File type:', fileType, 'Size:', fileBuffer.byteLength);

      // Extract text based on file type
      if (fileType.includes('image/') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg')) {
        // Use OpenAI Vision API for images
        console.log('Processing image with OpenAI Vision API');
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
        
        const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Please extract all text content from this image. Return only the text content, no commentary or formatting.'
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${document.file_type};base64,${base64Image}`
                    }
                  }
                ]
              }
            ],
            max_completion_tokens: 4000
          }),
        });

        if (!visionResponse.ok) {
          throw new Error(`OpenAI Vision API failed: ${visionResponse.statusText}`);
        }

        const visionData = await visionResponse.json();
        extractedText = visionData.choices[0]?.message?.content || 'No text found in image';
        
      } else if (fileType.includes('pdf')) {
        // For PDFs, we'll need a PDF parsing library or service
        // For now, we'll use a placeholder approach
        console.log('PDF processing not yet implemented, using text extraction service');
        extractedText = 'PDF text extraction will be implemented in a future update.';
        
      } else if (fileType.includes('text/') || fileType.includes('document')) {
        // Handle text files and documents
        const decoder = new TextDecoder();
        extractedText = decoder.decode(fileBuffer);
        
      } else {
        extractedText = 'Unsupported file type for text extraction.';
      }

      console.log('Extracted text length:', extractedText.length);

      // Generate AI summary if we have extracted text
      if (extractedText && extractedText !== 'No text found in image' && extractedText.length > 50) {
        console.log('Generating AI summary');
        const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                content: 'You are a helpful assistant that creates concise, informative summaries of documents. Focus on key points, important dates, and actionable information.'
              },
              {
                role: 'user',
                content: `Please create a concise summary of this document content:\n\n${extractedText.slice(0, 8000)}`
              }
            ],
            max_completion_tokens: 500
          }),
        });

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          summary = summaryData.choices[0]?.message?.content || 'Unable to generate summary';
        } else {
          console.warn('Failed to generate summary:', summaryResponse.statusText);
          summary = 'Summary generation failed';
        }
      } else {
        summary = extractedText.length > 100 ? extractedText.slice(0, 100) + '...' : extractedText;
      }

      // Update document with extracted content
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
          documentId,
          extractedText: extractedText.slice(0, 1000), // Return first 1000 chars for response
          summary,
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
    console.error('Error in process-document-text function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});