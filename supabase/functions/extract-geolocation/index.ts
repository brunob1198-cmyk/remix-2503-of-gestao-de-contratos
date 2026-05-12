import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a geolocation extraction assistant. Analyze the image and try to extract location information from any visible text, signs, landmarks, or contextual clues.

Return ONLY a JSON object with this exact format:
{
  "latitude": number or null,
  "longitude": number or null,
  "location_description": "string describing the identified location",
  "confidence": "high" | "medium" | "low" | "none",
  "method": "text_recognition" | "landmark" | "contextual" | "none"
}

Rules:
- If you can identify specific coordinates from text/signs in the image, provide them
- If you recognize a landmark or location, estimate the coordinates
- If you can read address text, try to estimate approximate coordinates for Brazil
- If you cannot determine any location, return null for both coordinates and "none" for confidence
- Always provide a location_description even if coordinates are null
- Be honest about confidence level`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this image and extract any geolocation information. Look for text, signs, addresses, landmarks, or any contextual clues that could help determine the location.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_geolocation",
                description: "Extract geolocation data from image analysis",
                parameters: {
                  type: "object",
                  properties: {
                    latitude: {
                      type: "number",
                      description: "Latitude coordinate, or null if not determinable",
                    },
                    longitude: {
                      type: "number",
                      description: "Longitude coordinate, or null if not determinable",
                    },
                    location_description: {
                      type: "string",
                      description: "Description of the identified location",
                    },
                    confidence: {
                      type: "string",
                      enum: ["high", "medium", "low", "none"],
                    },
                    method: {
                      type: "string",
                      enum: ["text_recognition", "landmark", "contextual", "none"],
                    },
                  },
                  required: [
                    "latitude",
                    "longitude",
                    "location_description",
                    "confidence",
                    "method",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_geolocation" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Add funds in Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        latitude: null,
        longitude: null,
        location_description: "Could not extract location",
        confidence: "none",
        method: "none",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("extract-geolocation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
