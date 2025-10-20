import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// μ-law encoding
const linear2ulaw = (sample: number): number => {
  const BIAS = 0x84;
  const CLIP = 32635;
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample = sample + BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }

  const mantissa = (sample >> (exponent + 3)) & 0x0F;
  let ulawByte = ~(sign | (exponent << 4) | mantissa) & 0xFF;
  return ulawByte;
};

const generateToneFrame = (): string => {
  const FRAME_SIZE = 160; // 20ms at 8000Hz
  const samples = new Int16Array(FRAME_SIZE);
  const freq = 440; // A note
  const amplitude = 8000;
  
  for (let i = 0; i < FRAME_SIZE; i++) {
    const t = i / 8000;
    const value = Math.sin(2 * Math.PI * freq * t);
    samples[i] = Math.floor(value * amplitude);
  }
  
  const ulaw = new Uint8Array(FRAME_SIZE);
  for (let i = 0; i < FRAME_SIZE; i++) {
    ulaw[i] = linear2ulaw(samples[i]);
  }
  
  return btoa(String.fromCharCode(...ulaw));
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // If not WebSocket, return TwiML
  const upgradeHeader = req.headers.get("upgrade") || "";
  if (upgradeHeader.toLowerCase() !== "websocket") {
    const url = new URL(req.url);
    const wsUrl = `wss://${url.host}/functions/v1/test-twilio-audio-connect`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="test" value="smoke" />
    </Stream>
  </Connect>
</Response>`;
    
    return new Response(twiml, {
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }

  // Handle WebSocket
  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req);
  let streamSid: string | null = null;
  let frameCount = 0;
  let sendInterval: number | null = null;

  console.log('=== SMOKE TEST: Twilio WebSocket connection opened ===');

  twilioWs.onopen = () => {
    console.log('SMOKE TEST: Twilio WS ready');
  };

  twilioWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      console.log('SMOKE TEST: Received Twilio event:', msg.event);

      if (msg.event === 'connected') {
        console.log('SMOKE TEST: Connected event received');
      } else if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        console.log('SMOKE TEST: Stream started, streamSid:', streamSid);
        console.log('SMOKE TEST: Track mode:', msg.start.tracks);

        // Clear buffer
        twilioWs.send(JSON.stringify({
          event: 'clear',
          streamSid
        }));
        console.log('SMOKE TEST: Sent clear event');

        // Start sending tone frames immediately
        sendInterval = setInterval(() => {
          if (frameCount >= 50) { // Send 50 frames = 1 second of audio
            if (sendInterval) {
              clearInterval(sendInterval);
              sendInterval = null;
            }
            console.log('SMOKE TEST: ✅ Finished sending 50 tone frames (1 second)');
            
            // Send a mark to verify Twilio processed everything
            twilioWs.send(JSON.stringify({
              event: 'mark',
              streamSid,
              mark: { name: 'tone_complete' }
            }));
            return;
          }

          const payload = {
            event: 'media',
            streamSid,
            media: {
              payload: generateToneFrame()
            }
          };

          twilioWs.send(JSON.stringify(payload));
          frameCount++;

          if (frameCount % 10 === 0) {
            console.log(`SMOKE TEST: Sent ${frameCount} tone frames`);
          }
        }, 20); // 20ms intervals for proper pacing

      } else if (msg.event === 'media') {
        console.log('SMOKE TEST: Received inbound media from caller');
      } else if (msg.event === 'mark') {
        console.log('SMOKE TEST: ✅ Mark acknowledged:', msg.mark?.name);
      } else if (msg.event === 'stop') {
        console.log('SMOKE TEST: Call stopped by Twilio');
        if (sendInterval) {
          clearInterval(sendInterval);
          sendInterval = null;
        }
      }
    } catch (error) {
      console.error('SMOKE TEST: Error handling message:', error);
    }
  };

  twilioWs.onerror = (error) => {
    console.error('SMOKE TEST: WebSocket error:', error);
    if (sendInterval) {
      clearInterval(sendInterval);
      sendInterval = null;
    }
  };

  twilioWs.onclose = () => {
    console.log('SMOKE TEST: Twilio WebSocket closed');
    if (sendInterval) {
      clearInterval(sendInterval);
      sendInterval = null;
    }
  };

  return response;
});
