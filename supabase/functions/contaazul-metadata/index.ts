import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTAAZUL_API = "https://api-v2.contaazul.com";
const CONTAAZUL_TOKEN_URL = "https://auth.contaazul.com/oauth2/token";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function refreshAccessToken(supabase: any, empresaId: string, tokenData: any): Promise<string> {
  const clientId = Deno.env.get("CONTAAZUL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("CONTAAZUL_CLIENT_SECRET")!;

  if (!tokenData.refresh_token || tokenData.refresh_token === "pre_generated_no_refresh") {
    throw new Error("Refresh token do Conta Azul indisponível. Reconecte a integração.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokenData.refresh_token,
  });

  const resp = await fetch(CONTAAZUL_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    console.error("Erro refresh token CA:", resp.status, errBody);
    throw new Error("Falha ao renovar token do Conta Azul.");
  }

  const newTokens = await resp.json();
  const expiresAt = new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString();

  await supabase
    .from("contaazul_tokens")
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokenData.refresh_token,
      expires_at: expiresAt,
    })
    .eq("empresa_id", empresaId);

  return newTokens.access_token;
}

async function getValidAccessToken(supabase: any, empresaId: string): Promise<string> {
  const { data, error } = await supabase
    .from("contaazul_tokens")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Conta Azul não conectado para esta empresa.");
  }

  const expiresAt = new Date(data.expires_at);
  if (expiresAt > new Date(Date.now() + 120000)) {
    return data.access_token;
  }

  return await refreshAccessToken(supabase, empresaId, data);
}

async function fetchAllPages(url: string, token: string): Promise<any[]> {
  const items: any[] = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore && page <= 50) {
    const sep = url.includes("?") ? "&" : "?";
    const fullUrl = `${url}${sep}pagina=${page}&tamanho_pagina=${pageSize}`;
    const resp = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("Erro CA fetch:", fullUrl, resp.status, errBody);
      throw new Error(`Falha ao buscar dados do Conta Azul (${resp.status})`);
    }

    const json = await resp.json();
    const list = Array.isArray(json) ? json : (json.itens || json.data || json.items || []);

    if (!list.length) break;
    items.push(...list);

    if (list.length < pageSize) {
      hasMore = false;
    } else {
      page += 1;
    }
  }

  return items;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile?.empresa_id) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getValidAccessToken(supabase, profile.empresa_id);

    const [categorias, contas] = await Promise.all([
      fetchAllPages(`${CONTAAZUL_API}/v1/categorias`, token).catch((e) => {
        console.error("Falha categorias:", e.message);
        return [];
      }),
      fetchAllPages(`${CONTAAZUL_API}/v1/contas-financeiras`, token).catch((e) => {
        console.error("Falha contas-financeiras:", e.message);
        return [];
      }),
    ]);

    const normalizedCategorias = categorias.map((c: any) => ({
      id: String(c.id ?? c.uuid ?? c.codigo ?? ""),
      name: c.nome || c.descricao || c.name || "",
      tipo: c.tipo || c.tipo_operacao || null,
    })).filter((c) => c.id && c.name);

    const normalizedContas = contas.map((c: any) => ({
      id: String(c.id ?? c.uuid ?? c.codigo ?? ""),
      name: c.nome || c.descricao || c.name || "",
      tipo: c.tipo_conta || c.tipo || null,
    })).filter((c) => c.id && c.name);

    return new Response(
      JSON.stringify({
        categorias: normalizedCategorias,
        contas_financeiras: normalizedContas,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Erro contaazul-metadata:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
