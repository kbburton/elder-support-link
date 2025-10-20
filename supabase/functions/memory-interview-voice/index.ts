import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const url = new URL(req.url);
  const interviewIdFromQuery = url.searchParams.get("interview_id");
  const callSidFromQuery = url.searchParams.get("call_id");

  console.log('📞 Request received:', {
    method: req.method,
    url: req.url,
    interviewId: interviewIdFromQuery,
    callSid: callSidFromQuery,
  });

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if this is a WebSocket upgrade request
  const upgrade = req.headers.get("upgrade") || "";
  
  if (upgrade.toLowerCase() === "websocket") {
    console.log('✅ WebSocket upgrade request detected');
    
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not set');
      return new Response('Server configuration error', { status: 500 });
    }

    const { socket: twilioWs, response } = Deno.upgradeWebSocket(req);
    
    let openaiWs: WebSocket | null = null;
    let streamSid: string | null = null;
    let openaiReady = false;
    let twilioReady = false;
    let interviewStarted = false;
    const mediaBuffer: any[] = [];

    // Start interview only when both OpenAI and Twilio are ready
    const startInterviewIfReady = () => {
      if (openaiReady && twilioReady && streamSid && !interviewStarted && openaiWs) {
        console.log('🎙️ Both connections ready - starting interview');
        interviewStarted = true;
        
        openaiWs.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: 'Please greet me and ask your first question to begin the memory interview.',
                },
              ],
            },
          })
        );
        openaiWs.send(JSON.stringify({ type: 'response.create' }));
      }
    };

    twilioWs.onopen = () => {
      console.log('✅ Twilio WebSocket connected, creating OpenAI connection immediately');

      // Connect to OpenAI
      console.log('🤖 Connecting to OpenAI Realtime API...');
      try {
        openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        });
      } catch (e) {
        console.error('❌ Failed to create OpenAI WebSocket:', e);
        return;
      }

      openaiWs.onopen = () => {
        console.log('✅ OpenAI WebSocket connected, awaiting session.created');
      };

      openaiWs.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          console.log('📨 OpenAI event:', response.type);

          if (response.type === 'session.created') {
            console.log('🆗 OpenAI session.created, configuring session');
            const sessionConfig = {
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                instructions:
                  'You are a compassionate interviewer conducting a memory preservation interview. Ask the person to share stories and memories from their life. Be warm, patient, and encouraging. Ask follow-up questions to help them elaborate on their experiences. Start with a warm greeting and your first question.',
                voice: 'alloy',
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'g711_ulaw',
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 800,
                },
                temperature: 0.8,
              },
            };
            openaiWs!.send(JSON.stringify(sessionConfig));
          } else if (response.type === 'session.updated') {
            console.log('✅ Session configured');
            openaiReady = true;
            
            // Send buffered media
            if (mediaBuffer.length > 0) {
              console.log(`📤 Sending ${mediaBuffer.length} buffered media chunks`);
              mediaBuffer.forEach(audioAppend => {
                openaiWs!.send(JSON.stringify(audioAppend));
              });
              mediaBuffer.length = 0;
            }

            // Try to start interview if Twilio is also ready
            startInterviewIfReady();
          } else if (response.type === 'response.audio.delta' && response.delta) {
            // Forward audio from OpenAI to Twilio
            if (!streamSid) {
              console.warn('⚠️ No streamSid available yet, cannot send audio to Twilio');
              return;
            }
            const audioMessage = {
              event: 'media',
              streamSid: streamSid,
              media: { payload: response.delta },
            };
            twilioWs.send(JSON.stringify(audioMessage));
          } else if (response.type === 'response.audio_transcript.delta') {
            console.log('📝 AI transcript:', response.delta);
          } else if (response.type === 'input_audio_buffer.speech_started') {
            console.log('🎤 User started speaking');
          } else if (response.type === 'input_audio_buffer.speech_stopped') {
            console.log('🎤 User stopped speaking');
          } else if (response.type === 'error') {
            console.error('❌ OpenAI error:', JSON.stringify(response.error));
          }
        } catch (error) {
          console.error('❌ Error processing OpenAI message:', error);
        }
      };

      openaiWs.onerror = (error) => {
        console.error('❌ OpenAI WebSocket error:', error);
      };

      openaiWs.onclose = () => {
        console.log('🔌 OpenAI WebSocket closed');
      };
    };

    twilioWs.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('📨 Message from Twilio:', msg.event);

        if (msg.event === 'start') {
          // Capture streamSid from start event
          streamSid = msg.start?.streamSid || streamSid;
          console.log('🎬 Stream start event received, streamSid:', streamSid);
          twilioReady = true;
          
          // Try to start interview if OpenAI is also ready
          startInterviewIfReady();

        } else if (msg.event === 'media') {
          // Backup: capture streamSid from media if we missed the start event
          if (!streamSid && (msg.streamSid || msg?.start?.streamSid)) {
            streamSid = msg.streamSid || msg?.start?.streamSid;
            console.log('🔎 Captured streamSid from media:', streamSid);
            twilioReady = true;
            startInterviewIfReady();
          }

          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            const audioAppend = {
              type: 'input_audio_buffer.append',
              audio: msg.media.payload,
            };
            
            if (openaiReady) {
              // OpenAI is ready, send immediately
              openaiWs.send(JSON.stringify(audioAppend));
            } else {
              // Buffer media until session is configured
              mediaBuffer.push(audioAppend);
              if (mediaBuffer.length === 1) {
                console.log('📦 Buffering media until OpenAI session is ready');
              }
            }
          } else {
            console.warn('⚠️ OpenAI WebSocket not open yet');
          }

        } else if (msg.event === 'stop') {
          console.log('🛑 Stream stopped');
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.close();
          }
        }
      } catch (error) {
        console.error('❌ Error processing Twilio message:', error);
      }
    };

    twilioWs.onerror = (error) => {
      console.error('❌ Twilio WebSocket error:', error);
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
    };

    twilioWs.onclose = () => {
      console.log('🔌 Twilio WebSocket closed');
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
    };

    return response;
    
  } else {
    // This is the initial HTTP request - return TwiML
    const wsUrl = `wss://yfwgegapmggwywrnzqvg.functions.supabase.co/functions/v1/memory-interview-voice?interview_id=${interviewIdFromQuery}${callSidFromQuery ? `&call_id=${callSidFromQuery}` : ''}`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please hold while we connect your memory interview.</Say>
  <Connect>
    <Stream url="${wsUrl}" statusCallback="https://yfwgegapmggwywrnzqvg.functions.supabase.co/functions/v1/memory-interview-stream-status" statusCallbackMethod="POST" />
  </Connect>
</Response>`;

    console.log('✅ Returning TwiML with WebSocket URL');
    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});
