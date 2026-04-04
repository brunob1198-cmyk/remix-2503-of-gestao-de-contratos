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

  console.log("Token lookup result:", { hasData: !!tokenData, error: error?.message });

  if (error || !tokenData) {
    throw new Error("Conta Azul não conectada. Configure a integração primeiro.");
  }

  const now = new Date();
  const expiresAt = new Date(tokenData.expires_at);

  // Se ainda válido (com margem de 2 min), retorna direto
  if (expiresAt > new Date(now.getTime() + 120000)) {
    return tokenData.access_token;
  }

  // Refresh token
  console.log("Token expirado ou próximo de expirar, renovando...");
  return await refreshAccessToken(empresaId, tokenData);
}

async function refreshAccessToken(empresaId: string, tokenData: any): Promise<string> {
  const clientId = Deno.env.get("CONTAAZUL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("CONTAAZUL_CLIENT_SECRET")!;

  if (!tokenData.refresh_token || tokenData.refresh_token === "pre_generated_no_refresh") {
    throw new Error("Refresh token do Conta Azul não está configurado. Reconecte a integração.");
  }

  const tokenBody = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokenData.refresh_token,
  });

  const refreshResponse = await fetch(CONTAAZUL_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: tokenBody.toString(),
  });

  if (!refreshResponse.ok) {
    const errBody = await refreshResponse.text();
    console.error("Erro ao renovar token:", refreshResponse.status, errBody);
    throw new Error("Falha ao renovar token do Conta Azul. Reconecte a integração.");
  }

  const newTokens = await refreshResponse.json();
  const newExpiresAt = new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString();

  await supabase
    .from("contaazul_tokens")
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokenData.refresh_token,
      expires_at: newExpiresAt,
    })
    .eq("empresa_id", empresaId);

  console.log("Token renovado com sucesso, expira em:", newExpiresAt);
  return newTokens.access_token;
}

function categorizarDespesa(categoriaErp: string, descricao: string): string {
  const map = (categoriaErp || "").toLowerCase();
  const desc = (descricao || "").toLowerCase();

  if (map.includes("folha") || map.includes("salário") || desc.includes("obra") || map.includes("remuneração")) return "Mão de Obra";
  if (map.includes("aço") || map.includes("cimento") || map.includes("material") || map.includes("fornecedor")) return "Materiais";
  if (map.includes("aluguel") || map.includes("locação") || map.includes("equipamento") || map.includes("ferramenta")) return "Equipamentos";
  if (map.includes("frete") || map.includes("combustível") || map.includes("transporte")) return "Transporte";
  if (map.includes("imposto") || map.includes("banco") || map.includes("financeiro") || map.includes("tarifa") || map.includes("juros")) return "Financeiros";
  return "Indiretos";
}

