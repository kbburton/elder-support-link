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

    console.log('=== INITIAL TWIML HTTP REQUEST ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    console.log('interview_id from query:', interviewIdFromQuery);
    console.log('callSid from query/body:', callSid);
    console.log('User-Agent:', req.headers.get('user-agent') || 'unknown');

    if (!interviewIdFromQuery) {
      console.error('ERROR: Missing interview_id on initial TwiML request - CANNOT PROCEED');
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Say voice="alice">An error occurred initializing your interview. Please try again later.</Say><Hangup/></Response>`,
        { status: 400, headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const wsUrlBase = `wss://yfwgegapmggwywrnzqvg.functions.supabase.co/functions/v1/memory-interview-voice?interview_id=${interviewIdFromQuery}${callSid ? `&amp;call_sid=${callSid}` : ''}`;
    const twiml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Say voice=\"alice\">Connecting to your interview assistant now.</Say>\n  <Start>\n    <Stream url=\"${wsUrlBase}\" track=\"both_tracks\" statusCallback=\"https://yfwgegapmggwywrnzqvg.functions.supabase.co/functions/v1/memory-interview-stream-status\" statusCallbackMethod=\"POST\">\n      <Parameter name=\"interview_id\" value=\"${interviewIdFromQuery}\"/>\n      ${callSid ? `<Parameter name=\"call_sid\" value=\"${callSid}\"/>` : ''}\n    </Stream>\n  </Start>\n  <Pause length=\"3600\"/>\n</Response>`;

    console.log('✓ Generated TwiML with WebSocket URL:', wsUrlBase);
    console.log('✓ Returning TwiML response with Content-Type: text/xml');
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  let interviewId: string | null = null;
  let callSid: string | null = null;

  console.log('=== WEBSOCKET UPGRADE REQUEST ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Request URL:', req.url);
  console.log('Request headers:', Object.fromEntries(req.headers.entries()));
  
  // Parse query params on WS URL as fallback
  try {
    const wsUrlInfo = new URL(req.url);
    const qpInterview = wsUrlInfo.searchParams.get('interview_id');
    const qpCallSid = wsUrlInfo.searchParams.get('call_sid');
    if (qpInterview) interviewId = qpInterview;
    if (qpCallSid) callSid = qpCallSid;
    console.log('WS URL params:', { interviewIdFromQuery: qpInterview, callSidFromQuery: qpCallSid });
  } catch (e) {
    console.warn('Failed parsing WS URL params', e instanceof Error ? e.message : e);
  }
  
  let interview: any = null;
  let questions: any[] = [];
  let systemInstructions = '';
  let recipientInfo: any = null;
  let recipientName = '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Negotiate Twilio subprotocol if provided (required for Twilio Media Streams)
  const requestedProtocols = req.headers.get('sec-websocket-protocol')?.split(',').map(p => p.trim()) || [];
  console.log('Requested WebSocket subprotocols from Twilio:', requestedProtocols.length ? requestedProtocols : 'NONE');
  
  // Accept whatever protocol Twilio sends, or none if not specified
  const preferredProtocol = requestedProtocols.length > 0 ? requestedProtocols[0] : undefined;
  if (preferredProtocol) {
    console.log('Accepting WebSocket subprotocol:', preferredProtocol);
  } else {
    console.log('No subprotocol negotiation (accepting default)');
  }
 
  const upgradeOpts = preferredProtocol ? { protocol: preferredProtocol } as any : undefined as any;
  console.log('Attempting WebSocket upgrade with options:', upgradeOpts || 'none');
  
  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req, upgradeOpts);
  console.log('✓ WebSocket upgrade successful');
  let openaiWs: WebSocket | null = null;
  let transcriptBuffer: string[] = [];
  let currentQuestionIndex = 0;
  let streamSid: string | null = null;
  const pendingAudioDeltas: string[] = [];
  const pendingMediaPayloads: string[] = [];
  let mediaCount = 0;
  let audioSendCount = 0;
  let sessionInitialized = false;
  let callEnded = false;
  let openaiConfigured = false;
  let introDelivered = false;
  let reconnecting = false;

  // Outbound audio pacing and framing for Twilio (G.711 u-law @ 8kHz)
  let outboundFramesQueue: string[] = [];
  let outboundSenderTimer: number | null = null;
  let ulawRemainder: Uint8Array = new Uint8Array(0);
  let outboundFramesSent = 0;

  const base64ToBytes = (b64: string): Uint8Array => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };
  const bytesToBase64 = (bytes: Uint8Array): string => {
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      bin += String.fromCharCode.apply(null, Array.from(slice));
    }
    return btoa(bin);
  };

  // Helper: PCM16 -> μ-law conversion and tone generation
  const linear2ulaw = (sample: number): number => {
    const BIAS = 0x84;
    const CLIP = 32635;
    let sign = (sample >> 8) & 0x80;
    if (sign !== 0) sample = -sample;
    if (sample > CLIP) sample = CLIP;
    sample = sample + BIAS;

    // Determine segment
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
      exponent--;
    }

    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    let ulawByte = ~(sign | (exponent << 4) | mantissa) & 0xFF;
    return ulawByte;
  };

  const pcm16ToUlaw = (pcm: Int16Array): Uint8Array => {
    const out = new Uint8Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      out[i] = linear2ulaw(pcm[i]);
    }
    return out;
  };

  const generateUlawBeepBase64 = (durationMs = 300, freq = 440, sampleRate = 8000): string => {
    const length = Math.max(1, Math.floor((durationMs / 1000) * sampleRate));
    const pcm = new Int16Array(length);
    const amplitude = 10000; // conservative to avoid clipping
    for (let i = 0; i < length; i++) {
      pcm[i] = Math.floor(amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate));
    }
    const ulaw = pcm16ToUlaw(pcm);
    return bytesToBase64(ulaw);
  };

  // Enqueue raw g711_ulaw bytes, split into 20ms frames (160 bytes)
  const enqueueUlawFrames = (payloadB64: string) => {
    try {
      const incoming = base64ToBytes(payloadB64);
      const combined = new Uint8Array(ulawRemainder.length + incoming.length);
      combined.set(ulawRemainder, 0);
      combined.set(incoming, ulawRemainder.length);

      const FRAME_SIZE = 160; // 20ms at 8kHz
      let offset = 0;
      while (offset + FRAME_SIZE <= combined.length) {
        const frame = combined.subarray(offset, offset + FRAME_SIZE);
        outboundFramesQueue.push(bytesToBase64(frame));
        offset += FRAME_SIZE;
      }
      ulawRemainder = combined.subarray(offset);
    } catch (e) {
      console.error('enqueueUlawFrames error:', e);
    }
  };

  const startOutboundSender = () => {
    if (outboundSenderTimer !== null) return;
    outboundSenderTimer = setInterval(() => {
      try {
        if (!streamSid || twilioWs.readyState !== WebSocket.OPEN) return;
        const next = outboundFramesQueue.shift();
        if (!next) return;
        twilioWs.send(JSON.stringify({ event: 'media', streamSid, track: 'outbound', media: { payload: next } }));
        outboundFramesSent++;
        if (outboundFramesSent % 50 === 0) {
          console.log(`[Outbound] Sent ${outboundFramesSent} frames, queue=${outboundFramesQueue.length}`);
          try { twilioWs.send(JSON.stringify({ event: 'mark', streamSid, mark: { name: `out-${outboundFramesSent}` } })); } catch {}
        }
      } catch (e) {
        console.error('Outbound sender error:', e);
      }
    }, 20) as unknown as number;
  };

  const stopOutboundSender = () => {
    if (outboundSenderTimer !== null) {
      clearInterval(outboundSenderTimer);
      outboundSenderTimer = null;
    }
  };

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
        recipientName: interview.care_groups.recipient_first_name
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
      
      // Connect to OpenAI Realtime API with header-based auth (more reliable)
      const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`;
      console.log('Connecting to:', wsUrl);
      
      openaiWs = new WebSocket(
        wsUrl,
        ['realtime', `openai-insecure-api-key.${OPENAI_API_KEY}`, 'openai-beta.realtime-v1']
      );

      openaiWs.onopen = () => {
        console.log('✓ OpenAI WebSocket connected - waiting for session.created');
      };

      openaiWs.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log(`[OpenAI Event] type=${data.type}`);

        if (data.type === 'response.audio.delta' && data.delta) {
          audioSendCount++;
            enqueueUlawFrames(data.delta);

        } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
          // Store user's response
          const userTranscript = data.transcript;
          transcriptBuffer.push(`User: ${userTranscript}`);
          console.log('[User transcript]:', userTranscript);
        } else if (data.type === 'response.audio_transcript.delta') {
          // Store AI's response
          transcriptBuffer.push(`AI: ${data.delta}`);
          console.log('[AI transcript delta]:', data.delta);
        } else if (data.type === 'session.created') {
          console.log('✓ OpenAI session.created - sending session.update with g711_ulaw');
          openaiWs!.send(JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: systemInstructions,
              voice: 'alloy',
              input_audio_format: 'g711_ulaw',
              output_audio_format: 'g711_ulaw',
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 1000
              },
              temperature: 0.8
            }
          }));
        } else if (data.type === 'session.updated') {
          console.log('✓ OpenAI session.updated - flushing pending media and triggering greeting');
          openaiConfigured = true;
          // Flush any pending input audio from Twilio now that session is configured
          if (pendingMediaPayloads.length) {
            console.log('Flushing pending media frames to OpenAI:', pendingMediaPayloads.length);
            for (const payload of pendingMediaPayloads.splice(0)) {
              openaiWs!.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: payload }));
            }
          }

          // Immediately trigger audible greeting
          if (!introDelivered) {
            try {
              // Ensure Twilio outbound buffer is clear before we start sending audio
              if (streamSid) {
                try { twilioWs.send(JSON.stringify({ event: 'clear', streamSid })); } catch {}
              }
              // Queue a short connection tone so the caller hears readiness
              try {
                const beepB64 = generateUlawBeepBase64(300, 440);
                enqueueUlawFrames(beepB64);
                console.log('✓ Queued connection tone (μ-law)', beepB64.length, 'chars');
              } catch (e) {
                console.warn('Failed to queue connection tone:', e);
              }
              const introText = `Hello ${recipientName}. I will ask you a few questions to record your memories. Let's begin. ${questions[0]?.question_text ?? 'Can you tell me about your earliest memories?'}`;
              console.log('→ Sending initial greeting to OpenAI:', introText.substring(0, 80) + '...');
              openaiWs!.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'user',
                  content: [
                    { type: 'input_text', text: introText }
                  ]
                }
              }));
              openaiWs!.send(JSON.stringify({ type: 'response.create', response: { modalities: ['audio', 'text'] } }));
              introDelivered = true;
              console.log('✓ Initial greeting sent - expecting response.created and audio.delta events');
              
              // Fallback: if no response.created after 1s, try again
              setTimeout(() => {
                if (openaiWs && openaiWs.readyState === WebSocket.OPEN && audioSendCount === 0) {
                  console.log('[Fallback] Re-sending response.create after 1s (no audio.delta yet)');
                  try {
                    openaiWs!.send(JSON.stringify({ type: 'response.create', response: { modalities: ['audio', 'text'] } }));
                  } catch (e) {
                    console.error('Fallback response.create failed:', e);
                  }
                }
              }, 1000);
            } catch (e) {
              console.error('Failed to send initial greeting:', e);
            }
          }
        } else if (data.type === 'error') {
          console.error('ERROR from OpenAI:', data.error);
        } else if (data.type === 'response.output_text.delta') {
          transcriptBuffer.push(`AI: ${data.delta}`);
          console.log('[AI output_text delta]:', data.delta);
        } else if (data.type === 'response.output_text.done') {
          console.log('[AI output_text done]');
        } else if (data.type === 'response.created') {
          console.log(`✓ [OpenAI] response.created - response_id=${data.response?.id} - expecting audio.delta next`);
        } else if (data.type === 'response.done') {
          console.log(`[OpenAI] response.done - status=${data.response?.status}, output_count=${data.response?.output?.length || 0}`);
          if (data.response?.output) {
            console.log('[OpenAI] response.output:', JSON.stringify(data.response.output));
          }
          if (data.response?.error) {
            console.error('[OpenAI] response.error:', JSON.stringify(data.response.error));
          }
          if (data.response?.status === 'failed') {
            try { console.error('[OpenAI] response.failed full payload:', JSON.stringify(data)); } catch {}
          }
        } else if (data.type?.startsWith('response.')) {
          console.log(`[OpenAI] ${data.type}:`, JSON.stringify(data).substring(0, 200));
        } else {
          // Other events
          if (data.type) console.log(`OpenAI event: ${data.type}`);
        }
      };

      openaiWs.onerror = (error) => {
        console.error('!!! OpenAI WebSocket error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
      };

      openaiWs.onclose = async (event) => {
        console.log('=== OpenAI WebSocket CLOSED ===');
        console.log('Close code:', event.code);
        console.log('Close reason:', event.reason);
        console.log('Was clean close:', event.wasClean);

        // Attempt to recover unless the call has actually ended
        if (!callEnded && !reconnecting) {
          console.log('OpenAI closed unexpectedly; attempting reconnect in 250ms...');
          openaiWs = null;
          reconnecting = true;
          try {
            setTimeout(() => {
              reconnecting = false;
              startOpenAIConnection();
            }, 250);
          } catch (e) {
            console.error('Error attempting OpenAI reconnect:', e);
            reconnecting = false;
          }
          return; // Do not wrap up or close Twilio here
        }
        
        console.log('Saving transcript and wrapping up...');
        
        // Save transcript and update interview
        const fullTranscript = transcriptBuffer.join('\n');
        console.log('Transcript length:', fullTranscript.length, 'characters');
        
        const { error: updateError } = await supabase
          .from('memory_interviews')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            raw_transcript: fullTranscript
          })
          .eq('id', interviewId);

        if (updateError) {
          console.error('ERROR updating interview status:', updateError);
        } else {
          console.log('✓ Interview marked as completed');
        }

        // Record question usage
        console.log('Recording question usage...');
        for (const question of questions) {
          await supabase
            .from('interview_question_usage')
            .insert({
              question_id: question.id,
              interview_id: interviewId,
              care_group_id: interview.care_group_id
            });
        }
        console.log(`✓ Recorded ${questions.length} questions used`);

        // Trigger story generation only if we captured any transcript text
        if (fullTranscript.trim().length > 0) {
          console.log('Triggering story generation...');
          const { error: storyError } = await supabase.functions.invoke('generate-memory-story', {
            body: { interview_id: interviewId }
          });

          if (storyError) {
            console.error('ERROR triggering story generation:', storyError);
          } else {
            console.log('✓ Story generation triggered');
          }
        } else {
          console.warn('Transcript empty; skipping story generation to avoid 500 error');
        }

        twilioWs.close();
      };

    } catch (error) {
      console.error('Error setting up OpenAI connection:', error);
    }
  };

  // Removed proactive session rotation - reconnect only on actual failures
  
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
      console.log('tracks:', msg.start?.tracks, 'mediaFormat:', msg.start?.mediaFormat);

      // Extract interview_id and call_sid from customParameters (fallback to WS query params if missing)
      if (customParameters.interview_id) interviewId = customParameters.interview_id;
      if (customParameters.call_sid) callSid = customParameters.call_sid;

      console.log('Extracted after fallback:', { interviewId, callSid });

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

      // Flush any pending audio deltas
      if (streamSid && pendingAudioDeltas.length) {
        console.log('Flushing pending audio deltas to queue:', pendingAudioDeltas.length);
        for (const delta of pendingAudioDeltas.splice(0)) {
          enqueueUlawFrames(delta);
        }
      }

      // Start paced outbound sender
      startOutboundSender();

      // Immediately play a short ready tone so the caller knows we're connected
      try {
        const beepB64 = generateUlawBeepBase64(250, 440);
        enqueueUlawFrames(beepB64);
        console.log('✓ Beep enqueued right after Twilio start');
      } catch (e) {
        console.warn('Failed to enqueue initial beep:', e);
      }

      // Safety fallback: if session.updated hasn't triggered intro after 1.5s, force it
      setTimeout(() => {
        if (!introDelivered && openaiWs && openaiWs.readyState === WebSocket.OPEN && openaiConfigured) {
          try {
            const introText = `Hello ${recipientName}. I will ask you a few questions to record your memories. Let's begin. ${questions[0]?.question_text ?? 'Can you tell me about your earliest memories?'}`;
            console.log('[Safety fallback] Sending intro 1.5s after start');
            openaiWs!.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: [ { type: 'input_text', text: introText } ]
              }
            }));
            openaiWs!.send(JSON.stringify({ type: 'response.create', response: { modalities: ['audio', 'text'] } }));
            introDelivered = true;
            console.log('✓ Safety intro sent after 1.5s');
          } catch (e) {
            console.error('Failed to send safety intro:', e);
          }
        }
      }, 1500);

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
      console.log('Call ended by Twilio. Total media frames received:', mediaCount, 'Total audio sent:', audioSendCount);
      callEnded = true;
      stopOutboundSender();
      try { openaiWs?.close(); } catch {}
    } else if (msg.event === 'mark') {
      console.log('Twilio mark ack:', msg.mark?.name || JSON.stringify(msg.mark));
    } else if (msg.event === 'error') {
      console.error('Twilio stream error:', msg.streamSid, msg.error || msg);
    } else {
      console.log('Unhandled Twilio event:', msg.event);
    }
  };

  twilioWs.onerror = (error) => {
    console.error('Twilio WebSocket error:', error);
    openaiWs?.close();
  };

  twilioWs.onclose = () => {
    console.log('Twilio WebSocket closed');
    callEnded = true;
    stopOutboundSender();
    openaiWs?.close();
  };

  return response;
});
