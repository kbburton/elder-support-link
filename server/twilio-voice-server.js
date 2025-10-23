/**
 * ARCHITECTURE: Memory Interview Voice Server (LOCAL)
 * 
 * This local server handles real-time WebSocket connections for memory interviews.
 * 
 * CRITICAL FLOW:
 * 1. Twilio calls the edge function (memory-interview-voice) to get TwiML instructions
 * 2. Edge function returns TwiML pointing to THIS server (via ngrok)
 * 3. Twilio connects to this server's WebSocket endpoint: /media-stream
 * 4. This server manages bidirectional audio: Twilio ↔ Local Server ↔ OpenAI
 * 
 * INTERRUPT HANDLING (CRITICAL):
 * - The interrupt logic (response.cancel, clear audio buffer) MUST be in this server
 * - This is where the OpenAI WebSocket connection lives
 * - Allows immediate response to speech_started events when user interrupts AI
 * - Easier to debug and iterate compared to edge function
 * 
 * WHY LOCAL SERVER:
 * - Maintains stateful WebSocket connections
 * - Handles real-time audio streaming
 * - Implements interrupt logic for natural conversations
 * - Direct console access for debugging
 * - Can restart/iterate quickly without redeployment
 * 
 * WARNING: DO NOT move interrupt logic to edge function!
 * In production, Twilio connects here, not to the edge function.
 * The edge function only generates TwiML instructions.
 */

