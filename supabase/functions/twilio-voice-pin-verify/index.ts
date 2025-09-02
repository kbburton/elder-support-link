import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('PIN verification called');
    
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const digits = formData.get('Digits') as string;

    console.log('PIN verification data:', { callSid, from, digits });

    // Format phone number
    const cleanPhone = from.replace(/^\+1/, '').replace(/\D/g, '');
    const formattedPhone = `+${cleanPhone}`;

    // Find care group by phone number
    const { data: careGroup, error: careGroupError } = await supabase
      .from('care_groups')
      .select('id, name, voice_pin, phone_auth_attempts, phone_lockout_until')
      .eq('recipient_phone', formattedPhone)
      .single();

    if (careGroupError || !careGroup) {
      console.log('Care group not found during PIN verification');
      return new Response(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Authentication error. Please try calling again.</Say>
          <Hangup/>
        </Response>
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Verify PIN
    const pinMatch = await bcrypt.compare(digits, careGroup.voice_pin);
    console.log('PIN verification result:', pinMatch);

    if (pinMatch) {
      // Reset failed attempts on successful login
      await supabase
        .from('care_groups')
        .update({ 
          phone_auth_attempts: 0,
          phone_lockout_until: null 
        })
        .eq('id', careGroup.id);

      console.log('PIN verified successfully, starting voice chat');

      // Start WebSocket connection to OpenAI Realtime API
      const chatUrl = `https://yfwgegapmggwywrnzqvg.functions.supabase.co/twilio-voice-chat?careGroupId=${careGroup.id}&callSid=${callSid}`;
      
      return new Response(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>PIN verified! Welcome to your care assistant. I can help you with information about appointments, tasks, documents, and contacts. How can I assist you today?</Say>
          <Connect>
            <Stream url="${chatUrl}" />
          </Connect>
        </Response>
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    } else {
      // Increment failed attempts
      const newAttempts = (careGroup.phone_auth_attempts || 0) + 1;
      let lockoutUntil = null;
      
      if (newAttempts >= 4) {
        // Lock out for 24 hours after 4 failed attempts
        lockoutUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }

      await supabase
        .from('care_groups')
        .update({ 
          phone_auth_attempts: newAttempts,
          phone_lockout_until: lockoutUntil
        })
        .eq('id', careGroup.id);

      const remainingAttempts = 4 - newAttempts;
      
      if (lockoutUntil) {
        console.log('Phone locked out after 4 failed attempts');
        return new Response(`
          <?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say>Incorrect PIN. This phone number is now locked for 24 hours due to multiple failed attempts. Please contact support if you need assistance.</Say>
            <Hangup/>
          </Response>
        `, {
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
        });
      } else {
        console.log(`Incorrect PIN, ${remainingAttempts} attempts remaining`);
        return new Response(`
          <?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say>Incorrect PIN. You have ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining. Please enter your four-digit PIN followed by the pound key.</Say>
            <Gather action="https://yfwgegapmggwywrnzqvg.functions.supabase.co/twilio-voice-pin-verify" method="POST" numDigits="4" finishOnKey="#" timeout="10">
            </Gather>
            <Say>I didn't receive your PIN. Goodbye.</Say>
            <Hangup/>
          </Response>
        `, {
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
        });
      }
    }

  } catch (error) {
    console.error('Error in PIN verification:', error);
    return new Response(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>I'm sorry, there was an authentication error. Please try again later.</Say>
        <Hangup/>
      </Response>
    `, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });
  }
});