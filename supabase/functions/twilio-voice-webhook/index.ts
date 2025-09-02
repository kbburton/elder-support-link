import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface TwilioRequest {
  CallSid: string;
  From: string;
  To: string;
  CallStatus: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Twilio voice webhook called');
    
    const formData = await req.formData();
    const twilioData: TwilioRequest = {
      CallSid: formData.get('CallSid') as string,
      From: formData.get('From') as string,
      To: formData.get('To') as string,
      CallStatus: formData.get('CallStatus') as string,
    };

    console.log('Twilio data:', twilioData);

    // Format phone number (remove +1 if present for US numbers)
    const cleanPhone = twilioData.From.replace(/^\+1/, '').replace(/\D/g, '');
    const formattedPhone = `+${cleanPhone}`;

    console.log('Looking up phone:', formattedPhone);

    // Find care group by phone number
    const { data: careGroup, error: careGroupError } = await supabase
      .from('care_groups')
      .select('id, name, voice_pin, phone_auth_attempts, phone_lockout_until')
      .eq('recipient_phone', formattedPhone)
      .single();

    console.log('Care group lookup result:', { careGroup, error: careGroupError });

    if (careGroupError || !careGroup) {
      console.log('Phone number not recognized');
      return new Response(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>I'm sorry, but this phone number is not recognized in our system. Please call from a registered number or contact support for assistance.</Say>
          <Hangup/>
        </Response>
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Check if phone is locked out
    if (careGroup.phone_lockout_until && new Date(careGroup.phone_lockout_until) > new Date()) {
      console.log('Phone is locked out until:', careGroup.phone_lockout_until);
      return new Response(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>This phone number is temporarily locked due to multiple incorrect PIN attempts. Please try again later or contact support.</Say>
          <Hangup/>
        </Response>
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Check if PIN is set up
    if (!careGroup.voice_pin) {
      console.log('No PIN set up for care group');
      return new Response(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Please set up your voice PIN in the app to continue. Visit your profile settings to create a four-digit PIN for voice access.</Say>
          <Hangup/>
        </Response>
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Start PIN authentication flow
    const gatherUrl = `https://yfwgegapmggwywrnzqvg.functions.supabase.co/twilio-voice-pin-verify`;
    
    return new Response(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>Hello! Welcome to ${careGroup.name}'s care assistant. Please enter your four-digit PIN followed by the pound key.</Say>
        <Gather action="${gatherUrl}" method="POST" numDigits="4" finishOnKey="#" timeout="10">
        </Gather>
        <Say>I didn't receive your PIN. Please try again.</Say>
        <Redirect>${gatherUrl}</Redirect>
      </Response>
    `, {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error in Twilio webhook:', error);
    return new Response(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>I'm sorry, there was an error processing your request. Please try again later.</Say>
        <Hangup/>
      </Response>
    `, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });
  }
});