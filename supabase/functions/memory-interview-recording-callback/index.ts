import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Recording Callback Received ===');
    
    // Parse form data from Twilio
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const recordingSid = formData.get('RecordingSid') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    const recordingDuration = formData.get('RecordingDuration') as string;
    const recordingStatus = formData.get('RecordingStatus') as string;

    console.log('Recording details:', { callSid, recordingSid, recordingUrl, recordingDuration, recordingStatus });

    if (!recordingUrl || recordingStatus !== 'completed') {
      console.log('Recording not completed or missing URL');
      return new Response('OK', { status: 200 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the interview by call_sid
    const { data: interview, error: interviewError } = await supabase
      .from('memory_interviews')
      .select('id, care_group_id')
      .eq('twilio_call_sid', callSid)
      .single();

    if (interviewError || !interview) {
      console.error('Interview not found:', interviewError);
      return new Response('Interview not found', { status: 404 });
    }

    console.log('Found interview:', interview.id);

    // Download the recording from Twilio
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const downloadUrl = `${recordingUrl}.mp3`;
    
    console.log('Downloading recording from:', downloadUrl);
    
    const audioResponse = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!audioResponse.ok) {
      throw new Error(`Failed to download recording: ${audioResponse.statusText}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    
    console.log('Audio downloaded, size:', audioBlob.size, 'bytes');

    // Upload to Supabase Storage
    const storagePath = `${interview.care_group_id}/${interview.id}/${recordingSid}.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from('memory-interview-audio')
      .upload(storagePath, audioBlob, {
        contentType: 'audio/mpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    console.log('Audio uploaded to:', storagePath);

    // Update interview with audio URL and duration
    const { error: updateError } = await supabase
      .from('memory_interviews')
      .update({
        audio_url: storagePath,
        audio_duration_seconds: parseInt(recordingDuration) || null
      })
      .eq('id', interview.id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    console.log('✓ Interview updated with audio info');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing recording callback:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});