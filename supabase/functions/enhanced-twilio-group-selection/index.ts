import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Enhanced Twilio group selection called');
    
    // Parse the form data from Twilio
    const body = await req.text();
    const params = new URLSearchParams(body);
    
    const digits = params.get('Digits') || '';
    
    // Parse URL parameters
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');
    const groupIds = url.searchParams.get('groups')?.split(',') || [];
    const groupNames = url.searchParams.get('names')?.split(',') || [];
    
    console.log('Group selection details:', {
      userId,
      digits,
      groupIds: groupIds.length,
      groupNames: groupNames.length
    });

    const selection = parseInt(digits);
    
    if (!selection || selection < 1 || selection > groupIds.length) {
      // Invalid selection - default to first group
      console.log('Invalid selection, defaulting to first group');
      const selectedGroupId = groupIds[0];
      const selectedGroupName = groupNames[0];
      
      const baseUrl = `https://yfwgegapmggwywrnzqvg.functions.supabase.co`;
      const chatUrl = `${baseUrl}/enhanced-twilio-voice-chat?group_id=${selectedGroupId}&user_id=${userId}&type=user`;
      
      // Escape ampersands for proper XML parsing
      const escapedChatUrl = chatUrl.replace(/&/g, '&amp;');
      
      const twimlResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="alice">I didn't understand your selection. Connecting you to ${selectedGroupName}'s care group. What would you like to know?</Say>
          <Connect>
            <Stream url="${escapedChatUrl}"/>
          </Connect>
        </Response>
      `;
      
      return new Response(twimlResponse, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/xml',
        },
      });
    }
    
    // Valid selection - connect to selected group
    const selectedGroupId = groupIds[selection - 1];
    const selectedGroupName = groupNames[selection - 1];
    
    console.log('Valid selection:', { selectedGroupId, selectedGroupName });
    
    const baseUrl = `https://yfwgegapmggwywrnzqvg.functions.supabase.co`;
    const chatUrl = `${baseUrl}/enhanced-twilio-voice-chat?group_id=${selectedGroupId}&user_id=${userId}&type=user`;
    
    // Escape ampersands for proper XML parsing
    const escapedChatUrl = chatUrl.replace(/&/g, '&amp;');
    
    const twimlResponse = `
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">Welcome to ${selectedGroupName}'s care group, what would you like to know?</Say>
        <Connect>
          <Stream url="${escapedChatUrl}"/>
        </Connect>
      </Response>
    `;

    console.log('Sending TwiML response for group selection');

    return new Response(twimlResponse, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });

  } catch (error) {
    console.error('Error in enhanced group selection:', error);
    
    const errorResponse = `
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">I'm sorry, there was an error processing your group selection. Please try again later. Goodbye.</Say>
        <Hangup/>
      </Response>
    `;

    return new Response(errorResponse, {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });
  }
});