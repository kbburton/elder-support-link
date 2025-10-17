import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const callSid = formData.get('CallSid')?.toString();
    const from = formData.get('From')?.toString();
    const to = formData.get('To')?.toString();

    console.log('Call received - routing:', { callSid, from, to });

    if (!from) {
      throw new Error('No caller phone number provided');
    }

    // Normalize phone number
    const normalizedPhone = from.replace(/[^\d+]/g, '');

    // Check if there's a scheduled memory interview for this phone number
    const { data: interview } = await supabase
      .from('memory_interviews')
      .select(`
        *,
        care_groups (
          recipient_first_name,
          recipient_last_name
        )
      `)
      .eq('recipient_phone', normalizedPhone)
      .eq('status', 'scheduled')
      .gte('scheduled_for', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .lte('scheduled_for', new Date(Date.now() + 30 * 60 * 1000).toISOString())
      .single();

    // If there's a scheduled interview, route to memory interview flow
    if (interview) {
      console.log('Routing to memory interview for:', interview.id);
      
      // Update interview status
      await supabase
        .from('memory_interviews')
        .update({ 
          status: 'in_progress',
          call_sid: callSid,
          actual_start_time: new Date().toISOString()
        })
        .eq('id', interview.id);

      const recipientName = interview.care_groups.recipient_first_name;
      const voiceUrl = `https://${supabaseUrl.replace('https://', '')}/functions/v1/memory-interview-voice?interview_id=${interview.id}&call_sid=${callSid}`;

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Hello ${recipientName}! Thank you for calling in for your memory interview. 
    We're going to have a wonderful conversation about your life and memories.
    Let me connect you now.
  </Say>
  <Connect>
    <Stream url="${voiceUrl}"/>
  </Connect>
</Response>`;

      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' }
      });
    }

    // No scheduled interview - route to regular voice chat
    console.log('No interview found, routing to regular voice chat');
    const enhancedPinVerifyUrl = `https://${supabaseUrl.replace('https://', '')}/functions/v1/enhanced-twilio-pin-verify`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Welcome to the Care Coordination System.</Say>
  <Redirect>${enhancedPinVerifyUrl}</Redirect>
</Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error('Error in routing webhook:', error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    We're sorry, but we encountered an error. Please try again later or contact support.
  </Say>
  <Hangup/>
</Response>`;

    return new Response(errorTwiml, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' }
    });
  }
});
