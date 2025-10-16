import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ success: false, error: "Expected multipart/form-data with a 'file' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing file field 'file'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isText = (file.type || "").startsWith("text/");
    let extractedText = "";

    if (isText) {
      extractedText = await file.text();
    } else {
      // Use inline_data with base64 to avoid Google File API upload
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const toBase64 = (u8: Uint8Array) => {
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < u8.length; i += chunk) {
          binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)) as any);
        }
        return btoa(binary);
      };
      const base64Data = toBase64(uint8Array);

      // Extract with Gemini 2.5 Flash using inline_data; fallback to 2.0 Flash
      let extractResp = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: 'Extract all text content from this document. Preserve formatting, structure, and important details. Return only the extracted text without any commentary.' },
                  { inline_data: { mime_type: file.type || 'application/octet-stream', data: base64Data } },
                ],
              },
            ],
          }),
        }
      );

      if (!extractResp.ok && extractResp.status === 404) {
        console.warn('Gemini 2.5 Flash not available, trying 2.0 Flash');
        extractResp = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-001:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: 'Extract all text content from this document. Preserve formatting, structure, and important details. Return only the extracted text without any commentary.' },
                    { inline_data: { mime_type: file.type || 'application/octet-stream', data: base64Data } },
                  ],
                },
              ],
            }),
          }
        );
      }

      if (!extractResp.ok) {
        const t = await extractResp.text();
        console.error('Gemini extract failed:', extractResp.status, t);
        throw new Error(`Gemini extract failed: ${extractResp.status}`);
      }
      const extractJson = await extractResp.json();
      const parts = extractJson.candidates?.[0]?.content?.parts || [];
      extractedText = parts.map((p: any) => p.text).filter(Boolean).join('\n').trim();
    }

    return new Response(
      JSON.stringify({ success: true, length: extractedText.length, preview: extractedText.slice(0, 5000) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("debug-extract-text error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
