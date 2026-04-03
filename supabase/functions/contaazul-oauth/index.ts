import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ✅ URLs corrigidas
const CONTAAZUL_AUTH_URL = "https://api.contaazul.com/oauth2/authorize";
const CONTAAZUL_TOKEN_URL = "https://api.contaazul.com/oauth2/token";

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
    const url = new URL(req.url);

    // 🔥 IMPORTANTE: suporta GET (callback OAuth) e POST (ações internas)
    let body: any = {};
    if (req.method === "POST") {
      body = await req.json();
    }

    const action = body.action;

    // =====================================================
    // 🔹 1. GERAR URL DE AUTORIZAÇÃO
    // =====================================================
    if (action === "get_auth_url") {
      const { redirect_uri, empresa_id } = body;

      if (!redirect_uri || !empresa_id) {
        return new Response(JSON.stringify({ error: "redirect_uri e empresa_id são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri,
        scope: "sales",
        state: empresa_id, // 🔥 ESSENCIAL
      });

      const authUrl = `${CONTAAZUL_AUTH_URL}?${params.toString()}`;

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================
    // 🔹 2. CALLBACK DIRETO (QUANDO CONTA AZUL REDIRECIONA)
    // =====================================================
    if (req.method === "GET" && url.searchParams.get("code")) {
      const code = url.searchParams.get("code");
      const empresa_id = url.searchParams.get("state"); // 🔥 vem daqui

      if (!code || !empresa_id) {
        return new Response(JSON.stringify({ error: "code ou state ausente" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 🔥 troca code por token (CORRETO)
      const tokenResponse = await fetch(CONTAAZUL_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: `${url.origin}${url.pathname}`, // mesma URL configurada
        }),
      });

      const tokens = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error("Erro token:", tokens);
        return new Response(JSON.stringify({ error: "Erro ao autenticar", details: tokens }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // 🔥 salva corretamente
      const { error } = await supabase.from("contaazul_tokens").upsert(
        {
          empresa_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
        },
        { onConflict: "empresa_id" },
      );

      if (error) {
        console.error("Erro ao salvar:", error);
        return new Response(JSON.stringify({ error: "Erro ao salvar tokens" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Conta Azul conectada com sucesso!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================
    // 🔹 3. VERIFICAR STATUS
    // =====================================================
    if (action === "check_status") {
      const { empresa_id } = body;

      if (!empresa_id) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data } = await supabase.from("contaazul_tokens").select("*").eq("empresa_id", empresa_id).single();

      if (!data) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expired = new Date(data.expires_at) < new Date();

      return new Response(JSON.stringify({ connected: true, expired }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================
    // 🔹 4. DISCONNECT
    // =====================================================
    if (action === "disconnect") {
      const { empresa_id } = body;

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
    console.error("Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
