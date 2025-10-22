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

  // Connect to OpenAI Realtime API
  const connectToOpenAI = () => {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
    
    openAiWs = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    openAiWs.on('open', () => {
      console.log('✅ Connected to OpenAI Realtime API');
      
      // Configure the session
      openAiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          turn_detection: { type: 'server_vad' },
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          voice: 'alloy',
          instructions: 'You are conducting a memory interview. Ask thoughtful questions about the person\'s life experiences and memories. Be empathetic and engaging.',
          modalities: ['text', 'audio'],
          temperature: 0.8,
          input_audio_transcription: {
            model: 'whisper-1'
          }
        }
      }));

      // Send initial greeting
      openAiWs.send(JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          instructions: 'Greet the person warmly and begin the memory interview.'
        }
      }));
    });

    openAiWs.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        
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
