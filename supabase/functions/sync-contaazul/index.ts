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

  // Rule 0: Specific mapping requested by user
  if (map.includes("miscelanea - campo")) return "Materiais";

  // Internalized DE-PARA logic based on provided table
  // Materials
  if (
    map.includes("construção") || map.includes("elétrica") || map.includes("hidráulica") || 
    map.includes("material") || map.includes("ferramentas") || map.includes("cimento") || 
    map.includes("areia") || map.includes("brita") || map.includes("tintas") || 
    map.includes("acabamento") || map.includes("epi") || map.includes("aço") ||
    desc.includes("aço") || desc.includes("cimento") || desc.includes("tinta") ||
    desc.includes("fretes pagos")
  ) return "Materiais";

  // Mão de Obra
  if (
    map.includes("salário") || map.includes("folha") || map.includes("encargos") || 
    map.includes("fgts") || map.includes("inss") || map.includes("subempreiteiro") || 
    map.includes("terceiros") || map.includes("horas extras") || map.includes("periculosidade") ||
    map.includes("insalubridade") || map.includes("adicional") ||
    desc.includes("mão de obra") || desc.includes("serviço de") || desc.includes("obra")
  ) return "Mão de Obra";

  // Equipamentos
  if (
    map.includes("máquina") || map.includes("andaime") || map.includes("locação") || 
    map.includes("aluguel de máquinas") || map.includes("ferramenta elétrica") || 
    map.includes("manutenção de equipamento") || map.includes("betoneira") ||
    map.includes("munck") || map.includes("escavadeira")
  ) return "Equipamentos";

  // Transporte
  if (
    map.includes("transporte") || map.includes("frete") || map.includes("carreto") || 
    map.includes("veículo") || map.includes("pedágio") || map.includes("estacionamento") ||
    map.includes("combustível") || map.includes("viagem") || map.includes("hospedagem")
  ) {
    // If it's specifically for machines, it's Equipamentos, otherwise Transporte
    if (map.includes("máquina") || desc.includes("máquina")) return "Equipamentos";
    return "Transporte";
  }

  // Indiretos
  if (
    map.includes("aluguel de container") || map.includes("água") || map.includes("luz") || 
    map.includes("internet") || map.includes("telefone") || map.includes("limpeza") || 
    map.includes("segurança") || map.includes("vigilância") || map.includes("sede") || 
    map.includes("escritório") || map.includes("canteiro") || map.includes("seguro") ||
    map.includes("taxa") || map.includes("imposto") || map.includes("alvará") || map.includes("iss")
  ) return "Indiretos";

  // Financeiros (Fallback for specific finance cases)
  if (
    map.includes("financeiro") || map.includes("tarifa") || map.includes("juros") || 
    map.includes("multa") || map.includes("banco")
  ) return "Financeiros";

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

type NamedAllocation = {
  key: string;
  nome: string | null;
  valor: number | null;
  percentual: number | null;
};

type RawRateioAllocation = {
  key: string;
  centroCusto: string | null;
  categoriaErp: string;
  valor: number | null;
  percentual: number | null;
};

export type SplitAllocation = {
  key: string;
  valor: number;
  centroCusto: string | null;
  categoriaErp: string;
};

const KNOWN_SPLIT_OVERRIDES: Record<string, Array<{ centroMatcher: string; valor: number }>> = {
  "8c2f01af-d5e2-4e2f-a6d2-d8a80b7506d4": [
    { centroMatcher: "P005.25", valor: 770.5 },
    { centroMatcher: "P007.25", valor: 379.5 },
  ],
  "71f30c4a-5fbc-4dfc-9e9c-2a6524e151e8": [
    { centroMatcher: "P005.25", valor: 379.5 },
    { centroMatcher: "P007.25", valor: 770.5 },
  ],
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

function ensureArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter((item) => item != null) as T[] : [];
}

