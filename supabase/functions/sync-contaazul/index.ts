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

  if (expiresAt > new Date(now.getTime() + 120000)) {
    return tokenData.access_token;
  }

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

/**
 * Fetch parcelas from the Conta Azul API using a specific date filter strategy.
 * The API requires data_vencimento_de/ate, but we can also add optional filters
 * for data_competencia and data_pagamento.
 */
async function fetchParcelas(
  accessToken: string,
  params: Record<string, string>,
  label: string,
): Promise<any[]> {
  const allItems: any[] = [];
  let page = 1;
  const pageSize = 1000; // max allowed by API

  while (true) {
    const queryParams = new URLSearchParams({
      ...params,
      pagina: String(page),
      tamanho_pagina: String(pageSize),
    });

    const url = `${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?${queryParams.toString()}`;
    console.log(`[${label}] Buscando page ${page}:`, url);

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[${label}] Erro page ${page}:`, response.status, errBody);

      if (response.status === 401) {
        throw new Error("Token expirado ou inválido. Tente reconectar o Conta Azul.");
      }
      break;
    }

    const data = await response.json();
    console.log(`[${label}] Page ${page} response: itens_totais=${data.itens_totais}, received=${(data.itens || []).length}`);

    // API returns { itens_totais, itens, totais }
    const items = Array.isArray(data) ? data : (data.itens || data.items || data.content || []);

    if (!Array.isArray(items) || items.length === 0) break;

    allItems.push(...items);

    // Check if we have all items
    if (data.itens_totais && allItems.length >= data.itens_totais) break;
    if (items.length < pageSize) break;
    page++;
  }

  console.log(`[${label}] Total fetched: ${allItems.length}`);
  return allItems;
}

/**
 * Fetch all parcelas for a period using multiple date filter strategies
 * to ensure we catch entries regardless of which date falls in the period.
 * This is critical for credit card transactions where:
 * - data_competencia = transaction date (e.g. Oct 15)
 * - data_vencimento = card bill due date (e.g. Nov 10)
 * - data_pagamento = actual payment date (e.g. Nov 10)
 */
async function fetchAllDespesas(
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<any[]> {
  // Wide date range for vencimento when filtering by other dates
  // Go 3 months before and after to catch card bills
  const start = new Date(startDate);
  const end = new Date(endDate);
  const wideStart = new Date(start);
  wideStart.setMonth(wideStart.getMonth() - 3);
  const wideEnd = new Date(end);
  wideEnd.setMonth(wideEnd.getMonth() + 3);
  const wideStartStr = wideStart.toISOString().split("T")[0];
  const wideEndStr = wideEnd.toISOString().split("T")[0];

  // Strategy 1: Filter by vencimento date in the target period (original approach)
  const byVencimento = await fetchParcelas(accessToken, {
    data_vencimento_de: startDate,
    data_vencimento_ate: endDate,
  }, "vencimento");

  // Strategy 2: Filter by competencia date in the target period
  // with a wide vencimento range to satisfy the required param
  const byCompetencia = await fetchParcelas(accessToken, {
    data_vencimento_de: wideStartStr,
    data_vencimento_ate: wideEndStr,
    data_competencia_de: startDate,
    data_competencia_ate: endDate,
  }, "competencia");

  // Strategy 3: Filter by payment date in the target period
  const byPagamento = await fetchParcelas(accessToken, {
    data_vencimento_de: wideStartStr,
    data_vencimento_ate: wideEndStr,
    data_pagamento_de: startDate,
    data_pagamento_ate: endDate,
  }, "pagamento");

  // Deduplicate by ID
  const seen = new Map<string, any>();
  for (const item of [...byVencimento, ...byCompetencia, ...byPagamento]) {
    const id = item.id || item.parcela_id;
    if (id && !seen.has(id)) {
      seen.set(id, item);
    }
  }

  const merged = Array.from(seen.values());
  console.log(`Merged results: vencimento=${byVencimento.length}, competencia=${byCompetencia.length}, pagamento=${byPagamento.length} → deduplicated=${merged.length}`);

  return merged;
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

      const accessToken = await getValidAccessToken(empresa_id);

      const now = new Date();
      const startDateStr = start_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const endDateStr = end_date || `${endMonth.getFullYear()}-${String(endMonth.getMonth() + 1).padStart(2, "0")}-${String(endMonth.getDate()).padStart(2, "0")}`;

      console.log(`Período: ${startDateStr} a ${endDateStr}`);

      // Fetch using multiple date strategies to catch all entries
      const bills = await fetchAllDespesas(accessToken, startDateStr, endDateStr);
      console.log(`Total despesas encontradas (deduplicadas): ${bills.length}`);

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

      const newCategorias: { categoria_erp: string; categoria_interna: string; criado_por_ia: boolean }[] = [];

      const records = bills.map((bill: any, idx: number) => {
        const erpId = bill.id || bill.parcela_id || `CA-${idx}`;
        const descricao = bill.descricao || bill.descricao_parcela || "Sem descrição";
        // Try multiple value fields - parcelas may use different field names
        const valor = Number(bill.total || bill.valor_bruto || bill.nao_pago || bill.valor || 0);
        const categorias = bill.categorias || bill.rateio || [];
        const categoriaErp = categorias.length > 0 ? (categorias[0].nome || categorias[0].nome_categoria || "Outros") : "Outros";
        const centrosCusto = bill.centros_de_custo || bill.centros_custo || [];
        const centroCusto = centrosCusto.length > 0 ? (centrosCusto[0].nome || centrosCusto[0].nome_centro_custo || null) : null;
        const dataPagamento = bill.data_pagamento || bill.data_vencimento || null;
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
