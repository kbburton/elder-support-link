import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== CHECKING FOR SCHEDULED INTERVIEWS ===');
    
    // Look for interviews scheduled in the next 3 minutes
    const now = new Date();
    const windowStart = new Date(now.getTime() - 1 * 60 * 1000); // 1 minute ago (in case cron is slightly delayed)
    const windowEnd = new Date(now.getTime() + 3 * 60 * 1000); // 3 minutes from now
    
    console.log('Time window (UTC):', windowStart.toISOString(), 'to', windowEnd.toISOString());

    const { data: interviews, error } = await supabase
      .from('memory_interviews')
      .select(`
        *,
        care_groups (
          id,
          recipient_first_name
        )
      `)
      .eq('status', 'scheduled')
      .gte('scheduled_at', windowStart.toISOString())
      .lte('scheduled_at', windowEnd.toISOString())
      .is('call_sid', null); // Only get interviews that haven't been called yet

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    console.log(`Found ${interviews?.length || 0} interviews to initiate`);

    const results = [];

    for (const interview of interviews || []) {
      try {
        console.log(`Initiating call for interview ${interview.id} to ${interview.recipient_phone}`);
        
        // Construct the TwiML URL that Twilio will fetch when the call is answered
        const voiceUrl = `${supabaseUrl}/functions/v1/memory-interview-voice?interview_id=${interview.id}`;
        
        // Make Twilio API call to initiate the call
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`;
        const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
        
        const formData = new URLSearchParams({
          To: interview.recipient_phone,
          From: twilioPhoneNumber,
          Url: voiceUrl,
          Method: 'POST',
        });

        const callResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        });

        if (!callResponse.ok) {
          const errorText = await callResponse.text();
          console.error(`Twilio API error for interview ${interview.id}:`, errorText);
          
          // Mark interview as failed
          await supabase
            .from('memory_interviews')
            .update({ 
              status: 'failed',
              failure_reason: `Twilio API error: ${errorText}`
            })
            .eq('id', interview.id);

          results.push({
            interview_id: interview.id,
            success: false,
            error: errorText
          });
          continue;
        }

        const callData = await callResponse.json();
        console.log(`Call initiated successfully for interview ${interview.id}, CallSid: ${callData.sid}`);
        
        // Update interview with call SID and status
        await supabase
          .from('memory_interviews')
          .update({ 
            status: 'in_progress',
            call_sid: callData.sid,
            actual_start_time: new Date().toISOString()
          })
          .eq('id', interview.id);

        results.push({
          interview_id: interview.id,
          success: true,
          call_sid: callData.sid
        });

      } catch (interviewError) {
        console.error(`Error processing interview ${interview.id}:`, interviewError);
        
        // Mark interview as failed
        await supabase
          .from('memory_interviews')
          .update({ 
            status: 'failed',
            failure_reason: interviewError instanceof Error ? interviewError.message : 'Unknown error'
          })
          .eq('id', interview.id);

        results.push({
          interview_id: interview.id,
          success: false,
          error: interviewError instanceof Error ? interviewError.message : 'Unknown error'
        });
      }
    }

    console.log('=== INTERVIEW INITIATION COMPLETE ===');
    console.log('Results:', JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: results.length,
        results 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Fatal error in initiate-scheduled-interviews:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