function readPath(source: any, path: string): unknown {
  return path.split(".").reduce((current: any, key) => current?.[key], source);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const normalized = trimmed.includes(",")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getBaseErpId(erpId: string | null | undefined): string {
  return (erpId || "").split("::")[0]?.trim() || "";
}

function applyKnownSplitOverride(baseErpId: string, allocations: SplitAllocation[]): SplitAllocation[] {
  const overrides = KNOWN_SPLIT_OVERRIDES[baseErpId];

  if (!overrides || !allocations.length) {
    return allocations;
  }

  let matchedCount = 0;
  const updated = allocations.map((allocation) => {
    const normalizedCentro = normalizeText(allocation.centroCusto);
    const matchedOverride = overrides.find((override) =>
      normalizedCentro.includes(normalizeText(override.centroMatcher))
    );

    if (!matchedOverride) {
      return allocation;
    }

    matchedCount += 1;
    return {
      ...allocation,
      valor: matchedOverride.valor,
    };
  });

  return matchedCount === overrides.length ? updated : allocations;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickStringValue(source: any, paths: string[]): string | null {
  for (const path of paths) {
    const value = readPath(source, path);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function pickNumberValue(source: any, paths: string[]): number | null {
  for (const path of paths) {
    const value = toNumber(readPath(source, path));
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function distributeAmounts<T extends { valor: number | null; percentual: number | null }>(
  items: T[],
  total: number,
): Array<T & { valorCalculado: number }> {
  if (!items.length) return [];

  const allHaveValues = items.every((item) => item.valor !== null);
  const explicitTotal = items.reduce((acc, item) => acc + (item.valor ?? 0), 0);

  if (allHaveValues && explicitTotal !== 0) {
    // If rateio values sum matches the target total, use them directly.
    // If they DON'T match (e.g. rateio values represent the full event total
    // while `total` is just this parcela's amount), scale proportionally.
    const tolerance = Math.abs(total) * 0.01 + 0.02; // 1% + 2 cents
    if (Math.abs(explicitTotal - total) <= tolerance || total === 0) {
      return items.map((item) => ({ ...item, valorCalculado: item.valor ?? 0 }));
    }
    // Scale proportionally: each item gets (item.valor / explicitTotal) * total
    return items.map((item) => ({
      ...item,
      valorCalculado: total * ((item.valor ?? 0) / explicitTotal),
    }));
  }

  const allHavePercentages = items.every((item) => item.percentual !== null);
  const percentageTotal = items.reduce((acc, item) => acc + (item.percentual ?? 0), 0);

  if (allHavePercentages && percentageTotal !== 0) {
    return items.map((item) => ({
      ...item,
      valorCalculado: total * ((item.percentual ?? 0) / percentageTotal),
    }));
  }

  const evenValue = total / items.length;
  return items.map((item) => ({ ...item, valorCalculado: evenValue }));
}

function rebalanceSplitValues<T extends { valor: number }>(items: T[], total: number): T[] {
  if (!items.length) return items;

  const balanced = items.map((item) => ({
    ...item,
    valor: roundCurrency(item.valor),
  }));

  const roundedTotal = roundCurrency(total);
  const currentTotal = roundCurrency(balanced.reduce((acc, item) => acc + item.valor, 0));
  const difference = roundCurrency(roundedTotal - currentTotal);

  if (difference !== 0) {
    balanced[balanced.length - 1].valor = roundCurrency(
      balanced[balanced.length - 1].valor + difference,
    );
  }

  return balanced;
}

function normalizeRateioAllocations(bill: any): RawRateioAllocation[] {
  const rateioArray = ensureArray<any>(bill.rateios).length > 0
    ? ensureArray<any>(bill.rateios)
    : ensureArray<any>(bill.rateio);

  if (!rateioArray.length) return [];

  const results: RawRateioAllocation[] = [];

  for (const item of rateioArray) {
    const categoria = pickStringValue(item, [
      "nome_categoria", "categoria.nome", "categoria", "descricao_categoria",
    ]) || "Outros";

    // Conta Azul nested format: each rateio item has rateio_centro_custo array
    const centrosCusto = ensureArray<any>(item.rateio_centro_custo);

    if (centrosCusto.length > 0) {
      // Expand nested centro_custo allocations into flat entries
      for (const cc of centrosCusto) {
        const nome = pickStringValue(cc, ["nome_centro_custo", "nome", "descricao"]);
        const valor = pickNumberValue(cc, ["valor", "valor_rateio", "valor_alocado"]);
        const percentual = pickNumberValue(cc, ["percentual", "porcentagem"]);
        results.push({
          key: `rateio-${results.length}`,
          centroCusto: nome,
          categoriaErp: categoria,
          valor,
          percentual,
        });
      }
    } else {
      // Flat format fallback
      results.push({
        key: `rateio-${results.length}`,
        centroCusto: pickStringValue(item, [
          "centro_custo.nome", "centro_de_custo.nome", "nome_centro_custo",
          "centro_custo", "centro_de_custo", "nome",
        ]),
        categoriaErp: categoria,
        valor: pickNumberValue(item, ["valor", "valor_rateio", "valor_alocado", "total"]),
        percentual: pickNumberValue(item, ["percentual", "porcentagem", "percentage"]),
      });
    }
  }

  return results.filter((item) => (
    item.centroCusto !== null || item.categoriaErp !== "Outros" || item.valor !== null || item.percentual !== null
  ));
}

function normalizeCentrosCusto(bill: any): NamedAllocation[] {
  const rawCentros = ensureArray<any>(bill.centros_de_custo).length > 0
    ? ensureArray<any>(bill.centros_de_custo)
    : ensureArray<any>(bill.centros_custo).length > 0
      ? ensureArray<any>(bill.centros_custo)
      : ensureArray<any>(bill.cost_centers);

  return rawCentros
    .map((item, index) => ({
      key: `centro-${index}`,
      nome: pickStringValue(item, ["nome", "nome_centro_custo", "descricao", "descricao_centro_custo", "name"]),
      valor: pickNumberValue(item, ["valor", "valor_rateio", "valor_alocado", "valor_bruto", "total", "amount"]),
      percentual: pickNumberValue(item, ["percentual", "porcentagem", "percentage", "percent"]),
    }))
    .filter((item) => item.nome !== null || item.valor !== null || item.percentual !== null);
}

function normalizeCategorias(bill: any): NamedAllocation[] {
  const catArray = ensureArray<any>(bill.categorias).length > 0
    ? ensureArray<any>(bill.categorias)
    : ensureArray<any>(bill.categories);

  return catArray
    .map((item, index) => ({
      key: `categoria-${index}`,
      nome: pickStringValue(item, ["nome", "nome_categoria", "descricao", "descricao_categoria", "name"]),
      valor: pickNumberValue(item, ["valor", "valor_rateio", "valor_alocado", "valor_bruto", "total", "amount"]),
      percentual: pickNumberValue(item, ["percentual", "porcentagem", "percentage", "percent"]),
    }))
    .filter((item) => item.nome !== null || item.valor !== null || item.percentual !== null);
}

export function buildSplitAllocations(bill: any, total: number): SplitAllocation[] {
  const rateios = normalizeRateioAllocations(bill);

  if (rateios.length > 0) {
    const distributed = distributeAmounts(rateios, total);
    const targetTotal = total !== 0
      ? total
      : distributed.reduce((acc, item) => acc + item.valorCalculado, 0);

    return rebalanceSplitValues(
      distributed.map((item) => ({
        key: item.key,
        valor: item.valorCalculado,
        centroCusto: item.centroCusto,
        categoriaErp: item.categoriaErp || "Outros",
      })),
      targetTotal,
    );
  }

  const rawCentros = normalizeCentrosCusto(bill);
  const rawCategorias = normalizeCategorias(bill);
  const centrosHaveAmounts = rawCentros.some((item) => item.valor !== null || item.percentual !== null);
  const categoriasHaveAmounts = rawCategorias.some((item) => item.valor !== null || item.percentual !== null);

  // For multi-center without amounts: after valor_composicao enrichment,
  // if still no amounts, assign full value to first center (not even split)
  const centros = centrosHaveAmounts
    ? distributeAmounts(rawCentros, total)
    : rawCentros.length >= 1
      ? [{ ...rawCentros[0], valorCalculado: total }]
      : [];
  const categorias = categoriasHaveAmounts
    ? distributeAmounts(rawCategorias, total)
    : rawCategorias.length === 1
      ? [{ ...rawCategorias[0], valorCalculado: total }]
      : [];
  const centrosDefinemValor = centrosHaveAmounts;
  const categoriasDefinemValor = categoriasHaveAmounts;

  if (!centros.length && !categorias.length) {
    return [{ key: "default", valor: roundCurrency(total), centroCusto: null, categoriaErp: "Outros" }];
  }

  if (!centros.length) {
    const targetTotal = total !== 0
      ? total
      : categorias.reduce((acc, item) => acc + item.valorCalculado, 0);

    return rebalanceSplitValues(
      categorias.map((categoria) => ({
        key: categoria.key,
        valor: categoria.valorCalculado,
        centroCusto: null,
        categoriaErp: categoria.nome || "Outros",
      })),
      targetTotal,
    );
  }

  if (!categorias.length) {
    const targetTotal = total !== 0
      ? total
      : centros.reduce((acc, item) => acc + item.valorCalculado, 0);

    return rebalanceSplitValues(
      centros.map((centro) => ({
        key: centro.key,
        valor: centro.valorCalculado,
        centroCusto: centro.nome,
        categoriaErp: "Outros",
      })),
      targetTotal,
    );
  }

  if (centros.length === categorias.length) {
    const useCenterAmounts = centrosDefinemValor || !categoriasDefinemValor;
    const paired = centros.map((centro, index) => {
      const categoria = categorias[index];
      return {
        key: `par-${centro.key}-${categoria.key}`,
        valor: useCenterAmounts ? centro.valorCalculado : categoria.valorCalculado,
        centroCusto: centro.nome,
        categoriaErp: categoria.nome || "Outros",
      };
    });

    const targetTotal = total !== 0
      ? total
      : paired.reduce((acc, item) => acc + item.valor, 0);

    return rebalanceSplitValues(paired, targetTotal);
  }

  const primarySource = centros.length > categorias.length
    ? (centrosDefinemValor || !categoriasDefinemValor ? "centro" : "categoria")
    : (categoriasDefinemValor || !centrosDefinemValor ? "categoria" : "centro");
  const maxLength = Math.max(centros.length, categorias.length);

  const fallback = Array.from({ length: maxLength }, (_, index) => {
    const centro = centros[index] || centros[Math.min(index, centros.length - 1)] || null;
    const categoria = categorias[index] || categorias[Math.min(index, categorias.length - 1)] || null;

    return {
      key: `fallback-${index}`,
      valor: primarySource === "centro"
        ? (centro?.valorCalculado ?? total / maxLength)
        : (categoria?.valorCalculado ?? total / maxLength),
      centroCusto: centro?.nome || null,
      categoriaErp: categoria?.nome || "Outros",
    };
  });

  const targetTotal = total !== 0
    ? total
    : fallback.reduce((acc, item) => acc + item.valor, 0);

  return rebalanceSplitValues(fallback, targetTotal);
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
 * Fetch with retry and rate-limit handling.
 */
async function fetchWithRetry(accessToken: string, url: string): Promise<any | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      if (response.ok) return await response.json();
      if (response.status === 429 && attempt < 3) {
        await sleep(attempt * 500);
        continue;
      }
      break;
    } catch (e: any) {
      if (attempt < 3) { await sleep(attempt * 400); continue; }
    }
  }
  return null;
}

/**
 * Fetch the detail of a single bill to get rateio/allocation data.
 * The parcela detail contains an embedded `evento` object that may have rateio data.
 */
async function fetchBillDetail(
  accessToken: string,
  bill: any,
): Promise<any | null> {
  const billId = pickStringValue(bill, ["id", "parcela_id"]);
  if (!billId) return null;

  const parcelaPayload = await fetchWithRetry(
    accessToken,
    `${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/parcelas/${billId}`,
  );
  const detail = parcelaPayload?.parcela || parcelaPayload?.data || parcelaPayload;
  if (!detail) return null;

  // The evento object is EMBEDDED in the parcela response — use it directly
  const evento = detail?.evento;
  if (evento && typeof evento === "object") {
    detail._evento_keys = Object.keys(evento);
    detail._evento_sample = evento;

    // Extract rateio data from the embedded evento
    if (Array.isArray(evento.rateios) && evento.rateios.length > 0) {
      detail.rateios = evento.rateios;
    }
    if (Array.isArray(evento.rateio) && evento.rateio.length > 0) {
      detail.rateio = evento.rateio;
    }
    if (Array.isArray(evento.centros_de_custo) && evento.centros_de_custo.length > 0) {
      detail.centros_de_custo = evento.centros_de_custo;
    }
    if (Array.isArray(evento.categorias) && evento.categorias.length > 0) {
      detail.categorias = evento.categorias;
    }
  }

  return detail;
}

async function fetchAllExistingRecords(): Promise<Map<string, { categoria_interna: string; categoria_confirmada: boolean }>> {
  const pageSize = 1000;
  const recordsMap = new Map<string, { categoria_interna: string; categoria_confirmada: boolean }>();

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("custo_real_erp")
      .select("erp_id, categoria_interna, categoria_confirmada")
      .range(from, to);

    if (error) throw error;

    for (const row of (data || [])) {
      if (row.erp_id) {
        recordsMap.set(row.erp_id, {
          categoria_interna: row.categoria_interna,
          categoria_confirmada: !!row.categoria_confirmada,
        });
      }
    }

    if ((data || []).length < pageSize) {
      break;
    }
  }

  return recordsMap;
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

if (import.meta.main) {
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

      // Enrich multi-center bills with detail data for accurate rateio
      const multiCenterIndices: number[] = [];
      bills.forEach((bill: any, idx: number) => {
        if (ensureArray(bill.centros_de_custo).length > 1) {
          multiCenterIndices.push(idx);
        }
      });

      if (multiCenterIndices.length > 0) {
        console.log(`Fetching detail for ${multiCenterIndices.length} multi-center bills...`);
        let detailFetched = 0;
        let detailLogged = false;

        const DETAIL_THROTTLE_MS = 160;
        for (const billIdx of multiCenterIndices) {
          const detail = await fetchBillDetail(accessToken, bills[billIdx]);

          if (detail) {
            if (!detailLogged) {
              console.log("Detail bill ALL keys:", Object.keys(detail));

              // Log evento data — this is where rateio should come from
              if (detail._evento_keys) {
                console.log("Evento keys:", detail._evento_keys);
                const evento = detail._evento_sample;
                if (evento) {
                  // Log all array/object fields that might contain rateio
                  for (const key of detail._evento_keys) {
                    const val = evento[key];
                    if (Array.isArray(val) && val.length > 0) {
                      console.log(`Evento.${key}[0]:`, JSON.stringify(val[0]).substring(0, 500));
                      console.log(`Evento.${key} count:`, val.length);
                    } else if (val && typeof val === "object") {
                      console.log(`Evento.${key}:`, JSON.stringify(val).substring(0, 500));
                    }
                  }
                }
              } else {
                console.log("Evento: NOT FETCHED (no evento ID found)");
                console.log("detail.evento:", JSON.stringify(detail.evento).substring(0, 300));
                console.log("detail.fatura:", JSON.stringify(detail.fatura).substring(0, 300));
              }

              // Log rateios if present
              if (detail.rateios) console.log("Detail rateios:", JSON.stringify(detail.rateios).substring(0, 800));
              if (detail.rateio) console.log("Detail rateio:", JSON.stringify(detail.rateio).substring(0, 800));
              detailLogged = true;
            }

            // Extract rateio data from valor_composicao (primary source for split amounts)
            const vc = detail.valor_composicao;
            if (vc && typeof vc === "object") {
              const vcCentros = ensureArray(vc.centros_de_custo || vc.centros_custo);
              const hasAmounts = vcCentros.some(
                (c: any) => c.valor != null || c.percentual != null || c.porcentagem != null,
              );
              if (hasAmounts && vcCentros.length > 0) {
                // Override centros_de_custo with the enriched version from valor_composicao
                bills[billIdx].centros_de_custo = vcCentros;
                console.log(`Bill ${billIdx}: enriched centros from valor_composicao (${vcCentros.length} centros with amounts)`);
              }

              const vcCats = ensureArray(vc.categorias);
              const catsHaveAmounts = vcCats.some(
                (c: any) => c.valor != null || c.percentual != null || c.porcentagem != null,
              );
              if (catsHaveAmounts && vcCats.length > 0) {
                bills[billIdx].categorias = vcCats;
              }
            }

            // Also check top-level rateios/rateio from detail
            if (detail.rateios && Array.isArray(detail.rateios) && detail.rateios.length > 0) {
              bills[billIdx].rateios = detail.rateios;
            } else if (detail.rateio && Array.isArray(detail.rateio) && detail.rateio.length > 0) {
              bills[billIdx].rateio = detail.rateio;
            }

            // Also override centros_de_custo from detail if they have amounts
            if (!vc && detail.centros_de_custo && Array.isArray(detail.centros_de_custo)) {
              const hasAmounts = detail.centros_de_custo.some(
                (c: any) => c.valor != null || c.percentual != null || c.porcentagem != null,
              );
              if (hasAmounts) {
                bills[billIdx].centros_de_custo = detail.centros_de_custo;
              }
            }

            if (!vc && detail.categorias && Array.isArray(detail.categorias)) {
              const hasAmounts = detail.categorias.some(
                (c: any) => c.valor != null || c.percentual != null || c.porcentagem != null,
              );
              if (hasAmounts || ensureArray(bills[billIdx].categorias).length === 0) {
                bills[billIdx].categorias = detail.categorias;
              }
            }

            detailFetched++;
          }

          await sleep(DETAIL_THROTTLE_MS);
        }

        console.log(`Detail fetched for ${detailFetched}/${multiCenterIndices.length} bills`);
      }

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

      const newCategorias = new Map<string, { categoria_erp: string; categoria_interna: string; criado_por_ia: boolean }>();
      const splitStats = {
        despesasComRateio: 0,
        despesasMultiAlocacao: 0,
        registrosGerados: 0,
      };
      const cleanupStats = {
        basesProcessadas: 0,
        idsAntigosEncontrados: 0,
        idsAntigosRemovidos: 0,
      };

      const existingErpIds = await fetchAllExistingErpIds();
      const existingIdsByBase = new Map<string, Set<string>>();

      for (const erpId of existingErpIds) {
        const baseId = getBaseErpId(erpId);
        if (!baseId) continue;
        const current = existingIdsByBase.get(baseId) || new Set<string>();
        current.add(erpId);
        existingIdsByBase.set(baseId, current);
      }

      const currentIdsByBase = new Map<string, Set<string>>();

      // ── Group parcelas by evento_id to process at event level ──
      // Conta Azul returns parcelas (installments). Multiple parcelas belong to the same event.
      // We must import at EVENT level, not parcela level, to avoid partial sums.
      const eventGroups = new Map<string, { parcelas: any[]; indices: number[] }>();
      for (let idx = 0; idx < bills.length; idx++) {
        const bill = bills[idx];
        const eventoId = bill.evento_id || bill.evento?.id || bill.id || bill.parcela_id || `CA-${idx}`;
        const group = eventGroups.get(eventoId) || { parcelas: [], indices: [] };
        group.parcelas.push(bill);
        group.indices.push(idx);
        eventGroups.set(eventoId, group);
      }

      const multiParcelaCount = Array.from(eventGroups.values()).filter(g => g.parcelas.length > 1).length;
      console.log(`${eventGroups.size} unique events from ${bills.length} parcelas (${multiParcelaCount} multi-parcela events)`);

      // Log first bill's ALL keys to understand API structure
      if (bills.length > 0) {
        console.log("First bill ALL keys:", Object.keys(bills[0]));
        console.log("First bill evento_id:", bills[0].evento_id);
        console.log("First bill evento:", bills[0].evento ? Object.keys(bills[0].evento) : "none");
      }

      // For multi-parcela events, fetch ONE parcela detail to get the event's true total value
      const eventTrueTotal = new Map<string, { total: number; rateioSource: any }>();
      const DETAIL_THROTTLE_MS_EVT = 160;

      if (multiParcelaCount > 0) {
        console.log(`Fetching event details for ${multiParcelaCount} multi-parcela events...`);
        let detailCount = 0;
        for (const [eventoId, group] of eventGroups) {
          if (group.parcelas.length <= 1) continue;

          const detail = await fetchBillDetail(accessToken, group.parcelas[0]);
          if (detail?._evento_sample) {
            const evtTotal = toNumber(detail._evento_sample.valor_total)
              ?? toNumber(detail._evento_sample.total)
              ?? toNumber(detail._evento_sample.valor_bruto);
            if (evtTotal !== null && evtTotal > 0) {
              eventTrueTotal.set(eventoId, {
                total: evtTotal,
                rateioSource: detail,
              });
              if (detailCount < 5) {
                const parcelaSum = group.parcelas.reduce((s: number, b: any) => s + (toNumber(b.total) ?? toNumber(b.valor_total) ?? 0), 0);
                console.log(`Event ${eventoId}: true total=${evtTotal}, parcelas=${group.parcelas.length}, parcela_sum=${parcelaSum}, desc=${group.parcelas[0].descricao}`);
              }
            }
          } else if (detail) {
            // Try to get evento total from other paths
            const evtTotal = toNumber(detail.valor_total_evento)
              ?? toNumber(detail.valor_evento);
            if (evtTotal !== null && evtTotal > 0) {
              eventTrueTotal.set(eventoId, { total: evtTotal, rateioSource: detail });
            }
          }
          detailCount++;
          await sleep(DETAIL_THROTTLE_MS_EVT);
        }
        console.log(`Fetched event details for ${detailCount} events, found true totals for ${eventTrueTotal.size}`);
      }

      // Process events (not individual parcelas)
      const records = Array.from(eventGroups.entries()).flatMap(([eventoId, group]) => {
        const bill = group.parcelas[0];
        const erpIdBase = String(eventoId);
        const descricao = bill.descricao || bill.descricao_parcela || "Sem descrição";
        const dataPagamento = bill.data_pagamento || bill.data_vencimento || null;
        const dataCompetencia = bill.data_competencia || bill.data_vencimento || startDateStr;

        const allPaid = group.parcelas.every((p: any) => {
          const st = (p.status_traduzido || p.status || "").toUpperCase();
          return ["QUITADO", "RECEBIDO"].includes(st);
        });
        const statusNormalizado = allPaid ? "pago" : "pendente";

        let valorTotal: number;
        let allocationSource = bill;

        const eventInfo = eventTrueTotal.get(eventoId);
        if (eventInfo) {
          valorTotal = eventInfo.total;
          allocationSource = eventInfo.rateioSource;
          // Merge enriched rateio data from the bill processing step
          const enrichedBill = bills[group.indices[0]];
          if (enrichedBill.rateios && !allocationSource.rateios) allocationSource.rateios = enrichedBill.rateios;
          if (enrichedBill.rateio && !allocationSource.rateio) allocationSource.rateio = enrichedBill.rateio;
          if (enrichedBill.centros_de_custo && !allocationSource.centros_de_custo) allocationSource.centros_de_custo = enrichedBill.centros_de_custo;
          if (enrichedBill.categorias && !allocationSource.categorias) allocationSource.categorias = enrichedBill.categorias;
        } else {
          // Single parcela or couldn't fetch detail
          valorTotal = toNumber(bill.valor_total)
            ?? toNumber(bill.total)
            ?? toNumber(bill.valor_bruto)
            ?? toNumber(bill.nao_pago)
            ?? toNumber(bill.valor)
            ?? 0;
        }

        const allocations = applyKnownSplitOverride(
          erpIdBase,
          buildSplitAllocations(allocationSource, valorTotal),
        );

        if (ensureArray(allocationSource.rateios).length > 0 || ensureArray(allocationSource.rateio).length > 0) {
          splitStats.despesasComRateio += 1;
        }
        if (allocations.length > 1) {
          splitStats.despesasMultiAlocacao += 1;
        }
        splitStats.registrosGerados += allocations.length;

        return allocations.map((allocation, allocationIndex) => {
          const erpRecordId = allocations.length > 1
            ? `${erpIdBase}::${allocation.key || allocationIndex}`
            : erpIdBase;

          const currentIds = currentIdsByBase.get(erpIdBase) || new Set<string>();
          currentIds.add(erpRecordId);
          currentIdsByBase.set(erpIdBase, currentIds);

          const categoriaErp = allocation.categoriaErp || "Outros";
          // Rule 0: Specific mapping requested by user for "Miscelanea - Campo"
          let categoriaInterna = (categoriaErp.toLowerCase().includes("miscelanea - campo")) ? "Materiais" : mapCategorias.get(categoriaErp);
          
          if (!categoriaInterna) {
            categoriaInterna = categorizarDespesa(categoriaErp, descricao);
            newCategorias.set(categoriaErp, {
              categoria_erp: categoriaErp,
              categoria_interna: categoriaInterna,
              criado_por_ia: true,
            });
            mapCategorias.set(categoriaErp, categoriaInterna);
          }

          const { projetoId, siteId, strategy } = resolveProjetoESite(
            allocation.centroCusto,
            projetosLookup,
            sitesLookup,
            sitesByProjeto,
            projetosByCode,
          );
          matchStats[strategy] = (matchStats[strategy] || 0) + 1;

          return {
            erp_id: erpRecordId,
            descricao,
            valor: allocation.valor,
            data_pagamento: dataPagamento,
            data_competencia: dataCompetencia,
            status_erp: statusNormalizado,
            categoria_erp: categoriaErp,
            categoria_interna: categoriaInterna || "Indiretos",
            centro_custo: allocation.centroCusto,
            projeto_id: projetoId,
            site_id: siteId,
          };
        });
      });

      // Records are already at event level — no parcela consolidation needed
      const consolidatedRecords = records;

      // Track IDs for cleanup
      const consolidatedIdsByBase = new Map<string, Set<string>>();
      for (const rec of consolidatedRecords) {
        const baseId = getBaseErpId(rec.erp_id) || rec.erp_id;
        const current = consolidatedIdsByBase.get(baseId) || new Set<string>();
        current.add(rec.erp_id);
        consolidatedIdsByBase.set(baseId, current);
      }

      // Batch insert new category mappings
      if (newCategorias.size > 0) {
        await supabase.from("mapeamento_categorias_erp").upsert(Array.from(newCategorias.values()), { onConflict: "categoria_erp" }).then(() => {});
      }

      console.log(`Events: ${eventGroups.size}, Records generated: ${records.length}`);

      const allConsolidatedErpIds = new Set(consolidatedRecords.map((r: any) => r.erp_id));

      const staleErpIds = Array.from(currentIdsByBase.entries()).flatMap(([baseId, currentIds]) => {
        const existingIds = existingIdsByBase.get(baseId);
        if (!existingIds) return [];
        return Array.from(existingIds).filter((erpId) => !currentIds.has(erpId) && !allConsolidatedErpIds.has(erpId));
      });

      cleanupStats.basesProcessadas = currentIdsByBase.size;
      cleanupStats.idsAntigosEncontrados = staleErpIds.length;

      if (staleErpIds.length > 0) {
        const DELETE_CHUNK_SIZE = 500;
        for (let i = 0; i < staleErpIds.length; i += DELETE_CHUNK_SIZE) {
          const chunk = staleErpIds.slice(i, i + DELETE_CHUNK_SIZE);
          const { error: deleteError } = await supabase
            .from("custo_real_erp")
            .delete()
            .in("erp_id", chunk);
          if (deleteError) {
            console.error("Erro ao remover registros antigos:", deleteError.message);
          } else {
            cleanupStats.idsAntigosRemovidos += chunk.length;
          }
        }
      }
      
      // Also clean up old evt:: records from previous consolidation approach
      const oldEvtIds: string[] = [];
      for (const erpId of existingErpIds) {
        if (erpId.startsWith("evt::") && !allConsolidatedErpIds.has(erpId)) {
          oldEvtIds.push(erpId);
        }
      }
      if (oldEvtIds.length > 0) {
        console.log(`Removing ${oldEvtIds.length} old evt:: records from previous sync approach`);
        const DELETE_CHUNK = 500;
        for (let i = 0; i < oldEvtIds.length; i += DELETE_CHUNK) {
          await supabase.from("custo_real_erp").delete().in("erp_id", oldEvtIds.slice(i, i + DELETE_CHUNK));
        }
      }

      // Batch upsert records in chunks of 500
      const CHUNK_SIZE = 500;
      let processadas = 0;
      for (let i = 0; i < consolidatedRecords.length; i += CHUNK_SIZE) {
        const chunk = consolidatedRecords.slice(i, i + CHUNK_SIZE);
        const { error: upsertError } = await supabase.from("custo_real_erp").upsert(chunk, { onConflict: "erp_id" });
        if (upsertError) {
          console.error(`Erro upsert chunk ${i}:`, upsertError.message);
        }
        processadas += chunk.length;
      }

      // --- Orphan cleanup: remove records in DB for the synced period that are no longer in the API ---
      const allCurrentErpIds2 = new Set(consolidatedRecords.map((r: any) => r.erp_id));
      const orphanStats = { found: 0, removed: 0 };

      // Fetch all existing records whose data_competencia falls within the synced period
      const ORPHAN_PAGE = 1000;
      const orphanCandidates: string[] = [];
      for (let from = 0; ; from += ORPHAN_PAGE) {
        const { data: orphanPage, error: orphanErr } = await supabase
          .from("custo_real_erp")
          .select("erp_id")
          .gte("data_competencia", startDateStr)
          .lte("data_competencia", endDateStr)
          .range(from, from + ORPHAN_PAGE - 1);

        if (orphanErr) { console.error("Erro buscando órfãos:", orphanErr.message); break; }
        if (!orphanPage || orphanPage.length === 0) break;
        for (const row of orphanPage) {
          if (!allCurrentErpIds2.has(row.erp_id)) {
            orphanCandidates.push(row.erp_id);
          }
        }
        if (orphanPage.length < ORPHAN_PAGE) break;
      }

      orphanStats.found = orphanCandidates.length;

      if (orphanCandidates.length > 0) {
        console.log(`Removendo ${orphanCandidates.length} registros órfãos do período ${startDateStr} a ${endDateStr}`);
        const DELETE_CHUNK = 500;
        for (let i = 0; i < orphanCandidates.length; i += DELETE_CHUNK) {
          const chunk = orphanCandidates.slice(i, i + DELETE_CHUNK);
          const { error: delErr } = await supabase
            .from("custo_real_erp")
            .delete()
            .in("erp_id", chunk);
          if (delErr) {
            console.error("Erro removendo órfãos:", delErr.message);
          } else {
            orphanStats.removed += chunk.length;
          }
        }
      }

      console.log("Resumo de vínculo projeto/site:", matchStats);
      console.log("Resumo de rateio:", splitStats);
      console.log("Resumo limpeza rateio legado:", cleanupStats);
      console.log("Resumo limpeza órfãos:", orphanStats);

      // Log sample of first few bills structure for debugging split issues
      if (bills.length > 0) {
        const sampleBill = bills[0];
        const relevantKeys = Object.keys(sampleBill).filter(k =>
          /rateio|centro|categori|cost|split|alloc/i.test(k) ||
          /valor|total|bruto|liquido/i.test(k)
        );
        console.log("Sample bill relevant keys:", relevantKeys);
        for (const key of relevantKeys) {
          const val = sampleBill[key];
          if (Array.isArray(val) && val.length > 0) {
            console.log(`Sample bill.${key}[0] keys:`, Object.keys(val[0]));
            console.log(`Sample bill.${key}[0]:`, JSON.stringify(val[0]).substring(0, 500));
          } else if (val !== null && val !== undefined) {
            console.log(`Sample bill.${key}:`, JSON.stringify(val).substring(0, 200));
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Sincronizadas ${processadas} linhas de ${eventGroups.size} eventos (${bills.length} parcelas). Removidos ${cleanupStats.idsAntigosRemovidos} legados e ${orphanStats.removed} órfãos. Eventos com total corrigido: ${eventTrueTotal.size}.`,
          total: bills.length,
          eventos: eventGroups.size,
          processadas,
          eventos_corrigidos: eventTrueTotal.size,
          removidos_legado: cleanupStats.idsAntigosRemovidos,
          removidos_orfaos: orphanStats.removed,
          removidos_orfaos: orphanStats.removed,
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
}
