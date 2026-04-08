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

type ProjetoLookup = {
  id: string;
  codigo: string | null;
  nome: string;
  normalizedCode: string;
  normalizedName: string;
};

type SiteLookup = {
  id: string;
  codigo: string | null;
  nome: string;
  projeto_id: string;
  normalizedCode: string;
  normalizedName: string;
};

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(target: string, candidate: string): number {
  if (!target || !candidate) return 0;
  if (target === candidate) return 1000 + candidate.length;
  if (target.startsWith(candidate)) return 500 + candidate.length;
  if (target.includes(candidate)) return 100 + candidate.length;
  return 0;
}

function extractProjectCode(value: string | null | undefined): string | null {
  const match = (value || "").toUpperCase().match(/[A-Z]\d{3}\.\d{2}/);
  return match?.[0] || null;
}

function resolveProjetoESite(
  centroCusto: string | null,
  projetos: ProjetoLookup[],
  sites: SiteLookup[],
  sitesByProjeto: Map<string, SiteLookup[]>,
  projetosByCode: Map<string, ProjetoLookup>,
) {
  if (!centroCusto) {
    return { projetoId: null, siteId: null, strategy: "none" };
  }

  const normalizedCentro = normalizeText(centroCusto);
  if (!normalizedCentro) {
    return { projetoId: null, siteId: null, strategy: "none" };
  }

  const directSiteMatch = sites
    .map((site) => ({
      site,
      score: Math.max(
        scoreMatch(normalizedCentro, site.normalizedCode),
        scoreMatch(normalizedCentro, site.normalizedName),
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (directSiteMatch) {
    return {
      projetoId: directSiteMatch.site.projeto_id,
      siteId: directSiteMatch.site.id,
      strategy: "site-direct",
    };
  }

  const extractedCode = extractProjectCode(centroCusto);
  let matchedProject = extractedCode ? projetosByCode.get(normalizeText(extractedCode)) || null : null;

  if (!matchedProject) {
    matchedProject = projetos
      .map((projeto) => ({
        projeto,
        score: Math.max(
          scoreMatch(normalizedCentro, projeto.normalizedCode),
          scoreMatch(normalizedCentro, projeto.normalizedName),
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.projeto || null;
  }

  if (!matchedProject) {
    return { projetoId: null, siteId: null, strategy: "unmatched" };
  }

  const candidateSites = sitesByProjeto.get(matchedProject.id) || [];
  const scopedSiteMatch = candidateSites
    .map((site) => ({
      site,
      score: Math.max(
        scoreMatch(normalizedCentro, site.normalizedCode),
        scoreMatch(normalizedCentro, site.normalizedName),
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (scopedSiteMatch) {
    return {
      projetoId: matchedProject.id,
      siteId: scopedSiteMatch.site.id,
      strategy: "project-site",
    };
  }

  if (candidateSites.length === 1) {
    return {
      projetoId: matchedProject.id,
      siteId: candidateSites[0].id,
      strategy: "project-single-site",
    };
  }

  return { projetoId: matchedProject.id, siteId: null, strategy: "project-only" };
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

    // A resposta pode ser um array direto ou um objeto com itens/items
    const items = Array.isArray(data) ? data : (data.itens || data.items || data.content || []);

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

      // Buscar mapeamento existente, projetos e sites para vincular os lançamentos importados
      const [{ data: mapeamentos }, { data: projetos }, { data: sites }] = await Promise.all([
        supabase.from("mapeamento_categorias_erp").select("*"),
        supabase.from("projetos").select("id, codigo, nome"),
        supabase.from("sites").select("id, codigo, nome, projeto_id"),
      ]);

      const mapCategorias = new Map(mapeamentos?.map((m: any) => [m.categoria_erp, m.categoria_interna]));

      const projetosLookup: ProjetoLookup[] = (projetos || []).map((projeto: any) => ({
        ...projeto,
        normalizedCode: normalizeText(projeto.codigo),
        normalizedName: normalizeText(projeto.nome),
      }));

      const sitesLookup: SiteLookup[] = (sites || []).map((site: any) => ({
        ...site,
        normalizedCode: normalizeText(site.codigo),
        normalizedName: normalizeText(site.nome),
      }));

      const sitesByProjeto = new Map<string, SiteLookup[]>();
      for (const site of sitesLookup) {
        const current = sitesByProjeto.get(site.projeto_id) || [];
        current.push(site);
        sitesByProjeto.set(site.projeto_id, current);
      }

      const projetosByCode = new Map<string, ProjetoLookup>();
      for (const projeto of projetosLookup) {
        if (projeto.normalizedCode) {
          projetosByCode.set(projeto.normalizedCode, projeto);
        }
      }

      const matchStats: Record<string, number> = {
        "site-direct": 0,
        "project-site": 0,
        "project-single-site": 0,
        "project-only": 0,
        unmatched: 0,
        none: 0,
      };

      // Collect new category mappings to insert in batch
      const newCategorias: { categoria_erp: string; categoria_interna: string; criado_por_ia: boolean }[] = [];

      const records = bills.map((bill: any, idx: number) => {
        const erpId = bill.id || `CA-${idx}`;
        const descricao = bill.descricao || "Sem descrição";
        const valor = Number(bill.total || bill.nao_pago || 0);
        const categorias = bill.categorias || [];
        const categoriaErp = categorias.length > 0 ? categorias[0].nome : "Outros";
        const centrosCusto = bill.centros_de_custo || [];
        const centroCusto = centrosCusto.length > 0 ? centrosCusto[0].nome : null;
        const dataPagamento = bill.data_vencimento || null;
        const dataCompetencia = bill.data_competencia || bill.data_vencimento || startDateStr;
        const statusErp = (bill.status_traduzido || bill.status || "PENDENTE").toUpperCase();

        let categoriaInterna = mapCategorias.get(categoriaErp);
        if (!categoriaInterna) {
          categoriaInterna = categorizarDespesa(categoriaErp, descricao);
          newCategorias.push({ categoria_erp: categoriaErp, categoria_interna: categoriaInterna, criado_por_ia: true });
          mapCategorias.set(categoriaErp, categoriaInterna);
        }

        const { projetoId, siteId, strategy } = resolveProjetoESite(
          centroCusto, projetosLookup, sitesLookup, sitesByProjeto, projetosByCode,
        );
        matchStats[strategy] = (matchStats[strategy] || 0) + 1;

        const statusNormalizado = ["QUITADO", "RECEBIDO"].includes(statusErp) ? "pago" : "pendente";

        return {
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
        };
      });

      // Batch insert new category mappings
      if (newCategorias.length > 0) {
        await supabase.from("mapeamento_categorias_erp").upsert(newCategorias, { onConflict: "categoria_erp" }).then(() => {});
      }

      // Batch upsert records in chunks of 500
      const CHUNK_SIZE = 500;
      let processadas = 0;
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        const { error: upsertError } = await supabase.from("custo_real_erp").upsert(chunk, { onConflict: "erp_id" });
        if (upsertError) {
          console.error(`Erro upsert chunk ${i}:`, upsertError.message);
        }
        processadas += chunk.length;
      }

      console.log("Resumo de vínculo projeto/site:", matchStats);

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
