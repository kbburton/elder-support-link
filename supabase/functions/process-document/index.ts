import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      const fileType = document.file_type?.toLowerCase() || '';

      // Process based on file type
      if (fileType.includes('pdf')) {
        // For PDF files, we'll use OpenAI vision to extract text
        const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
        extractedText = await extractTextWithOpenAI(base64File, 'pdf');
      } else if (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg')) {
        // For image files, use OpenAI vision for OCR
        const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
        extractedText = await extractTextWithOpenAI(base64File, 'image');
      } else {
        // For other file types, try to extract as text
        extractedText = new TextDecoder().decode(fileBuffer);
      }

      // Generate AI summary
      const summary = await generateSummary(extractedText);

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
          summary: summary
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (processingError) {
      console.error('Processing error:', processingError);
      
      // Update status to failed
      await supabaseClient
        .from('documents')
        .update({ processing_status: 'failed' })
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

async function extractTextWithOpenAI(base64File: string, fileType: string): Promise<string> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = fileType === 'pdf' 
    ? 'Please extract all text content from this PDF document. Return only the text content without any formatting or explanations.'
    : 'Please extract all text content from this image using OCR. Return only the text content without any formatting or explanations.';

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
                url: `data:image/${fileType === 'pdf' ? 'pdf' : 'jpeg'};base64,${base64File}`
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
  return data.choices[0]?.message?.content || '';
}

async function generateSummary(text: string): Promise<string> {
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
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes medical and care-related documents. Focus on key points, dates, medications, important actions, and any critical information that caregivers need to know. Keep summaries concise but comprehensive.'
        },
        {
          role: 'user',
          content: `Please provide a concise summary of the following document content, highlighting key points, dates, medications, and important actions:\n\n${text.substring(0, 8000)}`
        }
      ],
      max_tokens: 500
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'Summary could not be generated.';
}