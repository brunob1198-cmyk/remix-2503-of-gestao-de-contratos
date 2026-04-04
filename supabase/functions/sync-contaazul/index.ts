import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTAAZUL_API = "https://api.contaazul.com/v2";
const CONTAAZUL_TOKEN_URL = "https://api.contaazul.com/oauth2/token";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Refresh token se expirado
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

  // Se ainda válido, retorna direto
  if (expiresAt > new Date(now.getTime() + 60000)) {
    return tokenData.access_token;
  }

  // Refresh token
  const clientId = Deno.env.get("CONTAAZUL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("CONTAAZUL_CLIENT_SECRET")!;

  const refreshResponse = await fetch(CONTAAZUL_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: tokenData.refresh_token,
    }),
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

  return newTokens.access_token;
}

// Categorizar despesa por IA ou regras
async function categorizarDespesa(categoriaErp: string, descricao: string): Promise<string> {
  const map = (categoriaErp || "").toLowerCase();
  const desc = (descricao || "").toLowerCase();

  if (map.includes("folha") || map.includes("salário") || desc.includes("obra") || map.includes("remuneração")) return "Mão de Obra";
  if (map.includes("aço") || map.includes("cimento") || map.includes("material") || map.includes("fornecedor")) return "Materiais";
  if (map.includes("aluguel") || map.includes("locação") || map.includes("equipamento") || map.includes("ferramenta")) return "Equipamentos";
  if (map.includes("frete") || map.includes("combustível") || map.includes("transporte")) return "Transporte";
  if (map.includes("imposto") || map.includes("banco") || map.includes("financeiro") || map.includes("tarifa") || map.includes("juros")) return "Financeiros";
  return "Indiretos";
}

// Buscar despesas/contas a pagar da API Conta Azul
async function fetchDespesasContaAzul(accessToken: string, startDate: string, endDate: string) {
  const allBills: any[] = [];
  let page = 1;
  const pageSize = 200;

  while (true) {
    // Endpoint de contas a pagar (bills)
    const url = `${CONTAAZUL_API}/bills?start_date=${startDate}&end_date=${endDate}&page=${page}&size=${pageSize}`;
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`Erro ao buscar contas a pagar (page ${page}):`, response.status, errBody);
      
      if (response.status === 401) {
        throw new Error("Token expirado ou inválido");
      }
      break;
    }

    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) break;
    
    allBills.push(...data);
    
    if (data.length < pageSize) break;
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

      // Obter token válido
      const accessToken = await getValidAccessToken(empresa_id);

      // Definir período (default: mês atual)
      const now = new Date();
      const startDateStr = start_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const endDateStr = end_date || `${endMonth.getFullYear()}-${String(endMonth.getMonth() + 1).padStart(2, "0")}-${String(endMonth.getDate()).padStart(2, "0")}`;

      // Buscar despesas da API
      const bills = await fetchDespesasContaAzul(accessToken, startDateStr, endDateStr);
      console.log(`Encontradas ${bills.length} contas a pagar no período.`);

      // Buscar mapeamento existente e sites
      const { data: mapeamentos } = await supabase.from("mapeamento_categorias_erp").select("*");
      const mapCategorias = new Map(mapeamentos?.map((m: any) => [m.categoria_erp, m.categoria_interna]));

      const { data: sites } = await supabase.from("sites").select("id, nome, projeto_id");

      let processadas = 0;
      for (const bill of bills) {
        const erpId = bill.id || `CA-${bill.document || processadas}`;
        const descricao = bill.note || bill.description || bill.document || "Sem descrição";
        const valor = Number(bill.value || bill.amount || 0);
        const categoriaErp = bill.category?.name || bill.category_name || "Outros";
        const centroCusto = bill.cost_center?.name || bill.cost_center_name || null;
        const dataPagamento = bill.payment_date || bill.due_date || null;
        const dataCompetencia = bill.competence_date || bill.due_date || bill.emission_date || startDateStr;
        const statusErp = bill.status?.toLowerCase() || "pendente";

        // Categorizar
        let categoriaInterna = mapCategorias.get(categoriaErp);
        if (!categoriaInterna) {
          categoriaInterna = await categorizarDespesa(categoriaErp, descricao);
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

        await supabase.from("custo_real_erp").upsert({
          erp_id: erpId,
          descricao,
          valor,
          data_pagamento: dataPagamento,
          data_competencia: dataCompetencia,
          status_erp: statusErp === "paid" || statusErp === "pago" ? "pago" : "pendente",
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
