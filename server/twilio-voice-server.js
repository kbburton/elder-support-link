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

  // Connect to OpenAI Realtime API
  const connectToOpenAI = () => {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
    
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
      
      if (interviewId) {
        try {
    const { data: interview, error } = await supabase
      .from('memory_interviews')
      .select(`
        *,
        care_groups (
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
            
            // Base instructions depending on question presence
            if (questionText) {
              instructions = `You are conducting a memory interview with ${recipientName}, born ${interview.care_groups.date_of_birth}.

Your goal is to ask them about this specific memory and capture their story in a warm, conversational way:

"${questionText}"

Instructions:
- Start by introducing yourself warmly and explaining you'll be asking them about their life
- Ask the question naturally, not reading it word-for-word
- Listen actively and ask gentle follow-up questions to encourage them to share more details
- Be empathetic, patient, and encouraging
- If they seem confused, gently rephrase the question
- Keep responses concise and conversational
- Use their first name (${interview.care_groups.recipient_first_name}) occasionally to make it personal
- When they've fully answered and you've explored the memory with follow-ups, thank them warmly`;
            } else {
              instructions = `You are conducting a memory interview with ${recipientName}, born ${interview.care_groups.date_of_birth}.

Your goal is to ask them about their life experiences and capture their memories in a warm, conversational way.

Instructions:
- Start by introducing yourself warmly
- Ask thoughtful questions about their childhood, family, life milestones, or meaningful experiences
- Listen actively and ask gentle follow-up questions
- Be empathetic, patient, and encouraging
- Keep responses concise and conversational
- Use their first name (${interview.care_groups.recipient_first_name}) occasionally`;
            }

            // Append any custom scheduler instructions
            if (interview.custom_instructions) {
              instructions += `

Additional guidance from the scheduler (use respectfully and briefly):
${interview.custom_instructions}`;
            }
          }
        } catch (err) {
          console.error('❌ Error loading interview details:', err);
        }
      }
      
      // Configure the session with the instructions
      openAiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          turn_detection: { type: 'server_vad' },
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          voice: 'alloy',
          instructions: instructions,
          modalities: ['text', 'audio'],
          temperature: 0.8,
          input_audio_transcription: {
            model: 'whisper-1'
          }
        }
      }));

      // Set up 5-second timeout for AI to greet if user doesn't speak
      console.log('⏳ Waiting 5 seconds for user to speak...');
      greetingTimeout = setTimeout(() => {
        if (!userHasSpoken && openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          console.log('🤖 User silent for 5 seconds, AI starting conversation...');
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
        
        // CRITICAL: Handle user interruptions during AI speech
        // This enables natural barge-in functionality
        if (response.type === 'input_audio_buffer.speech_started') {
          console.log('🎤 User started speaking - canceling AI response');
          
          // Mark that user has spoken (cancel greeting timeout)
          if (greetingTimeout) {
            clearTimeout(greetingTimeout);
            greetingTimeout = null;
            console.log('✓ User spoke first - cancelled AI greeting timeout');
          }
          userHasSpoken = true;
          
          // Cancel the current AI response immediately
          openAiWs.send(JSON.stringify({
            type: 'response.cancel'
          }));
          
          // Clear Twilio's audio buffer to stop playing queued audio immediately
          if (streamSid && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              event: 'clear',
              streamSid: streamSid
            }));
            console.log('✓ Cleared Twilio audio buffer - user can now speak');
          }
          
          return; // Don't process other logic for this event
        }
        
        // Handle different response types
        if (response.type === 'response.audio.delta' && response.delta) {
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

    openAiWs.on('close', () => {
      console.log('🔌 OpenAI connection closed');
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
