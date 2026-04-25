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

// Divide o intervalo em janelas de até 15 dias (limite da API)
function splitDateRange(dateFrom: string, dateTo: string, maxDays = 15): Array<{ from: string; to: string }> {
  const windows: Array<{ from: string; to: string }> = [];
  const start = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);

  let cursor = new Date(start);
  while (cursor <= end) {
    const windowEnd = new Date(cursor);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + maxDays - 1);
    if (windowEnd > end) windowEnd.setTime(end.getTime());

    windows.push({
      from: cursor.toISOString().split("T")[0],
      to: windowEnd.toISOString().split("T")[0],
    });

    cursor = new Date(windowEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return windows;
}

async function fetchNotasFiscaisWindow(accessToken: string, dataDe: string, dataAte: string): Promise<any[]> {
  const allItems: any[] = [];
  let pagina = 1;
  const tamanhoPagina = 100;

  while (true) {
    const params = new URLSearchParams({
      data_competencia_de: dataDe,
      data_competencia_ate: dataAte,
      pagina: pagina.toString(),
      tamanho_pagina: tamanhoPagina.toString(),
    });
    const url = `${CONTAAZUL_API}/v1/notas-fiscais?${params.toString()}`;
    console.log("Fetching NFs:", url);

    const resp = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("Erro fetch NFs:", resp.status, errBody);
      throw new Error(`Erro ao buscar notas fiscais (${dataDe} a ${dataAte}): HTTP ${resp.status} - ${errBody}`);
    }

    const pageData = await resp.json();
    const items = Array.isArray(pageData)
      ? pageData
      : (pageData.itens || pageData.items || pageData.data || pageData.notas_fiscais || pageData.content || []);

    if (!items || items.length === 0) break;

    allItems.push(...items);

    if (items.length < tamanhoPagina) break;
    pagina++;
    if (pagina > 200) break; // safety cap
  }

  return allItems;
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

    // A API exige data_competencia_de/ate com janela máxima de 15 dias.
    // Padrão: últimos 90 dias se não vier nada (busca ampla mas razoável).
    const today = new Date().toISOString().split("T")[0];
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
    const defaultFrom = ninetyDaysAgo.toISOString().split("T")[0];

    const dateFrom = body.date_from || defaultFrom;
    const dateTo = body.date_to || today;

    // Quebra em janelas de 15 dias
    const windows = splitDateRange(dateFrom, dateTo, 15);
    console.log(`Total janelas de 15 dias: ${windows.length}`);

    const allNotas: any[] = [];
    for (const w of windows) {
      const items = await fetchNotasFiscaisWindow(accessToken, w.from, w.to);
      allNotas.push(...items);
    }

    console.log(`Total de notas fiscais recebidas: ${allNotas.length}`);

    const upserts = allNotas.map((nf: any) => {
      const centroCusto = (nf.rateio_centro_custo || nf.rateios_centro_custo || [])
        .map((r: any) => r.centro_custo?.nome || r.centro_custo_nome || r.nome)
        .filter(Boolean)
        .join(", ");

      return {
        erp_id: nf.id || nf.uuid,
        numero_nota: (nf.numero || nf.numero_nota || nf.numero_documento)?.toString() || null,
        data_emissao:
          (nf.data_emissao || nf.data_competencia || nf.data || "").split("T")[0] || null,
        cliente_nome: nf.cliente?.nome || nf.cliente_nome || nf.destinatario?.nome || null,
        valor_total: Number(nf.valor_total || nf.valor || nf.valor_nota || 0),
        centro_custo: centroCusto || null,
        status: nf.status || nf.situacao || null,
        payload_json: nf,
        updated_at: new Date().toISOString(),
      };
    }).filter((u: any) => u.erp_id);

    if (upserts.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < upserts.length; i += chunkSize) {
        const chunk = upserts.slice(i, i + chunkSize);
        const { error: upsertError } = await supabase
          .from("faturamentos_conta_azul")
          .upsert(chunk, { onConflict: "erp_id" });
        if (upsertError) throw upsertError;
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: upserts.length, janelas: windows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
