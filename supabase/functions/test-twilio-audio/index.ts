import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgradeHeader = req.headers.get("upgrade") || "";
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 400 });
  }

  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req);
  let streamSid: string | null = null;

  console.log('=== TEST: Twilio WebSocket connection opened ===');

  // Generate a simple 440Hz tone (A note) as μ-law
  // This creates a continuous tone to test if Twilio can play ANY audio
  const generateToneFrame = (): string => {
    // Simple sine wave for 440Hz at 8000Hz sample rate
    // 160 samples = 20ms at 8000Hz
    const samples = new Uint8Array(160);
    for (let i = 0; i < 160; i++) {
      const t = i / 8000;
      const value = Math.sin(2 * Math.PI * 440 * t);
      // Convert to 16-bit PCM
      const pcm16 = Math.floor(value * 32767);
      // Convert to μ-law (simplified - just map to middle range for testing)
      const ulaw = pcm16 >= 0 ? 0xFF : 0x7F;
      samples[i] = ulaw;
    }
    return btoa(String.fromCharCode(...samples));
  };

  twilioWs.onopen = () => {
    console.log('TEST: Twilio WS ready');
  };

  twilioWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      console.log('TEST: Received Twilio event:', msg.event);

      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        console.log('TEST: Stream started, streamSid:', streamSid);
        console.log('TEST: Stream details:', JSON.stringify(msg.start, null, 2));

        // Send a clear event
        twilioWs.send(JSON.stringify({
          event: 'clear',
          streamSid
        }));
        console.log('TEST: Sent clear event');

        // Start sending tone frames immediately
        let frameCount = 0;
        const sendInterval = setInterval(() => {
          if (frameCount >= 100) { // Send 100 frames = 2 seconds of audio
            clearInterval(sendInterval);
            console.log('TEST: Finished sending 100 tone frames');
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
            console.log(`TEST: Sent ${frameCount} tone frames`);
          }
        }, 20); // 20ms intervals for proper pacing

      } else if (msg.event === 'media') {
        // Log incoming audio
        console.log('TEST: Received media from caller');
      } else if (msg.event === 'mark') {
        console.log('TEST: Mark acknowledged:', msg.mark?.name);
      } else if (msg.event === 'stop') {
        console.log('TEST: Call stopped by Twilio');
      } else {
        console.log('TEST: Other event:', msg.event, JSON.stringify(msg));
      }
    } catch (error) {
      console.error('TEST: Error handling message:', error);
    }
  };

  twilioWs.onerror = (error) => {
    console.error('TEST: WebSocket error:', error);
  };

  twilioWs.onclose = () => {
    console.log('TEST: Twilio WebSocket closed');
  };

  return response;
});
