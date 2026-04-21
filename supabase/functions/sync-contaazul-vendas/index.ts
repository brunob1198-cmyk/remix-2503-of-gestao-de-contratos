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

    // Permite intervalo customizado via body, ou busca tudo (sem limite)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const dateFromStr = body.date_from
      ? `${body.date_from}T00:00:00Z`
      : "2000-01-01T00:00:00Z"; // sem limite (desde sempre)
    const dateToStr = body.date_to
      ? `${body.date_to}T23:59:59Z`
      : new Date().toISOString().split('T')[0] + 'T23:59:59Z';

    // Paginação completa via API do Conta Azul
    const allSales: any[] = [];
    let pagina = 0;
    const tamanho_pagina = 100;
    let totalRecebido = 0;

    while (true) {
      const url = `${CONTAAZUL_API}/v1/vendas?data_inicio=${dateFromStr}&data_fim=${dateToStr}&pagina=${pagina}&tamanho_pagina=${tamanho_pagina}`;
      console.log("Fetching sales page:", pagina, "url:", url);

      const resp = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        console.error("Erro fetch vendas:", resp.status, errBody);
        throw new Error(`Erro ao buscar vendas no Conta Azul: HTTP ${resp.status}`);
      }

      const pageData = await resp.json();
      const items = Array.isArray(pageData) ? pageData : (pageData.itens || pageData.items || pageData.data || []);
      
      if (!items || items.length === 0) break;
      
      allSales.push(...items);
      totalRecebido += items.length;
      
      if (items.length < tamanho_pagina) break;
      pagina++;
      
      // Hard cap de segurança
      if (pagina > 200) break;
    }

    console.log(`Total de vendas recebidas: ${totalRecebido}`);

    const upserts = allSales.map((sale: any) => {
      const centroCusto = (sale.rateio_centro_custo || [])
        .map((r: any) => r.centro_custo?.nome || r.centro_custo_nome)
        .filter(Boolean)
        .join(", ");

      return {
        erp_id: sale.id,
        numero_nota: sale.numero?.toString() || sale.numero_venda?.toString() || null,
        data_emissao: sale.data_venda?.split('T')[0] || sale.data?.split('T')[0],
        cliente_nome: sale.cliente?.nome || sale.cliente_nome,
        valor_total: sale.valor_total || sale.valor || 0,
        centro_custo: centroCusto || null,
        status: sale.status,
        payload_json: sale,
        updated_at: new Date().toISOString(),
      };
    });

    if (upserts.length > 0) {
      // Upsert em chunks para evitar payloads gigantes
      const chunkSize = 100;
      for (let i = 0; i < upserts.length; i += chunkSize) {
        const chunk = upserts.slice(i, i + chunkSize);
        const { error: upsertError } = await supabase
          .from("faturamentos_conta_azul")
          .upsert(chunk, { onConflict: "erp_id" });
        if (upsertError) throw upsertError;
      }
    }

    return new Response(JSON.stringify({ success: true, count: upserts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
