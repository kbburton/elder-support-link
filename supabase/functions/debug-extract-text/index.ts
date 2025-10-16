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
      // Upload to Google Gemini Files API
      const uploadForm = new FormData();
      uploadForm.append("file", file, file.name || "document");

      const uploadResp = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GOOGLE_GEMINI_API_KEY}`,
        { method: "POST", body: uploadForm }
      );
      if (!uploadResp.ok) {
        const t = await uploadResp.text();
        throw new Error(`Google File upload failed: ${uploadResp.status} ${t}`);
      }
      const uploadData = await uploadResp.json();
      const fileUri: string | undefined = uploadData.file?.uri;
      const fileName: string | undefined = uploadData.file?.name;
      if (!fileUri || !fileName) throw new Error("Invalid response from Google Files API");

      // Wait briefly for processing
      await new Promise((r) => setTimeout(r, 2000));

      // Extract with Gemini 1.5 Flash
      const extractResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: "Extract all text content from this document. Preserve formatting, structure, and important details. Return only the extracted text without any commentary." },
                  { file_data: { file_uri: fileUri, mime_type: file.type || "application/octet-stream" } },
                ],
              },
            ],
          }),
        }
      );

      if (!extractResp.ok) {
        const t = await extractResp.text();
        console.error("Gemini extract failed:", extractResp.status, t);
        throw new Error(`Gemini extract failed: ${extractResp.status}`);
      }
      const extractJson = await extractResp.json();
      const parts = extractJson.candidates?.[0]?.content?.parts || [];
      extractedText = parts.map((p: any) => p.text).filter(Boolean).join("\n").trim();

      // Cleanup temp file
      const delResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GOOGLE_GEMINI_API_KEY}`,
        { method: "DELETE" }
      );
      if (!delResp.ok) {
        console.warn("Failed to delete Google temp file", delResp.status);
      }
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
