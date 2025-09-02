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
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    const body = await req.text();
    console.log('Raw request body:', body);
    
    // Parse URL-encoded form data manually
    const urlParams = new URLSearchParams(body);
    const twilioData: TwilioRequest = {
      CallSid: urlParams.get('CallSid') || '',
      From: urlParams.get('From') || '',
      To: urlParams.get('To') || '',
      CallStatus: urlParams.get('CallStatus') || '',
    };

    console.log('Parsed Twilio data:', twilioData);

    // Format phone number (remove +1 if present for US numbers)
    const cleanPhone = twilioData.From.replace(/^\+1/, '').replace(/\D/g, '');
    
    console.log('Looking up phone:', cleanPhone);

    // First, check if caller is a care group member
    const { data: memberData, error: memberError } = await supabase
      .from('profiles')
      .select(`
        phone,
        voice_pin,
        phone_auth_attempts,
        phone_lockout_until,
        care_group_members!inner(
          is_admin,
          care_groups!inner(
            id, name
          )
        )
      `)
      .eq('phone', cleanPhone);

    console.log('Member lookup result:', { memberData, error: memberError });

    let careGroup = null;
    let userProfile = null;

    if (!memberError && memberData && memberData.length > 0) {
      // Caller is a care group member
      userProfile = memberData[0];
      careGroup = memberData[0].care_group_members.find(m => m.is_admin)?.care_groups || memberData[0].care_group_members[0].care_groups;
      console.log('Found caller as care group member');
    } else {
      // Check if caller is the care recipient themselves
      const { data: recipientData, error: recipientError } = await supabase
        .from('care_groups')
        .select('id, name, voice_pin, phone_auth_attempts, phone_lockout_until, recipient_phone')
        .eq('recipient_phone', cleanPhone);

      console.log('Recipient lookup result:', { recipientData, error: recipientError });

      if (!recipientError && recipientData && recipientData.length > 0) {
        careGroup = recipientData[0];
        console.log('Found caller as care recipient');
      }
    }

    if (!careGroup) {
      console.log('Phone number not recognized as member or recipient');
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>I'm sorry, but this phone number is not recognized in our system. Please call from a registered number or contact support for assistance.</Say>
  <Hangup/>
</Response>`;
      
      return new Response(twimlResponse, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Check PIN from user profile if it's a member, otherwise from care group
    const voicePin = userProfile?.voice_pin || careGroup.voice_pin;
    const phoneAuthAttempts = userProfile?.phone_auth_attempts || careGroup.phone_auth_attempts || 0;
    const phoneLockoutUntil = userProfile?.phone_lockout_until || careGroup.phone_lockout_until;

    // Check if phone is locked out
    if (phoneLockoutUntil && new Date(phoneLockoutUntil) > new Date()) {
      console.log('Phone is locked out until:', phoneLockoutUntil);
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>This phone number is temporarily locked due to multiple incorrect PIN attempts. Please try again later or contact support.</Say>
  <Hangup/>
</Response>`;
      
      return new Response(twimlResponse, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Check if PIN is set up
    if (!voicePin) {
      console.log('No PIN set up for user/care group');
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Please set up your voice PIN in the app to continue. Visit your profile settings to create a four-digit PIN for voice access.</Say>
  <Hangup/>
</Response>`;
      
      return new Response(twimlResponse, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Start PIN authentication flow
    const gatherUrl = `https://yfwgegapmggwywrnzqvg.functions.supabase.co/twilio-voice-pin-verify`;
    
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Hello! Welcome to ${careGroup.name}'s care assistant. Please enter your four-digit PIN followed by the pound key.</Say>
  <Gather action="${gatherUrl}" method="POST" numDigits="4" finishOnKey="#" timeout="10">
  </Gather>
  <Say>I didn't receive your PIN. Please try again.</Say>
  <Redirect>${gatherUrl}</Redirect>
</Response>`;
    
    return new Response(twimlResponse, {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error in Twilio webhook:', error);
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>I'm sorry, there was an error processing your request. Please try again later.</Say>
  <Hangup/>
</Response>`;
    
    return new Response(twimlResponse, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });
  }
});