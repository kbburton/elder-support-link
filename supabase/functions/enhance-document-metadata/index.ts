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

    const { documentId, filename, currentFileType } = await req.json();
    
    if (!documentId || !filename) {
      throw new Error('Document ID and filename are required');
    }

    console.log('Enhancing metadata for document:', documentId, 'filename:', filename);

    // Use AI to determine better file type description
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that provides human-readable file type descriptions. Given a filename, provide a simple, clear description of the file type that would be useful for users. Examples: PDF, Word Document, Excel Spreadsheet, PowerPoint Presentation, JPEG Image, etc.'
          },
          {
            role: 'user',
            content: `What is the best human-readable description for this file type? Filename: "${filename}" Current detected type: "${currentFileType || 'unknown'}". Please respond with just the simple, user-friendly file type name (e.g., "PDF", "Word Document", "Excel Spreadsheet", "JPEG Image", etc.).`
          }
        ],
        max_completion_tokens: 50,
      }),
    });

    if (!response.ok) {
      console.warn('OpenAI API failed, using fallback logic');
      // Fallback to simple extension-based logic
      const extension = filename.split('.').pop()?.toLowerCase();
      let enhancedFileType = '';
      
      switch (extension) {
        case 'pdf': enhancedFileType = 'PDF'; break;
        case 'doc': case 'docx': enhancedFileType = 'Word Document'; break;
        case 'xls': case 'xlsx': enhancedFileType = 'Excel Spreadsheet'; break;
        case 'ppt': case 'pptx': enhancedFileType = 'PowerPoint Presentation'; break;
        case 'txt': enhancedFileType = 'Text Document'; break;
        case 'jpg': case 'jpeg': enhancedFileType = 'JPEG Image'; break;
        case 'png': enhancedFileType = 'PNG Image'; break;
        case 'gif': enhancedFileType = 'GIF Image'; break;
        case 'zip': enhancedFileType = 'ZIP Archive'; break;
        default: enhancedFileType = extension?.toUpperCase() || 'Unknown';
      }
      
      // Update document with enhanced file type
      const { error: updateError } = await supabaseClient
        .from('documents')
        .update({
          file_type: enhancedFileType
        })
        .eq('id', documentId);

      if (updateError) {
        console.error('Failed to update document with fallback type:', updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          enhancedFileType,
          method: 'fallback'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const enhancedFileType = data.choices[0]?.message?.content?.trim() || currentFileType;

    console.log('AI enhanced file type:', enhancedFileType);

    // Update document with AI-enhanced file type
    const { error: updateError } = await supabaseClient
      .from('documents')
      .update({
        file_type: enhancedFileType
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        enhancedFileType,
        method: 'ai'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in enhance-document-metadata function:', error);
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