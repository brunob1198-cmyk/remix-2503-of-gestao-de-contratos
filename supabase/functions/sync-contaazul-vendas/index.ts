import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTAAZUL_API = "https://api-v2.contaazul.com";
const CONTAAZUL_TOKEN_URL = "https://auth.contaazul.com/oauth2/token";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getValidAccessToken(empresaId: string): Promise<string> {
  const { data: tokenData, error } = await supabase
    .from("contaazul_tokens")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error || !tokenData) {
    throw new Error("Conta Azul não conectada para esta empresa.");
  }

  const now = new Date();
  const expiresAt = new Date(tokenData.expires_at);

  if (expiresAt > new Date(now.getTime() + 120000)) {
    return tokenData.access_token;
  }

  return await refreshAccessToken(empresaId, tokenData);
}

async function refreshAccessToken(empresaId: string, tokenData: any): Promise<string> {
  const clientId = Deno.env.get("CONTAAZUL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("CONTAAZUL_CLIENT_SECRET")!;

  const tokenBody = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokenData.refresh_token,
  });

  const resp = await fetch(CONTAAZUL_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: tokenBody.toString(),
  });

  if (!resp.ok) {
    throw new Error("Falha ao renovar token do Conta Azul.");
  }

  const newTokens = await resp.json();
  const newExpiresAt = new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString();

  await supabase
    .from("contaazul_tokens")
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokenData.refresh_token,
      expires_at: newExpiresAt,
    })
    .eq("empresa_id", empresaId);

  return newTokens.access_token;
}

// Tenta múltiplas variações de path/parâmetros para descobrir o endpoint correto de notas fiscais
async function probeSalesEndpoint(accessToken: string, dateFrom: string, dateTo: string) {
  const dateFromISO = `${dateFrom}T00:00:00Z`;
  const dateToISO = `${dateTo}T23:59:59Z`;

  const candidates = [
    `${CONTAAZUL_API}/v1/notas-fiscais?data_emissao_inicial=${dateFromISO}&data_emissao_final=${dateToISO}&pagina=1&tamanho_pagina=10`,
    `${CONTAAZUL_API}/v1/notas-fiscais?data_emissao_de=${dateFrom}&data_emissao_ate=${dateTo}&pagina=1&tamanho_pagina=10`,
    `${CONTAAZUL_API}/v1/notas-fiscais?data_inicial=${dateFrom}&data_final=${dateTo}&pagina=1&tamanho_pagina=10`,
    `${CONTAAZUL_API}/v1/notas-fiscais?data_emissao_de=${dateFromISO}&data_emissao_ate=${dateToISO}&pagina=1&tamanho_pagina=10`,
    `${CONTAAZUL_API}/v1/notas-fiscais?emissao_de=${dateFrom}&emissao_ate=${dateTo}&pagina=1&tamanho_pagina=10`,
    `${CONTAAZUL_API}/v1/notas-fiscais/buscar?data_emissao_de=${dateFrom}&data_emissao_ate=${dateTo}&pagina=1&tamanho_pagina=10`,
    `${CONTAAZUL_API}/v1/notas-fiscais?page=1&size=10`,
    `${CONTAAZUL_API}/v1/notas-fiscais/listar?pagina=1&tamanho_pagina=10`,
  ];

  const results: any[] = [];
  for (const url of candidates) {
    try {
      const resp = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      });
      const text = await resp.text();
      results.push({
        url,
        status: resp.status,
        body: text.length > 800 ? text.slice(0, 800) + "..." : text,
      });
    } catch (e) {
      results.push({ url, error: (e as Error).message });
    }
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) throw new Error("Usuário não autenticado");

    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile?.empresa_id) throw new Error("Empresa não encontrada para o perfil");

    const accessToken = await getValidAccessToken(profile.empresa_id);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const dateFrom = body.date_from || "2000-01-01";
    const dateTo = body.date_to || new Date().toISOString().split('T')[0];

    // Modo probe: testa endpoints e retorna respostas
    if (body.probe) {
      const results = await probeSalesEndpoint(accessToken, dateFrom, dateTo);
      return new Response(JSON.stringify({ probe: results }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      message: "Endpoint de vendas em descoberta. Use {\"probe\":true} para diagnosticar.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