import 'dotenv/config';
import express from 'express';
import expressWs from 'express-ws';
import { WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';

const app = express();
expressWs(app);

const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🚀 Server starting...');
console.log('📝 Environment check:');
console.log('   - OpenAI Key:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
console.log('   - Supabase URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('   - Supabase Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Twilio Voice Server Running' });
});

// WebSocket endpoint for Twilio Media Streams
app.ws('/media-stream', async (ws, req) => {
  console.log('📞 New Twilio connection established');
  
  let openAiWs = null;
  let streamSid = null;
  let callSid = null;
  let interviewId = null;
  let conversationHistory = [];
  let callStartTime = null;
  let greetingTimeout = null;
  let userHasSpoken = false;
  let hasActiveResponse = false; // Track if AI is currently generating a response

  // Connect to OpenAI Realtime API
  const connectToOpenAI = () => {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17';
    
    openAiWs = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    openAiWs.on('open', async () => {
      console.log('✅ Connected to OpenAI Realtime API');
      
      // Fetch interview details to get the selected question
      let instructions = 'You are conducting a memory interview. Ask thoughtful questions about the person\'s life experiences and memories. Be empathetic and engaging.';
      let careGroupId = null;
      let voiceConfig = null;
      
      if (interviewId) {
        try {
    const { data: interview, error } = await supabase
      .from('memory_interviews')
      .select(`
        *,
        care_groups (
          id,
          recipient_first_name,
          recipient_last_name,
          date_of_birth
        )
      `)
      .eq('id', interviewId)
      .single();
          
          if (error) {
            console.error('❌ Error fetching interview:', error);
          } else if (interview) {
            careGroupId = interview.care_groups.id;
            const recipientName = `${interview.care_groups.recipient_first_name} ${interview.care_groups.recipient_last_name}`;
            let questionText = interview.interview_questions?.question_text ?? null;
            
            // Fallback: fetch by selected_question_id if relation didn't join
            if (!questionText && interview.selected_question_id) {
              try {
                const { data: q, error: qErr } = await supabase
                  .from('interview_questions')
                  .select('question_text')
                  .eq('id', interview.selected_question_id)
                  .maybeSingle();
                if (qErr) {
                  console.error('❌ Error loading selected question:', qErr);
                } else if (q?.question_text) {
                  questionText = q.question_text;
                }
              } catch (qCatch) {
                console.error('❌ Exception loading selected question:', qCatch);
              }
            }
            
            console.log('📋 Interview details loaded:', {
              recipient: recipientName,
              question: questionText || 'None selected - AI will choose',
              selected_question_id: interview.selected_question_id || null,
              custom_instructions: interview.custom_instructions || 'None'
            });
            
            // Fetch voice config for this care group
            try {
              const { data: configData, error: configError } = await supabase
                .from('voice_interview_config')
                .select('*')
                .eq('care_group_id', careGroupId)
                .single();
              
              if (configError) {
                console.error('Error fetching voice config:', configError);
              } else {
                voiceConfig = configData;
              }
            } catch (err) {
              console.error('Failed to load voice config:', err);
            }

            // Use config values or defaults
            const aiName = voiceConfig?.ai_introduction_name || 'ChatGPT';
            const recipientFirstName = interview.care_groups.recipient_first_name;
            const instructionsTemplate = voiceConfig?.interview_instructions_template || `- Start by introducing yourself warmly and explaining you'll be asking them about their life
- Ask the question naturally, not reading it word-for-word
- Listen actively and ask gentle follow-up questions to encourage them to share more details
- Be empathetic, patient, and encouraging
- If they seem confused, gently rephrase the question
- Keep responses concise and conversational
- Use their first name (${recipientFirstName}) occasionally to make it personal
- When they've fully answered and you've explored the memory with follow-ups, thank them warmly`;
            
            // Base instructions depending on question presence
            if (questionText) {
              instructions = `You are ${aiName} conducting a memory interview with ${recipientName}, born ${interview.care_groups.date_of_birth}.

Your goal is to ask them about this specific memory and capture their story in a warm, conversational way:

"${questionText}"

Instructions:
${instructionsTemplate}`;
            } else {
              instructions = `You are ${aiName} conducting a memory interview with ${recipientName}, born ${interview.care_groups.date_of_birth}.

Your goal is to ask them about their life experiences and capture their memories in a warm, conversational way.

Instructions:
${instructionsTemplate}`;
            }

            // Append custom scheduler instructions if present
            if (interview.custom_instructions) {
              instructions += `

Additional guidance from the scheduler:
${interview.custom_instructions}`;
            }
          }
        } catch (err) {
          console.error('❌ Error loading interview details:', err);
        }
      }
      
      // Use config values or fallback to defaults (voiceConfig fetched earlier)
      const vadThreshold = voiceConfig?.vad_threshold ?? 0.5;
      const silenceDurationMs = voiceConfig?.vad_silence_duration_ms ?? 2500;
      const prefixPaddingMs = voiceConfig?.vad_prefix_padding_ms ?? 500;
      const temperature = voiceConfig?.temperature ?? 0.7;
      const responseStyleInstructions = voiceConfig?.response_style_instructions ?? '';
      const voiceId = voiceConfig?.voice || 'alloy';

      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║              VOICE CONFIGURATION SETTINGS                     ║');
      console.log('╠═══════════════════════════════════════════════════════════════╣');
      console.log('║ Care Group ID:', careGroupId || 'N/A');
      console.log('║ Config Found:', voiceConfig ? '✅ YES' : '❌ NO (using defaults)');
      console.log('║ AI Name:', voiceConfig?.ai_introduction_name || 'ChatGPT');
      console.log('║ Voice:', voiceId);
      console.log('║ VAD Threshold:', vadThreshold);
      console.log('║ Silence Duration:', silenceDurationMs, 'ms');
      console.log('║ Prefix Padding:', prefixPaddingMs, 'ms');
      console.log('║ Temperature:', temperature);
      console.log('║ Response Style:', responseStyleInstructions ? responseStyleInstructions : '(none - using default)');
      console.log('╚═══════════════════════════════════════════════════════════════╝');

      // Add response style to instructions
      const enhancedInstructions = responseStyleInstructions 
        ? `${instructions}\n\nResponse Style: ${responseStyleInstructions}`
        : instructions;

      // Configure the session with voice config values
      const sessionConfig = {
        type: 'session.update',
        session: {
          turn_detection: { 
            type: 'server_vad',
            threshold: vadThreshold,
            prefix_padding_ms: prefixPaddingMs,
            silence_duration_ms: silenceDurationMs
          },
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          voice: voiceId,
          instructions: enhancedInstructions,
          modalities: ['text', 'audio'],
          temperature: temperature,
          input_audio_transcription: {
            model: 'whisper-1'
          }
        }
      };

      console.log('');
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║         OPENAI SESSION CONFIGURATION (FULL PAYLOAD)           ║');
      console.log('╠═══════════════════════════════════════════════════════════════╣');
      console.log(JSON.stringify(sessionConfig, null, 2));
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      console.log('');

      openAiWs.send(JSON.stringify(sessionConfig));

      // Set up 5-second timeout for AI to greet if user doesn't speak
      console.log('⏳ Waiting 5 seconds for user to speak...');
      greetingTimeout = setTimeout(() => {
        if (!userHasSpoken && openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          console.log('🤖 User silent for 5 seconds, AI starting conversation...');
          console.log('📤 [Sending] response.create (greeting timeout) at', new Date().toISOString());
          openAiWs.send(JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['text', 'audio']
            }
          }));
        }
      }, 5000);
    });

    openAiWs.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        
        // ===== DIAGNOSTIC LOGGING: Session Lifecycle =====
        if (response.type === 'session.created') {
          console.log('📋 [OpenAI] session.created received at', new Date().toISOString());
        }
        
        if (response.type === 'session.updated') {
          console.log('✅ [OpenAI] session.updated confirmed at', new Date().toISOString());
        }
        
        // ===== DIAGNOSTIC LOGGING: Audio Buffer & VAD Events =====
        if (response.type === 'input_audio_buffer.speech_stopped') {
          console.log('🛑 [OpenAI] speech_stopped at', new Date().toISOString());
        }
        
        if (response.type === 'input_audio_buffer.committed') {
          console.log('💾 [OpenAI] input_audio_buffer.committed at', new Date().toISOString());
        }
        
        // ===== DIAGNOSTIC LOGGING: Transcription Events =====
        if (response.type === 'conversation.item.input_audio_transcription.delta') {
          console.log('📝 [OpenAI] transcription.delta:', response.delta);
        }
        
        // ===== DIAGNOSTIC LOGGING: Response Generation Events =====
        if (response.type === 'response.created') {
          console.log('🎬 [OpenAI] response.created - AI starting to generate at', new Date().toISOString());
          hasActiveResponse = true;
        }
        
        if (response.type === 'response.audio.done') {
          console.log('🎵 [OpenAI] response.audio.done at', new Date().toISOString());
          hasActiveResponse = false;
        }
        
        if (response.type === 'response.done') {
          hasActiveResponse = false;
        }
        
        // ===== DIAGNOSTIC LOGGING: Errors =====
        if (response.type === 'error') {
          console.error('❌ [OpenAI] Error event:', JSON.stringify(response, null, 2));
        }
        
        // CRITICAL: Handle user interruptions during AI speech
        // This enables natural barge-in functionality
        if (response.type === 'input_audio_buffer.speech_started') {
          console.log('🎤 User started speaking');
          
          // Mark that user has spoken (cancel greeting timeout)
          if (greetingTimeout) {
            clearTimeout(greetingTimeout);
            greetingTimeout = null;
            console.log('✓ User spoke first - cancelled AI greeting timeout');
          }
          userHasSpoken = true;
          
          // Cancel OpenAI response generation if actively generating
          if (hasActiveResponse) {
            console.log('📤 [Sending] response.cancel to OpenAI at', new Date().toISOString());
            openAiWs.send(JSON.stringify({
              type: 'response.cancel'
            }));
            hasActiveResponse = false;
          } else {
            console.log('ℹ️  No active OpenAI response to cancel (may still be Twilio buffer playing)');
          }
          
          // ALWAYS clear Twilio's audio buffer so any queued assistant audio stops immediately
          if (streamSid && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              event: 'clear',
              streamSid: streamSid
            }));
            console.log('✓ Cleared Twilio audio buffer - user can now speak');
          }
          
          // REMOVED: Don't return early - let audio continue to be processed
          // Server VAD will handle triggering response when speech stops
        }
        
        // Handle different response types
        if (response.type === 'response.audio.delta' && response.delta) {
          // Log first audio delta to confirm streaming started
          if (!response._audioStartLogged) {
            console.log('🎵 [OpenAI] First audio.delta received - streaming audio at', new Date().toISOString());
            response._audioStartLogged = true;
          }
          
          // Send audio back to Twilio
          if (ws.readyState === WebSocket.OPEN) {
            const audioData = {
              event: 'media',
              streamSid: streamSid,
              media: {
                payload: Buffer.from(response.delta, 'base64').toString('base64')
              }
            };
            ws.send(JSON.stringify(audioData));
          }
        }
        
        // Capture USER transcripts
        if (response.type === 'conversation.item.input_audio_transcription.completed') {
          const userTranscript = response.transcript;
          if (userTranscript) {
            console.log('👤 User:', userTranscript);
            conversationHistory.push({
              role: 'user',
              content: userTranscript,
              timestamp: new Date().toISOString()
            });
          }
        }
        
        // Log conversation items (fallback)
        if (response.type === 'conversation.item.created') {
          const item = response.item;
          if (item.type === 'message' && item.role === 'user') {
            console.log('👤 User:', item.content?.[0]?.transcript || '[audio]');
          }
        }
        
        // Capture ASSISTANT transcripts
        if (response.type === 'response.done') {
          const output = response.response?.output;
          if (output && output.length > 0) {
            const transcript = output[0]?.content?.[0]?.transcript;
            if (transcript) {
              console.log('🤖 Assistant:', transcript);
              conversationHistory.push({
                role: 'assistant',
                content: transcript,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        
      } catch (error) {
        console.error('❌ Error parsing OpenAI message:', error);
      }
    });

    openAiWs.on('error', (error) => {
      console.error('❌ OpenAI WebSocket error:', error);
    });

    openAiWs.on('close', (code, reason) => {
      console.log('🔌 OpenAI connection closed');
      console.log('   Close Code:', code);
      console.log('   Close Reason:', reason ? reason.toString() : '(none)');
      if (greetingTimeout) {
        clearTimeout(greetingTimeout);
      }
    });
  };

  // Handle Twilio messages
  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);
      
      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid;
          interviewId = msg.start.customParameters?.interview_id;
          callStartTime = Date.now();
          
          console.log('📞 Call started:', {
            streamSid,
            callSid,
            interviewId
          });
          
          // Connect to OpenAI
          connectToOpenAI();
          break;
          
        case 'media':
          // Forward audio to OpenAI
          if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            const audioAppend = {
              type: 'input_audio_buffer.append',
              audio: msg.media.payload
            };
            openAiWs.send(JSON.stringify(audioAppend));
          }
          break;
          
        case 'stop':
          console.log('📞 Call ended');
          
          // Calculate call duration
          const callDurationSeconds = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
          console.log(`⏱️  Call duration: ${callDurationSeconds} seconds`);
          
          // Save conversation to Supabase
          if (interviewId && conversationHistory.length > 0) {
            try {
              const { error } = await supabase
                .from('memory_interviews')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  raw_transcript: conversationHistory.map(msg => 
                    `${msg.role === 'assistant' ? '🤖 Assistant' : '👤 User'}: ${msg.content}`
                  ).join('\n')
                })
                .eq('id', interviewId);
              
              if (error) {
                console.error('❌ Error saving to Supabase:', error);
              } else {
                console.log('✅ Conversation saved to Supabase');
                console.log('📝 Saved transcript entries:', conversationHistory.length);
                
                // Only trigger story generation if call was at least 60 seconds
                if (callDurationSeconds >= 60) {
                  console.log('🎨 Triggering story generation...');
                  const { data: storyData, error: storyError } = await supabase.functions.invoke(
                    'generate-memory-story',
                    {
                      body: { interview_id: interviewId }
                    }
                  );
                  
                  if (storyError) {
                    console.error('❌ Error generating story:', storyError);
                  } else {
                    console.log('✅ Story generation started:', storyData);
                  }
                } else {
                  console.log('⏭️  Skipping story generation (call too short)');
                }
              }
            } catch (error) {
              console.error('❌ Error updating interview:', error);
            }
          } else {
            console.warn('⚠️ No conversation history to save');
          }
          
          // Close OpenAI connection
          if (openAiWs) {
            openAiWs.close();
          }
          break;
      }
    } catch (error) {
      console.error('❌ Error handling Twilio message:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 Twilio connection closed');
    if (greetingTimeout) {
      clearTimeout(greetingTimeout);
    }
    if (openAiWs) {
      openAiWs.close();
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

app.listen(PORT, () => {
  console.log(`\n✅ Server running on port ${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`🔗 When you start ngrok, use: wss://YOUR-NGROK-URL/media-stream`);
  console.log('\n💡 Ready to accept Twilio connections!\n');
});
