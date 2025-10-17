import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected websocket", { status: 400 });
  }

  const url = new URL(req.url);
  const interviewId = url.searchParams.get('interview_id');
  const callSid = url.searchParams.get('call_sid');

  if (!interviewId) {
    return new Response("Missing interview_id", { status: 400 });
  }

  console.log('Starting memory interview voice session:', { interviewId, callSid });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get interview details
  const { data: interview, error: interviewError } = await supabase
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

  if (interviewError || !interview) {
    console.error('Interview not found:', interviewError);
    return new Response("Interview not found", { status: 404 });
  }

  // Get 5 random questions for this interview
  const { data: questions, error: questionsError } = await supabase
    .rpc('get_random_interview_questions', { 
      question_count: 5,
      p_interview_id: interviewId 
    });

  if (questionsError || !questions || questions.length === 0) {
    console.error('Failed to get questions:', questionsError);
    return new Response("Failed to get questions", { status: 500 });
  }

  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req);
  let openaiWs: WebSocket | null = null;
  let transcriptBuffer: string[] = [];
  let currentQuestionIndex = 0;

  // Build system instructions
  const recipientInfo = interview.care_groups;
  const recipientName = recipientInfo.recipient_first_name;
  const questionsList = questions.map((q: any, idx: number) => 
    `${idx + 1}. ${q.question_text}`
  ).join('\n');

  const systemInstructions = `You are conducting a memory interview with ${recipientName}, born ${recipientInfo.date_of_birth}.

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

  twilioWs.onopen = async () => {
    console.log('Twilio WebSocket connected');
    
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
        console.log('OpenAI WebSocket connected');
        
        // Configure session
        openaiWs!.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: systemInstructions,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
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
      };

      openaiWs.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'response.audio.delta' && data.delta) {
          // Forward audio to Twilio
          twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid: callSid,
            media: {
              payload: data.delta
            }
          }));
        } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
          // Store user's response
          const userTranscript = data.transcript;
          transcriptBuffer.push(`User: ${userTranscript}`);
          console.log('User said:', userTranscript);
        } else if (data.type === 'response.audio_transcript.delta') {
          // Store AI's response
          transcriptBuffer.push(`AI: ${data.delta}`);
        } else if (data.type === 'error') {
          console.error('OpenAI error:', data.error);
        }
      };

      openaiWs.onerror = (error) => {
        console.error('OpenAI WebSocket error:', error);
      };

      openaiWs.onclose = async () => {
        console.log('OpenAI WebSocket closed, saving transcript');
        
        // Save transcript and update interview
        const fullTranscript = transcriptBuffer.join('\n');
        
        await supabase
          .from('memory_interviews')
          .update({
            status: 'completed',
            actual_end_time: new Date().toISOString(),
            raw_transcript: fullTranscript
          })
          .eq('id', interviewId);

        // Record question usage
        for (const question of questions) {
          await supabase
            .from('interview_question_usage')
            .insert({
              question_id: question.id,
              interview_id: interviewId
            });
        }

        // Trigger story generation
        await supabase.functions.invoke('generate-memory-story', {
          body: { interview_id: interviewId }
        });

        twilioWs.close();
      };

    } catch (error) {
      console.error('Error setting up OpenAI connection:', error);
    }
  };

  twilioWs.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    
    if (msg.event === 'media' && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
      // Forward audio from Twilio to OpenAI
      openaiWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: msg.media.payload
      }));
    } else if (msg.event === 'stop') {
      console.log('Call ended by Twilio');
      openaiWs?.close();
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