// Buscar despesas (contas a pagar) usando a API v1 correta
async function fetchDespesasContaAzul(accessToken: string, startDate: string, endDate: string) {
  const allBills: any[] = [];
  let page = 1;
  const pageSize = 200;

  while (true) {
    // Endpoint correto: /v1/financeiro/eventos-financeiros/contas-a-pagar/buscar
    const params = new URLSearchParams({
      data_vencimento_de: startDate,
      data_vencimento_ate: endDate,
      pagina: String(page),
      tamanho_pagina: String(pageSize),
    });

    const url = `${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?${params.toString()}`;
    console.log(`Buscando contas a pagar (page ${page}):`, url);

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`Erro ao buscar contas a pagar (page ${page}):`, response.status, errBody);

      if (response.status === 401) {
        throw new Error("Token expirado ou inválido. Tente reconectar o Conta Azul.");
      }
      break;
    }

    const data = await response.json();
    console.log(`Resposta page ${page}:`, JSON.stringify(data).substring(0, 500));

    // A resposta pode ser um array direto ou um objeto com items
    const items = Array.isArray(data) ? data : (data.items || data.content || []);

    if (!Array.isArray(items) || items.length === 0) break;

    allBills.push(...items);

    if (items.length < pageSize) break;
    page++;
  }

  return allBills;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, empresa_id, start_date, end_date } = await req.json();

    if (action === "sync_contaazul") {
      if (!empresa_id) {
        return new Response(
          JSON.stringify({ error: "empresa_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Iniciando sincronização Conta Azul para empresa ${empresa_id}...`);

      // Obter token válido (com auto-refresh)
      const accessToken = await getValidAccessToken(empresa_id);

      // Definir período (default: mês atual)
      const now = new Date();
      const startDateStr = start_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const endDateStr = end_date || `${endMonth.getFullYear()}-${String(endMonth.getMonth() + 1).padStart(2, "0")}-${String(endMonth.getDate()).padStart(2, "0")}`;

      console.log(`Período: ${startDateStr} a ${endDateStr}`);

      // Buscar despesas da API
      const bills = await fetchDespesasContaAzul(accessToken, startDateStr, endDateStr);
      console.log(`Encontradas ${bills.length} contas a pagar no período.`);

      // Buscar mapeamento existente e sites
      const { data: mapeamentos } = await supabase.from("mapeamento_categorias_erp").select("*");
      const mapCategorias = new Map(mapeamentos?.map((m: any) => [m.categoria_erp, m.categoria_interna]));

      const { data: sites } = await supabase.from("sites").select("id, nome, projeto_id");

      let processadas = 0;
      for (const bill of bills) {
        // Mapear campos da API v1 do Conta Azul
        const evento = bill.evento || {};
        const erpId = bill.id || evento.id || `CA-${processadas}`;
        const descricao = bill.descricao || evento.descricao || bill.nota || "Sem descrição";
        const valorComposicao = bill.valor_composicao || {};
        const valor = Number(valorComposicao.valor_bruto || valorComposicao.valor_liquido || bill.valor_total_liquido || 0);
        const categoriaErp = evento.categoria?.nome || bill.categoria?.nome || "Outros";
        const centroCusto = evento.centro_custo?.nome || bill.centro_custo?.nome || null;
        const dataPagamento = bill.data_pagamento_previsto || bill.data_vencimento || null;
        const dataCompetencia = evento.data_competencia || bill.data_vencimento || startDateStr;
        const statusErp = (bill.status || "PENDENTE").toUpperCase();

        // Categorizar
        let categoriaInterna = mapCategorias.get(categoriaErp);
        if (!categoriaInterna) {
          categoriaInterna = categorizarDespesa(categoriaErp, descricao);
          await supabase.from("mapeamento_categorias_erp").insert({
            categoria_erp: categoriaErp,
            categoria_interna: categoriaInterna,
            criado_por_ia: true,
          }).then(() => {});
          mapCategorias.set(categoriaErp, categoriaInterna);
        }

        // Cruzar centro de custo com sites
        let siteId = null;
        let projetoId = null;
        if (centroCusto && sites) {
          const siteEnc = sites.find((s: any) =>
            s.nome.toLowerCase() === centroCusto.toLowerCase() ||
            centroCusto.toLowerCase().includes(s.nome.toLowerCase())
          );
          if (siteEnc) {
            siteId = siteEnc.id;
            projetoId = siteEnc.projeto_id;
          }
        }

        // Mapear status
        const statusNormalizado = ["QUITADO", "RECEBIDO"].includes(statusErp) ? "pago" : "pendente";

        await supabase.from("custo_real_erp").upsert({
          erp_id: erpId,
          descricao,
          valor,
          data_pagamento: dataPagamento,
          data_competencia: dataCompetencia,
          status_erp: statusNormalizado,
          categoria_erp: categoriaErp,
          categoria_interna: categoriaInterna || "Indiretos",
          centro_custo: centroCusto,
          projeto_id: projetoId,
          site_id: siteId,
        }, { onConflict: "erp_id" });

        processadas++;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Sincronizadas ${processadas} despesas do Conta Azul.`,
          total: bills.length,
          processadas,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação não reconhecida." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro sync-contaazul:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
