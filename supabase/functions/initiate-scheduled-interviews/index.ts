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
    // Validate environment variables
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('Missing required Twilio environment variables');
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    let interviews = [];

    // Check if this is a manual trigger for a specific interview
    if (body.interview_id) {
      console.log(`=== MANUAL TRIGGER FOR INTERVIEW ${body.interview_id} ===`);
      
      const { data, error } = await supabase
        .from('memory_interviews')
        .select(`
          *,
          care_groups (
            id,
            recipient_first_name,
            recipient_last_name,
            date_of_birth
          ),
          interview_questions (
            id,
            question_text
          )
        `)
        .eq('id', body.interview_id)
        .eq('status', 'scheduled')
        .is('twilio_call_sid', null)
        .single();

      if (error || !data) {
        console.error('Interview not found or already processed:', error);
        return new Response(
          JSON.stringify({ error: 'Interview not found or already processed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      interviews = [data];
    } else {
      // Cron job mode - look for interviews scheduled in the next 3 minutes
      console.log('=== CHECKING FOR SCHEDULED INTERVIEWS (CRON MODE) ===');
      
      const now = new Date();
      const windowStart = new Date(now.getTime() - 1 * 60 * 1000); // 1 minute ago (in case cron is slightly delayed)
      const windowEnd = new Date(now.getTime() + 3 * 60 * 1000); // 3 minutes from now
      
      console.log('Time window (UTC):', windowStart.toISOString(), 'to', windowEnd.toISOString());

      const { data, error } = await supabase
        .from('memory_interviews')
        .select(`
          *,
          care_groups (
            id,
            recipient_first_name,
            recipient_last_name,
            date_of_birth
          ),
          interview_questions (
            id,
            question_text
          )
        `)
        .eq('status', 'scheduled')
        .gte('scheduled_at', windowStart.toISOString())
        .lte('scheduled_at', windowEnd.toISOString())
        .is('twilio_call_sid', null); // Only get interviews that haven't been called yet

      if (error) {
        console.error('Database query error:', error);
        throw error;
      }

      interviews = data || [];
    }

    console.log(`Found ${interviews.length} interview(s) to initiate`);

    const results = [];

    for (const interview of interviews) {
      try {
        // Mask phone number for logging (show last 4 digits only)
        const maskedPhone = interview.recipient_phone.replace(/(\+\d{1})(\d+)(\d{4})/, '$1***$3');
        console.log(`Initiating call for interview ${interview.id} to ${maskedPhone}`);
        
        // Get question text if one was selected
        const questionText = interview.interview_questions?.question_text || null;
        const recipientName = `${interview.care_groups.recipient_first_name} ${interview.care_groups.recipient_last_name}`;
        
        // Construct the TwiML URL that Twilio will fetch when the call is answered
        // Pass question and recipient info as URL parameters
        const voiceUrl = new URL(`${supabaseUrl}/functions/v1/memory-interview-voice`);
        voiceUrl.searchParams.set('interview_id', interview.id);
        if (questionText) {
          voiceUrl.searchParams.set('question', questionText);
        }
        voiceUrl.searchParams.set('recipient_name', recipientName);
        
        // Make Twilio API call to initiate the call
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`;
        const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
        
        const formData = new URLSearchParams({
          To: interview.recipient_phone,
          From: twilioPhoneNumber,
          Url: voiceUrl.toString(),
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
        console.log(`✅ Call initiated successfully for interview ${interview.id}`);
        console.log(`   CallSid: ${callData.sid}`);
        console.log(`   Status: ${callData.status}`);
        
        // Update interview with call SID and status
        const { error: updateError } = await supabase
          .from('memory_interviews')
          .update({ 
            status: 'in_progress',
            twilio_call_sid: callData.sid,
            updated_at: new Date().toISOString()
          })
          .eq('id', interview.id);

        if (updateError) {
          console.error(`Failed to update interview ${interview.id}:`, updateError);
        }

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
