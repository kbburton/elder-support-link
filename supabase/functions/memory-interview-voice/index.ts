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

    const wsUrl = `wss://yfwgegapmggwywrnzqvg.functions.supabase.co/functions/v1/memory-interview-voice?interview_id=${interviewIdFromQuery}${callSid ? `&call_sid=${callSid}` : ''}`;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="alice">Please hold while I connect your memory interview.</Say>\n  <Connect>\n    <Stream url="${wsUrl}" statusCallback="https://yfwgegapmggwywrnzqvg.functions.supabase.co/functions/v1/memory-interview-stream-status" statusCallbackMethod="POST" statusCallbackEvent="start stop"/>\n  </Connect>\n</Response>`;

    console.log('Responding with TwiML to connect stream:', wsUrl);
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  }

  const interviewId = interviewIdFromQuery;
  const callSid = url.searchParams.get('call_sid');

  console.log('=== VOICE SESSION STARTING ===');
  console.log('Interview ID:', interviewId);
  console.log('Call SID:', callSid);
  console.log('Timestamp:', new Date().toISOString());

  if (!interviewId) {
    console.error('ERROR: Missing interview_id parameter');
    return new Response("Missing interview_id", { status: 400 });
  }

  let interview: any = null;
  let questions: any[] = [];
  let systemInstructions = '';
  let recipientInfo: any = null;
  let recipientName = '';

  const initializeSession = async () => {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

      // Get 5 random questions for this interview
      console.log('Fetching random questions...');
      const { data: q, error: questionsError } = await supabase
        .rpc('get_random_interview_questions', { 
          question_count: 5,
          p_interview_id: interviewId 
        });

      if (questionsError || !q || q.length === 0) {
        console.error('ERROR: Failed to get questions');
        console.error('Error details:', questionsError);
        try { twilioWs.close(); } catch {}
        return false;
      }

      questions = q;
      console.log(`✓ Loaded ${questions.length} questions for interview`);

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

  // Negotiate Twilio subprotocol if provided (required for Twilio Media Streams)
  const requestedProtocols = req.headers.get('sec-websocket-protocol')?.split(',').map(p => p.trim()) || [];
  const preferredProtocol = requestedProtocols.find(p => p.toLowerCase().includes('audio')) || requestedProtocols[0];
  if (requestedProtocols.length) console.log('Requested WebSocket subprotocols from Twilio:', requestedProtocols);
  if (preferredProtocol) console.log('Negotiating WebSocket subprotocol:', preferredProtocol);
 
  const upgradeOpts = preferredProtocol ? { protocol: preferredProtocol } as any : undefined as any;
  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req, upgradeOpts);
  let openaiWs: WebSocket | null = null;
  let transcriptBuffer: string[] = [];
  let currentQuestionIndex = 0;
  let streamSid: string | null = null;
  const pendingAudioDeltas: string[] = [];
  const pendingMediaPayloads: string[] = [];
  let mediaCount = 0;

  // Build system instructions
  // systemInstructions will be set during initializeSession()

  twilioWs.onopen = async () => {
    console.log('✓ Twilio WebSocket connected - starting OpenAI connection');
    
    // Initialize interview context before connecting to OpenAI
    const ok = await initializeSession();
    if (!ok) {
      console.error('Initialization failed, closing Twilio socket.');
      try { twilioWs.close(); } catch {}
      return;
    }
    
    try {
      // Connect to OpenAI Realtime API
      openaiWs = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        }
      );

      openaiWs.onopen = () => {
        console.log('✓ OpenAI WebSocket connected - configuring session');
        
        // Configure session
        openaiWs!.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: systemInstructions,
            voice: 'alloy',
            input_audio_format: 'mulaw_8khz',
            output_audio_format: 'mulaw_8khz',
            input_audio_transcription: {
              model: 'whisper-1'
            },
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

        // Flush any pending input audio from Twilio
        if (pendingMediaPayloads.length) {
          console.log('Flushing pending media frames to OpenAI:', pendingMediaPayloads.length);
          for (const payload of pendingMediaPayloads.splice(0)) {
            openaiWs!.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: payload }));
          }
        }
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
        } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
          // Store user's response
          const userTranscript = data.transcript;
          transcriptBuffer.push(`User: ${userTranscript}`);
          console.log('[User transcript]:', userTranscript);
        } else if (data.type === 'response.audio_transcript.delta') {
          // Store AI's response
          transcriptBuffer.push(`AI: ${data.delta}`);
          console.log('[AI transcript delta]:', data.delta);
        } else if (data.type === 'error') {
          console.error('ERROR from OpenAI:', data.error);
        } else if (data.type === 'session.created' || data.type === 'session.updated') {
          console.log(`✓ OpenAI ${data.type}`);
        }
      };

      openaiWs.onerror = (error) => {
        console.error('OpenAI WebSocket error:', error);
      };

      openaiWs.onclose = async () => {
        console.log('=== INTERVIEW ENDING ===');
        console.log('Saving transcript and wrapping up...');
        
        // Save transcript and update interview
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
              interview_id: interviewId
            });
        }
        console.log(`✓ Recorded ${questions.length} questions used`);

        // Trigger story generation
        console.log('Triggering story generation...');
        const { error: storyError } = await supabase.functions.invoke('generate-memory-story', {
          body: { interview_id: interviewId }
        });

        if (storyError) {
          console.error('ERROR triggering story generation:', storyError);
        } else {
          console.log('✓ Story generation triggered');
        }

        twilioWs.close();
      };

    } catch (error) {
      console.error('Error setting up OpenAI connection:', error);
    }
  };

  twilioWs.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.event === 'start') {
      streamSid = msg.start?.streamSid || msg.streamSid || null;
      console.log('Twilio stream started. streamSid:', streamSid, 'protocol:', selectedProtocol);
      // Flush any pending audio deltas
      if (streamSid && pendingAudioDeltas.length) {
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
        pendingMediaPayloads.push(msg.media.payload);
      }
    } else if (msg.event === 'stop') {
      console.log('Call ended by Twilio. Total media frames received:', mediaCount);
      openaiWs?.close();
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
    openaiWs?.close();
  };

  return response;
});
