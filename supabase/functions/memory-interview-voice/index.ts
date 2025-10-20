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

    twilioWs.onopen = () => {
      console.log('✅ Twilio WebSocket connected');
    };

    twilioWs.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('📨 Message from Twilio:', msg.event);

        if (msg.event === 'start' || msg.event === 'connected') {
          streamSid = msg.start.streamSid;
          console.log('🎬 Stream started:', streamSid);

          // Connect to OpenAI
          console.log('🤖 Connecting to OpenAI Realtime API...');
          openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'OpenAI-Beta': 'realtime=v1',
            },
          });

          openaiWs.onopen = () => {
            console.log('✅ Connected to OpenAI (awaiting session.created)');
          };

          openaiWs.onmessage = (event) => {
            try {
              const response = JSON.parse(event.data);

              if (response.type === 'session.created') {
                console.log('🆗 OpenAI session.created');
                const sessionConfig = {
                  type: 'session.update',
                  session: {
                    modalities: ['text', 'audio'],
                    instructions:
                      'You are a compassionate interviewer conducting a memory preservation interview. Ask the person to share stories and memories from their life. Be warm, patient, and encouraging. Ask follow-up questions to help them elaborate on their experiences. Start proactively with a warm greeting and first question.',
                    voice: 'alloy',
                    input_audio_format: 'g711_ulaw',
                    output_audio_format: 'g711_ulaw',
                    turn_detection: { type: 'server_vad' },
                    temperature: 0.8,
                  },
                };
                console.log('📤 Sending session.update to OpenAI');
                openaiWs!.send(JSON.stringify(sessionConfig));

                // Proactively kick off the conversation so users hear a greeting immediately
                openaiWs!.send(
                  JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'message',
                      role: 'user',
                      content: [
                        {
                          type: 'input_text',
                          text:
                            'Please begin the memory interview with a warm greeting and your first question.',
                        },
                      ],
                    },
                  })
                );
                openaiWs!.send(JSON.stringify({ type: 'response.create' }));
              } else if (response.type === 'response.audio.delta' && response.delta) {
                // Forward audio from OpenAI to Twilio
                const audioMessage = {
                  event: 'media',
                  streamSid: streamSid,
                  media: { payload: response.delta },
                };
                twilioWs.send(JSON.stringify(audioMessage));
              } else if (response.type === 'response.audio_transcript.delta' && response.delta) {
                console.log('📝 Partial transcript:', response.delta);
              } else if (response.type === 'error') {
                console.error('❌ OpenAI error:', response.error);
              } else {
                console.log('📨 OpenAI event:', response.type);
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

        } else if (msg.event === 'media') {
          if (!streamSid && (msg.streamSid || msg?.start?.streamSid)) {
            streamSid = msg.streamSid || msg?.start?.streamSid;
            console.log('🔎 Captured streamSid from media:', streamSid);
          }

          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            // Forward audio from Twilio to OpenAI
            const audioAppend = {
              type: 'input_audio_buffer.append',
              audio: msg.media.payload,
            };
            openaiWs.send(JSON.stringify(audioAppend));
          } else {
            console.warn('⚠️ Received media before OpenAI connection was ready');
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
