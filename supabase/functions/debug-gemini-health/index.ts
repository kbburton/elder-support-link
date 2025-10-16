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
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "GOOGLE_GEMINI_API_KEY is not configured",
          models: [] 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check available models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${GOOGLE_GEMINI_API_KEY}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `API Error: ${response.status} - ${errorText}`,
          models: []
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const models = data.models || [];

    // Extract model names and check for required models
    const modelNames = models.map((m: any) => m.name);
    const hasGemini25Flash = modelNames.some((n: string) => n.includes("gemini-2.5-flash"));
    const hasGemini25Pro = modelNames.some((n: string) => n.includes("gemini-2.5-pro"));
    const hasGemini20Flash = modelNames.some((n: string) => n.includes("gemini-2.0-flash"));
    
    return new Response(
      JSON.stringify({ 
        success: true,
        apiKeyConfigured: true,
        models: modelNames,
        recommendations: {
          "gemini-2.5-flash": hasGemini25Flash ? "✅ Available (Recommended)" : "❌ Not Available",
          "gemini-2.5-pro": hasGemini25Pro ? "✅ Available (Powerful)" : "❌ Not Available",
          "gemini-2.0-flash": hasGemini20Flash ? "✅ Available (Fallback)" : "❌ Not Available"
        },
        totalCount: models.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("debug-gemini-health error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        models: []
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
