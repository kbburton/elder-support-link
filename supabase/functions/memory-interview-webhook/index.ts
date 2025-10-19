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

    console.log('=== WEBHOOK CALL RECEIVED ===');
    console.log('CallSid:', callSid);
    console.log('From (raw):', from);
    console.log('To:', to);
    console.log('Timestamp:', new Date().toISOString());

    if (!from) {
      console.error('ERROR: No caller phone number provided');
      throw new Error('No caller phone number provided');
    }

    // Normalize phone number
    const normalizedPhone = from.replace(/[^\d+]/g, '');
    console.log('Normalized phone:', normalizedPhone);

    // Check for scheduled interview with detailed logging
    const now = new Date();
    const windowStart = new Date(now.getTime() - 30 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 30 * 60 * 1000);
    
    console.log('=== TIME WINDOW CHECK (UTC) ===');
    console.log('  Current time (UTC):', now.toISOString());
    console.log('  Window start (UTC):', windowStart.toISOString());
    console.log('  Window end (UTC):', windowEnd.toISOString());
    console.log('  Searching for phone:', normalizedPhone);

    const { data: interview, error: interviewError } = await supabase
      .from('memory_interviews')
      .select(`
        *,
        care_groups (
          id,
          recipient_first_name
        )
      `)
      .eq('recipient_phone', normalizedPhone)
      .eq('status', 'scheduled')
      .gte('scheduled_at', windowStart.toISOString())
      .lte('scheduled_at', windowEnd.toISOString())
      .single();

    console.log('Database query result:', { 
      found: !!interview, 
      error: interviewError?.message,
      interviewId: interview?.id,
      scheduledAt: interview?.scheduled_at
    });

    // If there's a scheduled interview, route to memory interview flow
    if (interview) {
      const scheduledTime = new Date(interview.scheduled_at);
      const timeDifferenceMinutes = Math.round((scheduledTime.getTime() - now.getTime()) / 60000);
      
      console.log('✓ INTERVIEW FOUND - Routing to memory interview');
      console.log('  Interview ID:', interview.id);
      console.log('  Scheduled at (UTC):', interview.scheduled_at);
      console.log('  Time difference:', timeDifferenceMinutes, 'minutes', timeDifferenceMinutes > 0 ? '(in future)' : '(in past)');
      console.log('  Care group:', interview.care_groups.id);
      
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
      const voiceUrl = `wss://${supabaseUrl.replace('https://', '')}/functions/v1/memory-interview-voice?interview_id=${interview.id}&call_sid=${callSid}`;

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Hello ${recipientName}! Thank you for calling in for your memory interview. 
    We're going to have a wonderful conversation about your life and memories.
    Let me connect you now.
  </Say>
  <Connect>
    <Stream url="${voiceUrl}" track="both_tracks" statusCallbackEvent="start stop" statusCallback="https://${supabaseUrl.replace('https://', '')}/functions/v1/memory-interview-stream-status"/>
  </Connect>
</Response>`;

      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' }
      });
    }

    // No scheduled interview - route to regular voice chat
    console.log('✗ NO INTERVIEW FOUND - Routing to regular voice chat');
    console.log('  Checked phone:', normalizedPhone);
    console.log('  Window checked (UTC):', windowStart.toISOString(), 'to', windowEnd.toISOString());
    console.log('  Current time (UTC):', now.toISOString());
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
