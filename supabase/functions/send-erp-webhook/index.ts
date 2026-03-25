import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { log_id, action } = body;

    // Use service role for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "retry" && log_id) {
      // Retry a specific log entry
      const { data: log, error: logErr } = await supabase
        .from("integracoes_erp_log")
        .select("*, integracoes_erp_config(*)")
        .eq("id", log_id)
        .single();
      if (logErr || !log) {
        return new Response(JSON.stringify({ error: "Log not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await sendToErp(log.integracoes_erp_config, log.payload);

      await supabase
        .from("integracoes_erp_log")
        .update({
          status: result.success ? "enviado" : "erro",
          resposta: result.response,
          erro: result.error || null,
          tentativas: (log.tentativas || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", log_id);

      return new Response(JSON.stringify({ success: result.success }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send") {
      const { config_id, empresa_id, evento, payload } = body;

      // Get config
      const { data: config, error: configErr } = await supabase
        .from("integracoes_erp_config")
        .select("*")
        .eq("id", config_id)
        .single();
      if (configErr || !config) {
        return new Response(JSON.stringify({ error: "Config not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create log entry
      const { data: log, error: logErr } = await supabase
        .from("integracoes_erp_log")
        .insert({
          config_id,
          empresa_id,
          evento,
          payload,
          status: "pendente",
        })
        .select()
        .single();
      if (logErr) throw logErr;

      // Send to ERP
      const result = await sendToErp(config, payload);

      // Update log
      await supabase
        .from("integracoes_erp_log")
        .update({
          status: result.success ? "enviado" : "erro",
          resposta: result.response,
          erro: result.error || null,
          tentativas: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", log.id);

      return new Response(
        JSON.stringify({ success: result.success, log_id: log.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ERP webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendToErp(
  config: { webhook_url: string; auth_token: string | null; auth_type: string },
  payload: Record<string, unknown>
): Promise<{ success: boolean; response: Record<string, unknown> | null; error: string | null }> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.auth_token) {
      if (config.auth_type === "bearer") {
        headers["Authorization"] = `Bearer ${config.auth_token}`;
      } else if (config.auth_type === "api-key") {
        headers["X-API-Key"] = config.auth_token;
      } else if (config.auth_type === "basic") {
        headers["Authorization"] = `Basic ${config.auth_token}`;
      }
    }

    const response = await fetch(config.webhook_url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const responseBody = await response.text();
    let responseJson: Record<string, unknown> | null = null;
    try {
      responseJson = JSON.parse(responseBody);
    } catch {
      responseJson = { raw: responseBody };
    }

    if (!response.ok) {
      return {
        success: false,
        response: responseJson,
        error: `HTTP ${response.status}: ${responseBody.slice(0, 500)}`,
      };
    }

    return { success: true, response: responseJson, error: null };
  } catch (error) {
    return {
      success: false,
      response: null,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
