import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTAAZUL_AUTH_URL = "https://auth.contaazul.com/login";
const CONTAAZUL_TOKEN_URL = "https://auth.contaazul.com/oauth2/token";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("CONTAAZUL_CLIENT_ID");
  const clientSecret = Deno.env.get("CONTAAZUL_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: "Credenciais do Conta Azul não configuradas." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { action, code, redirect_uri, empresa_id } = await req.json();

    // 1. Gerar URL de autorização
    if (action === "get_auth_url") {
      if (!redirect_uri) {
        return new Response(JSON.stringify({ error: "redirect_uri é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirect_uri,
        scope: "sales",
        state: empresa_id || "default",
      });

      const authUrl = `${CONTAAZUL_AUTH_URL}?${params.toString()}`;

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Trocar code por tokens
    if (action === "exchange_code") {
      if (!code || !redirect_uri) {
        return new Response(JSON.stringify({ error: "code e redirect_uri são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirect_uri,
      });

      console.log("Trocando code por tokens...", { code, redirect_uri });

      const tokenResponse = await fetch(CONTAAZUL_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: tokenBody.toString(),
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        console.error("Erro ao trocar code:", tokenResponse.status, errorBody);
        return new Response(
          JSON.stringify({ error: `Falha na autenticação: ${tokenResponse.status}`, details: errorBody }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const tokens = await tokenResponse.json();
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

      // Salvar tokens no banco
      const { error: upsertError } = await supabase.from("contaazul_tokens").upsert(
        {
          empresa_id: empresa_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
        },
        { onConflict: "empresa_id" },
      );

      if (upsertError) {
        console.error("Erro ao salvar tokens:", upsertError);
        return new Response(JSON.stringify({ error: "Erro ao salvar tokens", details: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Conta Azul conectada com sucesso!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Verificar status da conexão
    if (action === "check_status") {
      if (!empresa_id) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: tokenData } = await supabase
        .from("contaazul_tokens")
        .select("expires_at")
        .eq("empresa_id", empresa_id)
        .single();

      if (!tokenData) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isExpired = new Date(tokenData.expires_at) < new Date();

      return new Response(JSON.stringify({ connected: true, expired: isExpired }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Desconectar
    if (action === "disconnect") {
      if (!empresa_id) {
        return new Response(JSON.stringify({ error: "empresa_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("contaazul_tokens").delete().eq("empresa_id", empresa_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Erro na edge function contaazul-oauth:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
