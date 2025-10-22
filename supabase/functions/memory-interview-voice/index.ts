/**
 * ARCHITECTURE: Memory Interview Voice Edge Function
 * 
 * CRITICAL: This edge function ONLY generates TwiML instructions for Twilio.
 * It does NOT handle WebSocket connections in production.
 * 
 * FLOW:
 * 1. Twilio calls THIS edge function to get TwiML instructions
 * 2. This function returns TwiML with WebSocket URL pointing to LOCAL SERVER (via ngrok)
 * 3. Twilio connects to ngrok → local server → OpenAI
 * 4. Local server handles real-time audio, interrupts, and AI conversation
 * 
 * WHY THIS ARCHITECTURE:
 * - Edge function: Stateless TwiML generator
 * - Local server: Stateful WebSocket handler with interrupt logic
 * - Interrupt handling requires maintaining OpenAI WebSocket state
 * - Local server allows rapid iteration and debugging without redeployment
 * 
 * WARNING: DO NOT change the WebSocket URL to point back to this edge function!
 * The interrupt logic (response.cancel, clear audio buffer) will NOT work here.
 * It MUST remain in the local server where the OpenAI connection lives.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const url = new URL(req.url);
  const interviewIdFromQuery = url.searchParams.get('interview_id');

  const upgradeHeaderRaw = req.headers.get("upgrade") || '';
  const upgradeHeader = upgradeHeaderRaw.toLowerCase();
  // If this is an initial webhook request from Twilio, return TwiML that connects to our WebSocket
  if (upgradeHeader !== "websocket") {
    // Twilio sends x-www-form-urlencoded with CallSid
    let callSid = url.searchParams.get('call_sid') || '';
    try {
      const bodyText = await req.text();
      const params = new URLSearchParams(bodyText);
      callSid = callSid || params.get('CallSid') || '';
    } catch {}

    console.log('Initial TwiML request', {
      interviewIdFromQuery,
      callSid,
      userAgent: req.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
    });

    if (!interviewIdFromQuery) {
      console.error('ERROR: Missing interview_id on initial TwiML request');
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Say voice="alice">An error occurred initializing your interview. Please try again later.</Say><Hangup/></Response>`,
        { status: 400, headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // CRITICAL: This URL must point to the LOCAL SERVER (via ngrok), NOT this edge function
    // The local server handles real-time WebSocket connections and interrupt logic
    // Architecture: Twilio → ngrok → local server → OpenAI
    // DO NOT change this to point back to the Supabase edge function URL!
    const wsUrlBase = Deno.env.get('NGROK_WEBSOCKET_URL') || 'wss://alonzo-unpropagandistic-nonsymbolically.ngrok-free.dev/media-stream';
    
    // Status callback can stay pointing to Supabase for logging
    const statusCallbackUrl = `https://yfwgegapmggwywrnzqvg.functions.supabase.co/functions/v1/memory-interview-stream-status`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Connect>\n    <Stream url=\"${wsUrlBase}\" statusCallback=\"${statusCallbackUrl}\" statusCallbackMethod=\"POST\">\n      <Parameter name=\"interview_id\" value=\"${interviewIdFromQuery}\"/>\n      ${callSid ? `<Parameter name=\"call_sid\" value=\"${callSid}\"/>` : ''}\n    </Stream>\n  </Connect>\n</Response>`;

    console.log('Responding with TwiML to connect stream to LOCAL SERVER:', wsUrlBase, { interviewIdFromQuery, callSid });
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  let interviewId: string | null = null;
  let callSid: string | null = null;

  console.log('=== WEBSOCKET UPGRADE REQUEST ===');
  console.log('Timestamp:', new Date().toISOString());
  
  let interview: any = null;
  let questions: any[] = [];
  let systemInstructions = '';
  let recipientInfo: any = null;
  let recipientName = '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Negotiate Twilio subprotocol if provided (required for Twilio Media Streams)
  const requestedProtocols = req.headers.get('sec-websocket-protocol')?.split(',').map(p => p.trim()) || [];
  const preferredProtocol = requestedProtocols.find(p => p.toLowerCase().includes('audio')) || requestedProtocols[0];
  if (requestedProtocols.length) console.log('Requested WebSocket subprotocols from Twilio:', requestedProtocols);
  if (preferredProtocol) console.log('Negotiating WebSocket subprotocol:', preferredProtocol);
 
  const upgradeOpts = preferredProtocol ? { protocol: preferredProtocol } as any : undefined as any;
  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req, upgradeOpts);
  const websocketHandler = (async () => {
    let openaiWs: WebSocket | null = null;
    let transcriptBuffer: string[] = [];
    let currentQuestionIndex = 0;
    let streamSid: string | null = null;
    const pendingAudioDeltas: string[] = [];
    const pendingMediaPayloads: string[] = [];
    let mediaCount = 0;
    let sessionInitialized = false;
    let callEnded = false;
    let openaiConfigured = false;
    // Keepalive to prevent Twilio and OpenAI from closing the connection
    let twilioKeepaliveInterval: number | null = null;
    let openaiKeepaliveInterval: number | null = null;

    const initializeSession = async () => {
      try {
        if (!interviewId) {
          console.error('Cannot initialize: interviewId is null');
          return false;
        }

        console.log('Initializing session for interview:', interviewId);

        // Get interview details
        const { data: interviewData, error: interviewError } = await supabase
          .from('memory_interviews')
          .select(`
            *,
            care_groups (
              id,
              recipient_first_name,
              recipient_last_name,
              date_of_birth,
              profile_description
            )
          `)
          .eq('id', interviewId)
          .single();

        if (interviewError || !interviewData) {
          console.error('ERROR: Interview not found');
          console.error('Error details:', interviewError);
          try { twilioWs.close(); } catch {}
          return false;
        }

        interview = interviewData;
        console.log('✓ Interview loaded:', {
          id: interview.id,
          careGroupId: interview.care_group_id,
          status: interview.status,
          recipientName: interview.care_groups.recipient_first_name,
          selectedQuestionId: interview.selected_question_id || 'None - AI will choose randomly'
        });

        // Check if user selected a specific question
        if (interview.selected_question_id) {
          console.log('Fetching selected question:', interview.selected_question_id);
          const { data: selectedQ, error: questionError } = await supabase
            .from('interview_questions')
            .select('id, question_text, category, display_order')
            .eq('id', interview.selected_question_id)
            .eq('is_active', true)
            .single();

          if (questionError || !selectedQ) {
            console.error('ERROR: Failed to get selected question');
            console.error('Error details:', questionError);
            try { twilioWs.close(); } catch {}
            return false;
          }

          questions = [selectedQ];
          console.log('✓ Using selected question:', selectedQ.question_text);
        } else {
          // No specific question selected, fetch 5 random questions
          console.log('No specific question selected, fetching 5 random questions...');
          const { data: allQs, error: questionsError } = await supabase
            .from('interview_questions')
            .select('id, question_text, category, display_order')
            .eq('is_active', true);

          if (questionsError || !allQs || allQs.length === 0) {
            console.error('ERROR: Failed to get questions');
            console.error('Error details:', questionsError);
            try { twilioWs.close(); } catch {}
            return false;
          }

          // Shuffle and take 5
          const shuffled = [...allQs].sort(() => Math.random() - 0.5);
          questions = shuffled.slice(0, 5);
          console.log(`✓ Loaded ${questions.length} random questions for interview`);
        }

        // Build system instructions
        recipientInfo = interview.care_groups;
        recipientName = recipientInfo.recipient_first_name;
        const questionsList = questions.map((q: any, idx: number) => `${idx + 1}. ${q.question_text}`).join('\n');

        systemInstructions = `You are conducting a memory interview with ${recipientName}, born ${recipientInfo.date_of_birth}.

Background: ${recipientInfo.profile_description || 'No additional background provided.'}

Your goal is to ask the following questions and capture their memories in a warm, conversational way:

${questionsList}

Instructions:
- Start by introducing yourself warmly and explaining you'll be asking them about their life
- Ask ONE question at a time
- Listen actively and ask gentle follow-up questions to encourage them to share more details
- Be empathetic, patient, and encouraging
- If they seem confused, gently rephrase the question
- After asking all questions, thank them warmly and let them know their memories will be preserved
- Keep responses concise and conversational
- Use their first name occasionally to make it personal

Current question to ask: ${questions[0].question_text}`;

        return true;
      } catch (e) {
        console.error('initializeSession error:', e);
        try { twilioWs.close(); } catch {}
        return false;
      }
    };

    const startOpenAIConnection = async () => {
      try {
        console.log('Starting OpenAI connection...');
        console.log('Using API key:', OPENAI_API_KEY ? 'Present' : 'Missing');
        
        // Connect to OpenAI Realtime API with API key in URL
        const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`;
        console.log('Connecting to:', wsUrl);
        
        openaiWs = new WebSocket(wsUrl, ['realtime', `openai-insecure-api-key.${OPENAI_API_KEY}`, 'openai-beta.realtime-v1']);

        openaiWs.onopen = () => {
          console.log('✓ OpenAI WebSocket connected');
          // Wait for session.created before sending session.update
        };

        openaiWs.onmessage = async (event) => {
          const data = JSON.parse(event.data);

          if (data.type === 'response.audio.delta' && data.delta) {
            if (streamSid) {
              twilioWs.send(JSON.stringify({
                event: 'media',
                streamSid: streamSid,
                media: { payload: data.delta }
              }));
            } else {
              pendingAudioDeltas.push(data.delta);
            }
          } else if (data.type === 'input_audio_transcription.completed') {
            // Store user's response
            const userTranscript = data.transcript;
            transcriptBuffer.push(`User: ${userTranscript}`);
            console.log('[User transcript]:', userTranscript);
            console.log('User transcript length:', userTranscript?.length || 0, 'chars');
            if (!userTranscript || userTranscript.trim().length === 0) {
              console.warn('⚠️ Empty user transcript received');
            }
          } else if (data.type === 'response.audio_transcript.delta') {
            // Store AI's response
            transcriptBuffer.push(`AI: ${data.delta}`);
            console.log('[AI transcript delta]:', data.delta);
          } else if (data.type === 'session.created') {
            console.log('✓ OpenAI session.created - sending session.update');
            openaiWs!.send(JSON.stringify({
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                instructions: systemInstructions,
                voice: 'alloy',
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'g711_ulaw',
                input_audio_transcription: { model: 'whisper-1' },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 1000
                },
                temperature: 0.8,
                max_response_output_tokens: 'inf'
              }
            }));
          } else if (data.type === 'session.updated') {
            console.log('✓ OpenAI session.updated');
            openaiConfigured = true;
            // Flush any pending input audio from Twilio now that session is configured
            if (pendingMediaPayloads.length) {
              console.log('Flushing pending media frames to OpenAI:', pendingMediaPayloads.length);
              for (const payload of pendingMediaPayloads.splice(0)) {
                openaiWs!.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: payload }));
              }
            }
            // Start OpenAI keepalive - send 20ms of silence every 15 seconds to prevent timeout
            if (!openaiKeepaliveInterval) {
              // Create 20ms of μ-law silence (160 samples at 8kHz = 20ms)
              const silenceFrame = new Uint8Array(160).fill(0xFF); // μ-law silence value
              const silenceBase64 = btoa(String.fromCharCode(...silenceFrame));
              
              openaiKeepaliveInterval = setInterval(() => {
                if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                  openaiWs.send(JSON.stringify({
                    type: 'input_audio_buffer.append',
                    audio: silenceBase64
                  }));
                  console.log('Sent silence frame to OpenAI as keepalive');
                }
              }, 15000); // Every 15 seconds
            }
            // Start keepalive after session is ready
            if (!twilioKeepaliveInterval) {
              twilioKeepaliveInterval = setInterval(() => {
                if (twilioWs.readyState === WebSocket.OPEN && streamSid) {
                  twilioWs.send(JSON.stringify({
                    event: 'mark',
                    streamSid: streamSid,
                    mark: { name: 'keepalive' }
                  }));
                  console.log('Sent keepalive mark to Twilio');
                }
              }, 15000); // Every 15 seconds
            }
          } else if (data.type === 'input_audio_buffer.speech_started') {
            // NOTE: This interrupt logic is NOT USED in production!
            // In production, Twilio connects to the local server (via ngrok), not this edge function.
            // The interrupt handling is implemented in server/twilio-voice-server.js
            // This code is kept here for reference and potential future direct WebSocket usage.
            console.log('🎤 User started speaking - canceling AI response (EDGE FUNCTION - NOT USED IN PRODUCTION)');
            
            // Cancel the current AI response
            openaiWs!.send(JSON.stringify({
              type: 'response.cancel'
            }));
            
            // Clear Twilio's audio buffer to stop playing queued audio immediately
            if (streamSid) {
              twilioWs.send(JSON.stringify({
                event: 'clear',
                streamSid: streamSid
              }));
              console.log('✓ Cleared Twilio audio buffer');
            }
          } else if (data.type === 'error') {
            console.error('ERROR from OpenAI:', data.error);
          } else {
            // Other events: response.created, response.done, etc.
            if (data.type) console.log(`OpenAI event: ${data.type}`);
          }
        };

        openaiWs.onerror = (error) => {
          console.error('!!! OpenAI WebSocket error:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
        };

        openaiWs.onclose = async (event) => {
          console.log('=== OpenAI WebSocket CLOSED ===');
          console.log('Close code:', event.code, 'Reason:', event.reason);

          if (openaiKeepaliveInterval) {
            clearInterval(openaiKeepaliveInterval as number);
            openaiKeepaliveInterval = null;
          }
          if (twilioKeepaliveInterval) {
            clearInterval(twilioKeepaliveInterval as number);
            twilioKeepaliveInterval = null;
          }

          if (!callEnded) {
            console.log('Saving transcript and wrapping up...');

            const fullTranscript = transcriptBuffer.join('\n');
            console.log('Transcript length:', fullTranscript.length, 'characters');

            const { error: updateError } = await supabase
              .from('memory_interviews')
              .update({
                status: 'completed',
                actual_end_time: new Date().toISOString(),
                raw_transcript: fullTranscript
              })
              .eq('id', interviewId);

            if (updateError) {
              console.error('ERROR updating interview:', updateError);
            } else {
              console.log('✓ Interview marked as completed');
            }

            for (const question of questions) {
              await supabase.from('interview_question_usage').insert({
                question_id: question.id,
                interview_id: interviewId
              });
            }

            console.log('Triggering story generation...');
            await supabase.functions.invoke('generate-memory-story', {
              body: { interview_id: interviewId }
            });

            twilioWs.close();
          }
        };

      } catch (error) {
        console.error('Error setting up OpenAI connection:', error);
      }
    };

    // Manage proactive OpenAI session rotation

    
    twilioWs.onopen = () => {
      console.log('✓ Twilio WebSocket connected - waiting for start event with customParameters');
    };

    twilioWs.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      if (msg.event === 'start') {
        streamSid = msg.start?.streamSid || msg.streamSid || null;
        const customParameters = msg.start?.customParameters || {};
        
        console.log('=== TWILIO START EVENT ===');
        console.log('Full start payload:', JSON.stringify(msg, null, 2));
        console.log('streamSid:', streamSid);
        console.log('customParameters:', customParameters);
        console.log('protocol:', preferredProtocol);

        // Extract interview_id and call_sid from customParameters
        interviewId = customParameters.interview_id || null;
        callSid = customParameters.call_sid || null;

        console.log('Extracted from customParameters:', { interviewId, callSid });

        if (!interviewId) {
          console.error('ERROR: Missing interview_id in customParameters');
          twilioWs.close();
          return;
        }

        // Now initialize the session and start OpenAI
        console.log('Initializing interview session...');
        const ok = await initializeSession();
        if (!ok) {
          console.error('Initialization failed, closing connection');
          twilioWs.close();
          return;
        }

        sessionInitialized = true;
        console.log('Session initialized, starting OpenAI connection...');
        await startOpenAIConnection();

        // Start Twilio keepalive immediately
        if (!twilioKeepaliveInterval) {
          twilioKeepaliveInterval = setInterval(() => {
            if (twilioWs.readyState === WebSocket.OPEN && streamSid) {
              twilioWs.send(JSON.stringify({
                event: 'mark',
                streamSid: streamSid,
                mark: { name: 'keepalive' }
              }));
              console.log('Sent keepalive mark to Twilio');
            }
          }, 15000); // Every 15 seconds
        }

        // Flush any pending audio deltas
        if (streamSid && pendingAudioDeltas.length) {
          console.log('Flushing pending audio deltas to Twilio:', pendingAudioDeltas.length);
          for (const delta of pendingAudioDeltas.splice(0)) {
            twilioWs.send(JSON.stringify({ event: 'media', streamSid, media: { payload: delta } }));
          }
        }

      } else if (msg.event === 'media') {
        mediaCount++;
        if (mediaCount % 100 === 0) {
          console.log('Received media frames from Twilio:', mediaCount);
        }
        if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
          // Forward audio from Twilio (mulaw_8khz) to OpenAI
          openaiWs.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: msg.media.payload
          }));
        } else {
          // Buffer audio until OpenAI is ready
          pendingMediaPayloads.push(msg.media.payload);
        }
      } else if (msg.event === 'stop') {
        console.log('Call ended by Twilio. Total media frames received:', mediaCount);
        callEnded = true;
        try { openaiWs?.close(); } catch {}
        if (openaiKeepaliveInterval !== null) {
          clearInterval(openaiKeepaliveInterval as number);
          openaiKeepaliveInterval = null;
        }
        if (twilioKeepaliveInterval !== null) {
          clearInterval(twilioKeepaliveInterval as number);
          twilioKeepaliveInterval = null;
        }
      } else if (msg.event === 'mark') {
        // Acknowledge keepalive marks from Twilio
        console.log('Received mark event from Twilio:', msg.mark?.name);
      } else {
        console.log('Unhandled Twilio event:', msg.event);
      }
    };

    twilioWs.onerror = (error) => {
      console.error('Twilio WebSocket error:', error);
      if (openaiKeepaliveInterval !== null) {
        clearInterval(openaiKeepaliveInterval as number);
        openaiKeepaliveInterval = null;
      }
      if (twilioKeepaliveInterval !== null) {
        clearInterval(twilioKeepaliveInterval as number);
        twilioKeepaliveInterval = null;
      }
      openaiWs?.close();
    };

    twilioWs.onclose = () => {
      console.log('Twilio WebSocket closed');
      if (openaiKeepaliveInterval !== null) {
        clearInterval(openaiKeepaliveInterval as number);
        openaiKeepaliveInterval = null;
      }
      if (twilioKeepaliveInterval !== null) {
        clearInterval(twilioKeepaliveInterval as number);
        twilioKeepaliveInterval = null;
      }
      callEnded = true;
      openaiWs?.close();
    };

    // Wait for the WebSocket to fully close before resolving
    await new Promise((resolve) => {
      const checkClosed = () => {
        if (twilioWs.readyState === WebSocket.CLOSED) {
          resolve(null);
        } else {
          setTimeout(checkClosed, 100);
        }
      };
      checkClosed();
    });

    console.log('✓ WebSocket handler completed');
  })();

  EdgeRuntime.waitUntil(websocketHandler);

  return response;
});
