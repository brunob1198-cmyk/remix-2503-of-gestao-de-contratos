import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTAAZUL_AUTH_URL = "https://auth.contaazul.com/login";
const CONTAAZUL_TOKEN_URL = "https://auth.contaazul.com/oauth2/token";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
    const { action, code, redirect_uri, empresa_id, access_token, refresh_token: inputRefreshToken } = await req.json();
    const basicAuth = btoa(`${clientId}:${clientSecret}`);

    const requestContaAzulToken = async (params: URLSearchParams, context: string) => {
      const tokenResponse = await fetch(CONTAAZUL_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${basicAuth}`,
        },
        body: params.toString(),
      });

      const rawBody = await tokenResponse.text();
      let parsedBody: unknown = rawBody;

      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        parsedBody = rawBody;
      }

      if (!tokenResponse.ok) {
        console.error(`Erro Conta Azul (${context}):`, tokenResponse.status, rawBody);
        return { ok: false as const, status: tokenResponse.status, body: parsedBody };
      }

      return { ok: true as const, data: (parsedBody ?? {}) as Record<string, any> };
    };

    const persistTokens = async (
      tokens: Record<string, any>,
      empresaId: string,
      fallbackRefreshToken?: string,
    ) => {
      const refreshToken = tokens.refresh_token || fallbackRefreshToken;

      if (!refreshToken) {
        throw new Error("Refresh token não retornado pelo Conta Azul.");
      }

      const expiresAt = new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString();

      const { error: upsertError } = await supabase.from("contaazul_tokens").upsert(
        {
          empresa_id: empresaId,
          access_token: tokens.access_token,
          refresh_token: refreshToken,
          expires_at: expiresAt,
        },
        { onConflict: "empresa_id" },
      );

      if (upsertError) {
        throw upsertError;
      }

      return expiresAt;
    };

    // 1. Gerar URL de autorização
    if (action === "get_auth_url") {
      if (!redirect_uri) {
        return jsonResponse({ error: "redirect_uri é obrigatório" }, 400);
      }

      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirect_uri,
        scope: "openid profile aws.cognito.signin.user.admin",
        state: empresa_id || "default",
      });

      const authUrl = `${CONTAAZUL_AUTH_URL}?${params.toString()}`;

      return jsonResponse({ auth_url: authUrl });
    }

    // 2. Trocar code por tokens
    if (action === "exchange_code") {
      if (!code || !redirect_uri || !empresa_id) {
        return jsonResponse({ error: "code, redirect_uri e empresa_id são obrigatórios" }, 400);
      }

      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirect_uri,
      });

      console.log("Trocando code por tokens...", { code, redirect_uri, tokenUrl: CONTAAZUL_TOKEN_URL });

      const tokenResult = await requestContaAzulToken(tokenBody, "troca do código");

      if (!tokenResult.ok) {
        return jsonResponse(
          { error: `Falha na autenticação: ${tokenResult.status}`, details: tokenResult.body },
          400,
        );
      }

      const expiresAt = await persistTokens(tokenResult.data, empresa_id);

      return jsonResponse({
        success: true,
        message: "Conta Azul conectada com sucesso!",
        expires_at: expiresAt,
      });
    }

    // 3. Renovar tokens usando refresh_token
    if (action === "refresh_token") {
      if (!empresa_id) {
        return jsonResponse({ error: "empresa_id é obrigatório" }, 400);
      }

      let refreshToken = inputRefreshToken;

      if (!refreshToken) {
        const { data: storedToken, error: storedTokenError } = await supabase
          .from("contaazul_tokens")
          .select("refresh_token")
          .eq("empresa_id", empresa_id)
          .maybeSingle();

        if (storedTokenError) {
          console.error("Erro ao buscar refresh_token salvo:", storedTokenError);
          return jsonResponse({ error: "Erro ao buscar refresh token", details: storedTokenError.message }, 500);
        }

        refreshToken = storedToken?.refresh_token;
      }

      if (!refreshToken || refreshToken === "pre_generated_no_refresh") {
        return jsonResponse({ error: "Refresh token não configurado para esta empresa." }, 400);
      }

      console.log("Renovando token do Conta Azul...", { empresa_id, tokenUrl: CONTAAZUL_TOKEN_URL });

      const tokenBody = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });

      const tokenResult = await requestContaAzulToken(tokenBody, "refresh token");

      if (!tokenResult.ok) {
        return jsonResponse(
          { error: `Falha ao renovar token: ${tokenResult.status}`, details: tokenResult.body },
          400,
        );
      }

      const expiresAt = await persistTokens(tokenResult.data, empresa_id, refreshToken);

      return jsonResponse({
        success: true,
        message: "Token renovado com sucesso!",
        expires_at: expiresAt,
      });
    }

    // 4. Verificar status da conexão
    if (action === "check_status") {
      if (!empresa_id) {
        return jsonResponse({ connected: false });
      }

      const { data: tokenData } = await supabase
        .from("contaazul_tokens")
        .select("expires_at")
        .eq("empresa_id", empresa_id)
        .single();

      if (!tokenData) {
        return jsonResponse({ connected: false });
      }

      const isExpired = new Date(tokenData.expires_at) < new Date();

      return jsonResponse({ connected: true, expired: isExpired });
    }

    // 5. Salvar token pré-gerado (do painel de desenvolvedor)
    if (action === "save_token") {
      if (!empresa_id || !access_token) {
        return jsonResponse({ error: "empresa_id e access_token são obrigatórios" }, 400);
      }

      // Decodificar JWT para pegar expiração
      let expiresAt: string;
      try {
        const payloadB64 = access_token.split('.')[1];
        const payload = JSON.parse(atob(payloadB64));
        expiresAt = new Date(payload.exp * 1000).toISOString();
      } catch {
        // Se não conseguir decodificar, usar 1h a partir de agora
        expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
      }

      const { error: upsertError } = await supabase.from("contaazul_tokens").upsert(
        {
          empresa_id: empresa_id,
          access_token: access_token,
          refresh_token: inputRefreshToken || "pre_generated_no_refresh",
          expires_at: expiresAt,
        },
        { onConflict: "empresa_id" },
      );

      if (upsertError) {
        console.error("Erro ao salvar token:", upsertError);
        return jsonResponse({ error: "Erro ao salvar token", details: upsertError.message }, 500);
      }

      console.log("Token pré-gerado salvo com sucesso para empresa:", empresa_id, "expira em:", expiresAt);

      return jsonResponse({ 
        success: true,
        message: "Token do Conta Azul salvo com sucesso!",
        expires_at: expiresAt,
      });
    }

    // 6. Desconectar
    if (action === "disconnect") {
      if (!empresa_id) {
        return jsonResponse({ error: "empresa_id obrigatório" }, 400);
      }

      await supabase.from("contaazul_tokens").delete().eq("empresa_id", empresa_id);

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Ação não reconhecida" }, 400);
  } catch (error: any) {
    console.error("Erro na edge function contaazul-oauth:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
