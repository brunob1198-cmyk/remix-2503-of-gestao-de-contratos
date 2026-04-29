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

// Quebra intervalo em janelas de até `maxDays` dias (NFS-e exige max 15 dias)
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

// NFS-e (serviço) - /v1/notas-fiscais-servico - max 15 dias por janela
async function fetchNotasServicoWindow(accessToken: string, dataDe: string, dataAte: string): Promise<any[]> {
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
    const url = `${CONTAAZUL_API}/v1/notas-fiscais-servico?${params.toString()}`;
    console.log("Fetching NFS-e:", url);

    const resp = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("Erro fetch NFS-e:", resp.status, errBody);
      // Se for "nenhuma nota encontrada", apenas retorna vazio em vez de quebrar
      if (resp.status === 404) return allItems;
      throw new Error(`Erro NFS-e (${dataDe} a ${dataAte}): HTTP ${resp.status} - ${errBody}`);
    }

    const pageData = await resp.json();
    const items: any[] = pageData.itens || [];

    if (items.length === 0) break;
    allItems.push(...items);

    const total = pageData.paginacao?.total_paginas || 1;
    if (pagina >= total) break;
    if (items.length < tamanhoPagina) break;
    pagina++;
    if (pagina > 200) break;
  }

  return allItems;
}

// NF-e (produto) - /v1/notas-fiscais - usa data_inicial/data_final
async function fetchNotasProdutoWindow(accessToken: string, dataDe: string, dataAte: string): Promise<any[]> {
  const allItems: any[] = [];
  let pagina = 1;
  const tamanhoPagina = 100;

  while (true) {
    const params = new URLSearchParams({
      data_inicial: dataDe,
      data_final: dataAte,
      pagina: pagina.toString(),
      tamanho_pagina: tamanhoPagina.toString(),
    });
    const url = `${CONTAAZUL_API}/v1/notas-fiscais?${params.toString()}`;
    console.log("Fetching NF-e:", url);

    const resp = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("Erro fetch NF-e:", resp.status, errBody);
      if (resp.status === 404) return allItems;
      console.warn(`NF-e indisponível (${dataDe} a ${dataAte}): HTTP ${resp.status}`);
      return allItems;
    }

    const pageData = await resp.json();
    const items: any[] = pageData.itens || [];

    if (items.length === 0) break;
    allItems.push(...items);

    const total = pageData.paginacao?.total_paginas || 1;
    if (pagina >= total) break;
    if (items.length < tamanhoPagina) break;
    pagina++;
    if (pagina > 200) break;
  }

  return allItems;
}

// Vendas - /v1/sales - para buscar centro de custo e detalhes financeiros
async function fetchVendaDetalhes(accessToken: string, saleId: string): Promise<any> {
  const url = `${CONTAAZUL_API}/v1/sales/${saleId}`;
  const resp = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
    },
  });
  if (!resp.ok) return null;
  return await resp.json();
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

    const today = new Date().toISOString().split("T")[0];
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
    const defaultFrom = ninetyDaysAgo.toISOString().split("T")[0];

    const dateFrom = body.date_from || defaultFrom;
    const dateTo = body.date_to || today;

    const windows = splitDateRange(dateFrom, dateTo, 15);
    console.log(`Total janelas: ${windows.length} | período ${dateFrom} a ${dateTo}`);

    const allNFSe: any[] = [];
    const allNFe: any[] = [];

    for (const w of windows) {
      const [nfse, nfe] = await Promise.all([
        fetchNotasServicoWindow(accessToken, w.from, w.to),
        fetchNotasProdutoWindow(accessToken, w.from, w.to),
      ]);
      allNFSe.push(...nfse);
      allNFe.push(...nfe);
    }

    console.log(`NFS-e: ${allNFSe.length} | NF-e: ${allNFe.length}`);

    const upsertsNFSe = await Promise.all(allNFSe.map(async (nf: any) => {
      let centroCusto = null;
      let valorAberto = 0;
      let valorBaixado = 0;
      let descricao = nf.observacoes || "";

      let numeroVenda = null;

      if (nf.id_venda) {
        const venda = await fetchVendaDetalhes(accessToken, nf.id_venda);
        if (venda) {
          numeroVenda = venda.number || venda.numero || null;
          if (venda.rateio_centro_custo && venda.rateio_centro_custo.length > 0) {
            centroCusto = venda.rateio_centro_custo[0].centro_custo?.nome || null;
          }
          valorAberto = Number(venda.valor_total || 0) - Number(venda.valor_recebido || 0);
          valorBaixado = Number(venda.valor_recebido || 0);
          if (!descricao) descricao = venda.notas || "";
        }
      }

      return {
        erp_id: nf.id,
        numero_nota: (nf.numero_nfse || nf.numero_rps)?.toString() || null,
        data_emissao: (nf.data_competencia || nf.informacao_transmissao?.data_inicio_emissao || "").split("T")[0] || null,
        cliente_nome: nf.nome_cliente || null,
        valor_total: Number(nf.valor_total_nfse || 0),
        valor_aberto: valorAberto,
        valor_baixado: valorBaixado,
        descricao: descricao,
        numero_venda: numeroVenda,
        centro_custo: centroCusto,
        status: nf.status || null,
        payload_json: nf,
        updated_at: new Date().toISOString(),
      };
    }));

    const upsertsNFe = await Promise.all(allNFe.map(async (nf: any) => {
      let centroCusto = null;
      let valorAberto = 0;
      let valorBaixado = 0;
      let descricao = nf.informacoes_adicionais || "";

      let numeroVenda = null;

      if (nf.id_venda) {
        const venda = await fetchVendaDetalhes(accessToken, nf.id_venda);
        if (venda) {
          numeroVenda = venda.number || venda.numero || null;
          if (venda.rateio_centro_custo && venda.rateio_centro_custo.length > 0) {
            centroCusto = venda.rateio_centro_custo[0].centro_custo?.nome || null;
          }
          valorAberto = Number(venda.valor_total || 0) - Number(venda.valor_recebido || 0);
          valorBaixado = Number(venda.valor_recebido || 0);
          if (!descricao) descricao = venda.notas || "";
        }
      }

      return {
        erp_id: nf.chave_acesso || nf.id,
        numero_nota: nf.numero_nota?.toString() || null,
        data_emissao: (nf.data_emissao || "").split("T")[0] || null,
        cliente_nome: nf.nome_destinatario || null,
        valor_total: Number(nf.valor_total || 0),
        valor_aberto: valorAberto,
        valor_baixado: valorBaixado,
        descricao: descricao,
        numero_venda: numeroVenda,
        centro_custo: centroCusto,
        status: nf.status || null,
        payload_json: nf,
        updated_at: new Date().toISOString(),
      };
    }));

    const allUpserts = [...upsertsNFSe, ...upsertsNFe].filter((u: any) => u.erp_id);

    if (allUpserts.length > 0) {
      const chunkSize = 50; // Reduced due to more data
      for (let i = 0; i < allUpserts.length; i += chunkSize) {
        const chunk = allUpserts.slice(i, i + chunkSize);
        const { error: upsertError } = await supabase
          .from("faturamentos_conta_azul")
          .upsert(chunk, { onConflict: "erp_id" });
        if (upsertError) throw upsertError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: allUpserts.length,
        nfse: upsertsNFSe.length,
        nfe: upsertsNFe.length,
        janelas: windows.length,
      }),
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
