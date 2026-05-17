// Flash Integration Service - Edge Function
// Provides getTransactions(startDate, endDate) with pagination,
// raw storage and request/response/status logging.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ====== CONFIG ======
// Flash API oficial - https://docs.api.flashapp.services
// Autenticação: header `x-flash-auth: <chave_api>`
// Endpoints reais (descobertos via OpenAPI da doc):
//   GET /core/v1/companies         -> lista empresas
//   GET /core/v1/companies/{id}    -> detalhe
//   GET /core/v1/employees         -> lista colaboradores
//   POST /benefits/v1/orders       -> pedidos de benefícios
//   GET /expenses/v1/expenses      -> lista despesas (requer escopo específico)
const FLASH_API_BASE_URL =
  Deno.env.get("FLASH_API_BASE_URL") ?? "https://api.flashapp.services";
const FLASH_TRANSACTIONS_PATH =
  Deno.env.get("FLASH_TRANSACTIONS_PATH") ?? "/expenses/v1/expenses";
// Endpoint de centros de custo — /core/v1/cost-centers (documentado)
const FLASH_COST_CENTERS_PATH = "/core/v1/cost-centers";
// Endpoint sempre confiável para validar token (documentado)
const FLASH_VALIDATE_PATH = "/core/v1/companies";
const FLASH_PAGE_SIZE = Number(Deno.env.get("FLASH_PAGE_SIZE") ?? "100");
const FLASH_MAX_PAGES = Number(Deno.env.get("FLASH_MAX_PAGES") ?? "1000");

interface FlashTransaction {
  id?: string;
  external_id?: string;
  [key: string]: unknown;
}

interface FlashApiResponse {
  data?: FlashTransaction[];
  items?: FlashTransaction[];
  results?: FlashTransaction[];
  page?: number;
  total_pages?: number;
  has_more?: boolean;
  next_page?: number | string | null;
  next_cursor?: string | null;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractList(payload: FlashApiResponse): FlashTransaction[] {
  if (Array.isArray(payload)) return payload as FlashTransaction[];
  
  // Known data array keys
  const list = payload.data ?? payload.items ?? payload.results ?? payload.transactions ?? payload.expenses ?? payload.content ?? payload.expense_transactions;
  if (Array.isArray(list)) return list as FlashTransaction[];

  // Fallback: search for the first property that is an array
  for (const key in payload) {
    if (Array.isArray(payload[key])) {
      return payload[key] as FlashTransaction[];
    }
  }

  return [];
}

function extractExternalId(tx: FlashTransaction, fallbackIndex: number): string {
  return (
    (tx.external_id as string | undefined) ??
    (tx.id as string | undefined) ??
    `unknown-${Date.now()}-${fallbackIndex}`
  );
}

/**
 * Fetch transactions from Flash between [startDate, endDate] (inclusive).
 * Handles pagination using either page-number or cursor-based schemes.
 */
async function getTransactions(params: {
  startDate: string;
  endDate: string;
  token: string;
}): Promise<{
  transactions: FlashTransaction[];
  pagesFetched: number;
  lastResponse: FlashApiResponse | null;
}> {
  const { startDate, endDate, token } = params;
  const all: FlashTransaction[] = [];
  const seenIds = new Set<string>();
  let page = 1;
  let cursor: string | null = null;
  let pagesFetched = 0;
  let lastResponse: FlashApiResponse | null = null;

  while (pagesFetched < FLASH_MAX_PAGES) {
    const url = new URL(FLASH_TRANSACTIONS_PATH, FLASH_API_BASE_URL);
    // Filtros de data — a API Flash usa camelCase (startDate/endDate),
    // mas mantemos as variantes snake_case para tolerância.
    // Filtros de data exatos para despesas: begin_date e end_date.
    // Usamos também as variações camelCase para compatibilidade com outros endpoints.
    url.searchParams.set("begin_date", startDate);
    url.searchParams.set("end_date", endDate);
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    // Tamanho de página — Flash usa pageSize (camelCase). Mantém variantes.
    url.searchParams.set("pageSize", String(FLASH_PAGE_SIZE));
    url.searchParams.set("page_size", String(FLASH_PAGE_SIZE));
    url.searchParams.set("limit", String(FLASH_PAGE_SIZE));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
      url.searchParams.set("pageToken", cursor);
    } else {
      // Flash usa pageNumber (camelCase). Adicionamos variantes para compat.
      url.searchParams.set("pageNumber", String(page));
      url.searchParams.set("page", String(page));
      url.searchParams.set("offset", String((page - 1) * FLASH_PAGE_SIZE));
    }
    
    // Adicionar parâmetros de expansão para garantir que a API retorne os detalhes necessários
    url.searchParams.set("embed", "costCenter,employee,category");
    url.searchParams.set("include", "costCenter");
    url.searchParams.set("fields", "id,type,amount,date,costCenter,costCenterId,employee,employeeId,userId,category,comments,description,transaction");
    console.log(`[flash-sync] Fetching page ${page} (cursor=${cursor ?? "none"}): ${url.toString()}`);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-flash-auth": token,
        Accept: "application/json",
      },
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error(`${res.status}: Token Flash inválido ou sem permissão. Verifique a chave em hros.flashapp.com.br > Configurações > Plataforma > Chaves de acesso programático.`);
    }

    const text = await res.text();
    let payload: FlashApiResponse;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `Resposta inválida da Flash (HTTP ${res.status}): ${text.slice(0, 300)}`
      );
    }

    if (!res.ok) {
      throw new Error(
        `Flash API erro HTTP ${res.status}: ${JSON.stringify(payload).slice(0, 500)}`
      );
    }

    lastResponse = payload;
    const list = extractList(payload);

    // Detecta se a página atual contém apenas IDs já vistos — sinal de que
    // a API ignorou a paginação (loop infinito retornando a mesma página).
    let newOnPage = 0;
    for (const tx of list) {
      const id = (tx.id as string) ?? (tx.external_id as string) ?? "";
      if (id && seenIds.has(id)) continue;
      if (id) seenIds.add(id);
      all.push(tx);
      newOnPage += 1;
    }
    pagesFetched += 1;
    console.log(`[flash-sync] Page ${page}: received=${list.length}, new=${newOnPage}, totalUnique=${all.length}`);

    // Pagination control
    const nextCursor = (payload.next_cursor ?? payload.nextCursor ?? payload.pageToken ?? payload.nextPageToken ?? null) as string | null;
    const nextPage = payload.next_page ?? payload.nextPage ?? null;
    const totalPages = payload.total_pages ?? payload.totalPages ?? null;
    const hasMore = payload.has_more ?? payload.hasMore ?? null;

    // Se a página inteira foi de duplicatas → API não respeita paginação. Pare.
    if (list.length > 0 && newOnPage === 0) {
      console.warn(`[flash-sync] Página ${page} sem novos itens — interrompendo paginação.`);
      break;
    }

    if (nextCursor && nextCursor !== cursor) {
      cursor = nextCursor;
      continue;
    }
    if (typeof nextPage === "number" && nextPage > page) {
      page = nextPage;
      continue;
    }
    if (totalPages && page < Number(totalPages)) {
      page += 1;
      continue;
    }
    if (hasMore === true) {
      page += 1;
      continue;
    }
    if (list.length >= FLASH_PAGE_SIZE && totalPages == null && hasMore == null) {
      page += 1;
      continue;
    }
    break;
  }

  return { transactions: all, pagesFetched, lastResponse };
}

/**
 * Fetch all cost centers from Flash API (/core/v1/cost-centers).
 * Returns a Map from costCenterId → { id, name, code, externalId }.
 */
async function getCostCenters(token: string): Promise<Map<string, { id: string; name: string; code?: string; externalId?: string }>> {
  const map = new Map<string, { id: string; name: string; code?: string; externalId?: string }>();
  let page = 1;
  let pagesFetched = 0;

  while (pagesFetched < 50) {
    const url = new URL(FLASH_COST_CENTERS_PATH, FLASH_API_BASE_URL);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("pageNumber", String(page));
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", "100");

    console.log(`[flash-sync] Fetching cost centers page ${page}: ${url.toString()}`);

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "x-flash-auth": token,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        console.warn(`[flash-sync] Cost centers fetch failed: HTTP ${res.status}`);
        break;
      }

      const text = await res.text();
      let payload: any;
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        console.warn(`[flash-sync] Cost centers: invalid JSON response`);
        break;
      }

      // Flash retorna { records: [...], metadata: { ... } }
      console.log(`[flash-sync] Cost centers raw response keys:`, Object.keys(payload).join(", "));
      console.log(`[flash-sync] Cost centers raw response (first 500 chars):`, JSON.stringify(payload).substring(0, 500));
      const records = payload.records ?? payload.data ?? payload.items ?? payload.results ?? (Array.isArray(payload) ? payload : []);
      if (!Array.isArray(records) || records.length === 0) {
        if (pagesFetched === 0) {
          // Tenta buscar o array do primeiro campo que seja array
          for (const key in payload) {
            if (Array.isArray(payload[key]) && payload[key].length > 0) {
              for (const cc of payload[key]) {
                const id = cc.id || cc.costCenterId || "";
                if (id) {
                  map.set(id, {
                    id,
                    name: cc.name || cc.description || cc.label || cc.title || id,
                    code: cc.code || cc.externalId || undefined,
                    externalId: cc.externalId || undefined,
                  });
                }
              }
              break;
            }
          }
        }
        break;
      }

      for (const cc of records) {
        const id = cc.id || cc.costCenterId || "";
        if (id) {
          map.set(id, {
            id,
            name: cc.name || cc.description || cc.label || cc.title || id,
            code: cc.code || cc.externalId || undefined,
            externalId: cc.externalId || undefined,
          });
        }
      }

      pagesFetched++;

      // Pagination
      const totalPages = payload.metadata?.totalPages ?? payload.total_pages ?? payload.totalPages;
      const hasMore = payload.metadata?.hasMore ?? payload.has_more ?? payload.hasMore;
      if (totalPages && page >= Number(totalPages)) break;
      if (hasMore === false) break;
      if (records.length < 100) break;
      page++;
    } catch (err) {
      console.warn(`[flash-sync] Cost centers fetch error:`, err?.message ?? err);
      break;
    }
  }

  console.log(`[flash-sync] Fetched ${map.size} cost centers from Flash API`);
  return map;
}

/**
 * Fetch all employees from Flash API (/core/v1/employees).
 * Returns a Map from employeeId → { costCenterId, costCenterName }.
 */
async function getEmployees(token: string, costCenterMap: Map<string, any>): Promise<Map<string, { costCenterId?: string; costCenter?: any }>> {
  const map = new Map<string, { costCenterId?: string; costCenter?: any }>();
  let page = 1;
  let pagesFetched = 0;

  while (pagesFetched < 100) {
    const url = new URL("/core/v1/employees", FLASH_API_BASE_URL);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("pageNumber", String(page));
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", "100");

    console.log(`[flash-sync] Fetching employees page ${page}: ${url.toString()}`);

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "x-flash-auth": token,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        console.warn(`[flash-sync] Employees fetch failed: HTTP ${res.status}`);
        break;
      }

      const payload = await res.json();
      const records = payload.records ?? payload.data ?? payload.items ?? payload.results ?? (Array.isArray(payload) ? payload : []);
      
      if (!Array.isArray(records) || records.length === 0) break;

      for (const emp of records) {
        if (emp.id) {
          const ccId = emp.costCenterId ?? emp.cost_center_id ?? emp.costCenter?.id;
          if (ccId) {
            const cc = costCenterMap.get(ccId);
            map.set(emp.id, {
              costCenterId: ccId,
              costCenter: cc || emp.costCenter,
            });
          }
        }
      }

      pagesFetched++;
      const totalPages = payload.metadata?.totalPages ?? payload.total_pages ?? payload.totalPages;
      if (totalPages && page >= Number(totalPages)) break;
      if (records.length < 100) break;
      page++;
    } catch (err) {
      console.warn(`[flash-sync] Employees fetch error:`, err?.message ?? err);
      break;
    }
  }

  console.log(`[flash-sync] Fetched ${map.size} employees with cost centers from Flash API`);
  return map;
}

/**
 * Nova função para buscar despesa individual (fallback quando dados básicos vêm incompletos)
 */
async function fetchExpenseDetail(token: string, expenseId: string): Promise<any | null> {
  const candidatePaths = [
    `/expenses/v1/expenses/${expenseId}`,
    `/core/v1/expenses/${expenseId}`,
  ];
  for (const path of candidatePaths) {
    try {
      const res = await fetch(`${FLASH_API_BASE_URL}${path}`, {
        headers: { "x-flash-auth": token, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        return data?.expense ?? data?.data ?? data;
      }
    } catch { /* continua */ }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Não autorizado" }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: "Não autorizado" }, 401);
  }
  const userId = userData.user.id;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("empresa_id")
    .eq("id", userId)
    .single();

  if (profileError || !profile?.empresa_id) {
    return jsonResponse({ error: "Usuário sem empresa vinculada" }, 400);
  }
  const empresaId = profile.empresa_id;

  let body: { startDate?: string; endDate?: string; action?: string } = {};
  try {
    if (req.method === "POST") {
      body = await req.json();
    } else {
      const url = new URL(req.url);
      body = {
        startDate: url.searchParams.get("startDate") ?? undefined,
        endDate: url.searchParams.get("endDate") ?? undefined,
        action: url.searchParams.get("action") ?? undefined,
      };
    }
  } catch {
    return jsonResponse({ error: "Body JSON inválido" }, 400);
  }

  const flashToken = Deno.env.get("FLASH_API_TOKEN");
  if (!flashToken) {
    return jsonResponse({ error: "FLASH_API_TOKEN não configurado" }, 500);
  }

  // Helper: mascara o token nos headers para retorno de diagnóstico
  const maskToken = (t: string) => {
    if (!t) return "";
    if (t.length <= 8) return "***";
    return `${t.slice(0, 4)}…${t.slice(-4)} (len=${t.length})`;
  };

  // Action: test-auth - sonda múltiplos caminhos candidatos para /companies
  // (a doc lista path "/companies" mas o gateway Kong pode exigir prefixo de versão/serviço)
  if (body.action === "test-auth") {
    const candidatePaths = [
      "/companies",
      "/v1/companies",
      "/api/companies",
      "/api/v1/companies",
      "/hros/companies",
      "/hros/v1/companies",
      "/integration/companies",
      "/integration/v1/companies",
      "/employees/v1/companies",
      "/companies/v1/companies",
    ];

    const results: Array<Record<string, unknown>> = [];
    let winner: string | null = null;

    for (const p of candidatePaths) {
      const url = new URL(p, FLASH_API_BASE_URL);
      try {
        const res = await fetch(url.toString(), {
          method: "GET",
          headers: { "x-flash-auth": flashToken, Accept: "application/json" },
        });
        const text = await res.text();
        results.push({
          path: p,
          url: url.toString(),
          status: res.status,
          statusText: res.statusText,
          ok: res.ok,
          body_preview: text.slice(0, 300),
        });
        if (res.ok && !winner) winner = p;
      } catch (err) {
        results.push({ path: p, error: String(err?.message ?? err) });
      }
    }

    return jsonResponse({
      success: !!winner,
      winner,
      message: winner
        ? `✅ Caminho que funcionou: ${winner}`
        : "❌ Nenhum caminho retornou 200. Veja status de cada tentativa.",
      header_used: "x-flash-auth (conforme documentação)",
      token_preview: maskToken(flashToken),
      attempts: results,
    });
  }

  // Action: Test - valida o token chamando /companies (endpoint oficial documentado)
  if (body.action === "test") {
    const url = new URL(FLASH_VALIDATE_PATH, FLASH_API_BASE_URL);

    const requestHeaders = {
      "x-flash-auth": maskToken(flashToken),
      Accept: "application/json",
    };

    const diagnostic: Record<string, unknown> = {
      request: {
        method: "GET",
        url: url.toString(),
        base_url: FLASH_API_BASE_URL,
        path: FLASH_VALIDATE_PATH,
        headers: requestHeaders,
        body: null,
        token_preview: maskToken(flashToken),
        docs: "https://docs.api.flashapp.services/Empresas/ListarEmpresas",
      },
    };

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "x-flash-auth": flashToken,
          Accept: "application/json",
        },
      });

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { responseHeaders[k] = v; });

      const text = await res.text();
      let parsed: unknown = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }

      diagnostic.response = {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        headers: responseHeaders,
        body_text: text.slice(0, 4000),
        body_json: parsed,
      };

      if (res.status === 401) {
        return jsonResponse({
          success: false,
          status: 401,
          error: "401 Unauthorized: a chave de API da Flash é inválida ou foi revogada.",
          hint: "Gere uma nova chave em hros.flashapp.com.br > Configurações > Plataforma > Chaves de acesso programático e atualize o secret FLASH_API_TOKEN.",
          diagnostic,
        }, 401);
      }

      if (res.status === 403) {
        return jsonResponse({
          success: false,
          status: 403,
          error: "403 Forbidden: o token é válido mas não possui permissão para o endpoint /companies.",
          hint: "Solicite ao suporte da Flash (empresa@flashapp.com.br) habilitar a integração via API para sua empresa.",
          diagnostic,
        }, 403);
      }

      if (!res.ok) {
        return jsonResponse({
          success: false,
          status: res.status,
          error: `Erro na API Flash: HTTP ${res.status} ${res.statusText}`,
          diagnostic,
        }, res.status);
      }

      const list = Array.isArray(parsed) ? parsed : (parsed as any)?.data ?? (parsed as any)?.items ?? [];
      return jsonResponse({
        success: true,
        message: `✅ Conexão estabelecida! ${Array.isArray(list) ? list.length : 0} empresa(s) acessível(is) via API Flash.`,
        diagnostic,
      });
    } catch (err) {
      diagnostic.exception = String(err?.message ?? err);
      return jsonResponse({ success: false, error: err.message, diagnostic }, 500);
    }
  }

  // Action: Sync
  const startDate = body.startDate;
  const endDate = body.endDate;
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!startDate || !endDate || !isoDate.test(startDate) || !isoDate.test(endDate)) {
    return jsonResponse({ error: "startDate e endDate são obrigatórios (YYYY-MM-DD)" }, 400);
  }

  const { data: logRow } = await adminClient
    .from("flash_integration_logs")
    .insert({
      empresa_id: empresaId,
      evento: "getTransactions",
      request: { startDate, endDate },
      status: "pendente",
    })
    .select()
    .single();
  const logId = logRow?.id;

  try {
    // Buscar dados auxiliares do Flash para enriquecer as transações
    let costCenterMap = new Map<string, { id: string; name: string; code?: string; externalId?: string }>();
    let employeeMap = new Map<string, { costCenterId?: string; costCenter?: any }>();
    
    try {
      costCenterMap = await getCostCenters(flashToken);
      // Busca funcionários para ter um fallback de centro de custo baseado no perfil do usuário
      employeeMap = await getEmployees(flashToken, costCenterMap);
    } catch (err) {
      console.warn(`[flash-sync] Falha ao buscar dados auxiliares (CC/Emp):`, err?.message ?? err);
    }

    const { transactions, pagesFetched, lastResponse } = await getTransactions({
      startDate,
      endDate,
      token: flashToken,
    });

    // Enriquecer cada transação com centro de custo
    const txsWithoutCC: number[] = [];
    
    // Cache em memória persistente entre transações do mesmo loop (não entre invocações da Edge Function)
    // Com TTL de 5 minutos para segurança, embora o loop de sync dure menos.
    const CACHE_TTL = 5 * 60 * 1000; 
    const expenseDetailCache = new Map<string, { data: any; timestamp: number }>();



    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i] as any;

      // --- extração do ID do centro de custo com mais caminhos ---
      const ccId =
        tx.costCenterId ??
        tx.cost_center_id ??
        tx.costCenter?.id ??
        tx.project?.costCenter?.id ??
        tx.department?.costCenter?.id ??
        tx.employee?.costCenterId ??
        tx.employee?.costCenter?.id ??
        null;

      // O CC vindo da Flash tem prioridade máxima se tiver nome
      let hasName = !!(tx.costCenter?.name ?? tx.costCenter?.description);

      // 1. Enriquece pelo map de centros de custo carregado APENAS se ainda não tiver nome
      if (ccId && !hasName && costCenterMap.has(ccId)) {
        const cc = costCenterMap.get(ccId)!;
        tx.costCenter = { id: cc.id, name: cc.name, ...(cc.code ? { code: cc.code } : {}) };
        hasName = true;
      }

      // 2. Fallback por funcionário (extração histórica) - AGORA SECUNDÁRIO
      // Só aplica se a própria Flash não enviou centro de custo algum
      if (!hasName) {
        const empId =
          tx.employeeId ??
          tx.employee_id ??
          tx.employee?.id ??
          tx.userId ??         
          tx.user?.id ??       
          null;

        if (empId && employeeMap.has(empId)) {
          const empData = employeeMap.get(empId)!;
          if (empData.costCenter) {
            console.log(`[flash-sync] CC via fallback funcionário (histórico) para tx ${tx.id} (emp ${empId})`);
            tx.costCenter = empData.costCenter;
            hasName = true;
          }
        }
      }

      // 3. Marca para fetch individual se ainda sem CC
      if (!hasName) {
        txsWithoutCC.push(i);
      }

      // Garante que ID sem nome apareça como fallback textual
      const finalCcId = tx.costCenterId ?? tx.cost_center_id ?? tx.costCenter?.id;
      if (finalCcId && !tx.costCenter?.name) {
        tx.costCenter = { id: finalCcId, name: finalCcId };
      }

      // Enriquece costCenter do employee também
      const empCcId = tx.employee?.costCenterId ?? tx.employee?.costCenter?.id ?? null;
      if (empCcId && !tx.employee?.costCenter?.name && costCenterMap.has(empCcId)) {
        const cc = costCenterMap.get(empCcId)!;
        tx.employee = tx.employee || {};
        tx.employee.costCenter = { id: cc.id, name: cc.name };
      }
    }

    // 4. Fetch individual para transações que ainda estão sem centro de custo
    // Limita a 50 para não explodir o tempo de execução
    const INDIVIDUAL_FETCH_LIMIT = 50;
    const toFetch = txsWithoutCC.slice(0, INDIVIDUAL_FETCH_LIMIT);
    if (txsWithoutCC.length > 0) {
      const INDIVIDUAL_FETCH_LIMIT = 50;
      const CONCURRENCY_LIMIT = 5;
      
      // Agrupa índices por ID para evitar duplicidade de fetch e facilitar preenchimento
      const idToIndices = new Map<string, number[]>();
      for (const idx of txsWithoutCC) {
        const tx = transactions[idx] as any;
        const txId = tx.id ?? tx.external_id;
        if (txId) {
          if (!idToIndices.has(txId)) idToIndices.set(txId, []);
          idToIndices.get(txId)!.push(idx);
        }
      }

      const uniqueIds = Array.from(idToIndices.keys()).slice(0, INDIVIDUAL_FETCH_LIMIT);
      console.log(`[flash-sync] Buscando detalhes para ${uniqueIds.length} IDs únicos (impactando ${txsWithoutCC.length} transações)...`);

      // Função de processamento de um único ID
      const processId = async (txId: string) => {
        try {
          const cached = expenseDetailCache.get(txId);
          let detail = (cached && (Date.now() - cached.timestamp < CACHE_TTL)) ? cached.data : null;

          if (!detail) {
            detail = await fetchExpenseDetail(flashToken, txId);
            if (detail) {
              expenseDetailCache.set(txId, { data: detail, timestamp: Date.now() });
            }
          }

          if (detail) {
            const indices = idToIndices.get(txId) || [];
            for (const idx of indices) {
              const tx = transactions[idx] as any;
              
              const detailCcId =
                detail.costCenterId ??
                detail.cost_center_id ??
                detail.costCenter?.id ??
                detail.employee?.costCenterId ??
                detail.userId;

              if (detailCcId && costCenterMap.has(detailCcId)) {
                const cc = costCenterMap.get(detailCcId)!;
                tx.costCenter = { id: cc.id, name: cc.name };
              } else if (detail.costCenter?.name) {
                tx.costCenter = detail.costCenter;
              }

              if (!tx.comments && detail.comments) tx.comments = detail.comments;
              if (!tx.employee && detail.employee) tx.employee = detail.employee;
            }
          }
        } catch (e) {
          console.warn(`[flash-sync] Falha no processamento para ${txId}:`, e?.message ?? e);
        }
      };

      // Execução paralela com limite de concorrência
      for (let i = 0; i < uniqueIds.length; i += CONCURRENCY_LIMIT) {
        const chunk = uniqueIds.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(chunk.map(id => processId(id)));
        if (i + CONCURRENCY_LIMIT < uniqueIds.length) {
          await new Promise(r => setTimeout(r, 100)); // Rate limit breathing room
        }
      }
    }

    // ============================================================
    // PASS FINAL: Cross-reference por employee.id dentro do lote
    // Cobre transações automáticas de cartão sem CC explícito
    // ============================================================

    // 1. Constrói mapa employee_id → costCenter a partir das
    //    transações do lote que JÁ têm CC
    const empToCCInBatch = new Map<string, any>();
    for (const tx of transactions) {
      const t = tx as any;
      if (t.costCenter?.name && t.employee?.id) {
        if (!empToCCInBatch.has(t.employee.id)) {
          empToCCInBatch.set(t.employee.id, t.costCenter);
        }
      }
    }
    console.log(`[flash-sync] Mapa employee→CC do lote: ${empToCCInBatch.size} funcionários com CC`);

    // 2. Tenta resolver os que ainda estão sem CC pelo mesmo funcionário
    let resolvidosPorCrossRef = 0;
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i] as any;
      if (tx.costCenter?.name) continue; // já tem CC

      const empId = tx.employee?.id;
      if (empId && empToCCInBatch.has(empId)) {
        tx.costCenter = empToCCInBatch.get(empId);
        resolvidosPorCrossRef++;
        console.log(`[flash-sync] CC via cross-ref lote para ${tx.id} (${tx.employee?.name}): ${tx.costCenter.name}`);
      }
    }
    console.log(`[flash-sync] Cross-ref resolveu ${resolvidosPorCrossRef} transações adicionais`);

    // 3. Para os que ainda estão sem CC mesmo após cross-ref do lote,
    //    busca no banco os CCs já conhecidos desse funcionário
    const empIdsAindaSemCC = [...new Set(
      transactions
        .filter((tx: any) => !tx.costCenter?.name && tx.employee?.id)
        .map((tx: any) => (tx as any).employee.id)
    )];

    if (empIdsAindaSemCC.length > 0) {
      console.log(`[flash-sync] Consultando DB para ${empIdsAindaSemCC.length} funcionários ainda sem CC...`);
      
      // Busca o CC mais recente de cada funcionário no banco
      const { data: ccFromDB } = await adminClient
        .rpc('get_employee_cc_map', { employee_ids: empIdsAindaSemCC })
        .catch(() => ({ data: null }));

      if (ccFromDB && Array.isArray(ccFromDB)) {
        const dbCCMap = new Map<string, any>(
          ccFromDB.map((row: any) => [row.employee_id, { id: row.cc_id, name: row.cc_name }])
        );
        
        let resolvidosPorDB = 0;
        for (const tx of transactions) {
          const t = tx as any;
          if (t.costCenter?.name) continue;
          const empId = t.employee?.id;
          if (empId && dbCCMap.has(empId)) {
            t.costCenter = dbCCMap.get(empId);
            resolvidosPorDB++;
          }
        }
        console.log(`[flash-sync] DB cross-ref resolveu ${resolvidosPorDB} transações adicionais`);
      }
    }

    console.log(`[flash-sync] Fetched ${transactions.length} transações: ${transactions.length - txsWithoutCC.length} com CC, ${txsWithoutCC.length} sem CC (${Math.min(toFetch.length, INDIVIDUAL_FETCH_LIMIT)} buscados individualmente)`);

    let inserted = 0;
    if (transactions.length > 0) {
      // Deduplicação por external_id (chave de negócio da Flash).
      // Garantimos que nunca tentemos fazer upsert do mesmo external_id duas
      // vezes no mesmo lote — o que viola a constraint única e aborta a query.
      const uniqueRowsMap = new Map<string, any>();

      const toIsoDate = (raw: unknown): string | null => {
        if (!raw) return null;
        const s = String(raw);
        // Já é YYYY-MM-DD?
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        // ISO datetime → pega só a parte da data
        const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
        if (m) return m[1];
        // Fallback: tenta parsear
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        return null;
      };

      transactions.forEach((tx, idx) => {
        const extId = extractExternalId(tx, idx);

        // A API Flash retorna `date` no nível raiz da despesa (ISO datetime)
        // e também em `transaction.date`. Tentamos múltiplos caminhos.
        const txDate =
          toIsoDate((tx as any).transaction?.date) ||
          toIsoDate(tx.transaction_date) ||
          toIsoDate(tx.date) ||
          toIsoDate((tx as any).ocrData?.date) ||
          toIsoDate(tx.created_at);

        // A Flash API retorna o valor em centavos (inteiro). 
        // Ex: 3796 significa R$ 37,96. Dividimos por 100 para converter para decimal.
        const rawAmount =
          tx.amount ??
          (tx as any).transaction?.amount ??
          (tx as any).value ??
          0;
        const txAmount =
          (typeof rawAmount === "number"
            ? rawAmount
            : parseFloat(String(rawAmount)) || 0) / 100;

        // Deduplica por external_id. Mantém o último (que tem dados mais ricos).
        uniqueRowsMap.set(extId, {
          empresa_id: empresaId,
          external_id: extId,
          transaction_date: txDate,
          amount: txAmount,
          payload_json: tx,
        });
      });

      const rows = Array.from(uniqueRowsMap.values());
      console.log(`[flash-sync] Total recebido: ${transactions.length}, únicos por external_id: ${rows.length}`);

      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error: upsertError, count } = await adminClient
          .from("flash_transactions_raw")
          .upsert(chunk, {
            onConflict: "empresa_id,external_id",
            count: "exact",
          });

        if (upsertError) {
          console.error(`Erro no lote de upsert (índice ${i}):`, upsertError);
          throw upsertError;
        }
        inserted += count ?? chunk.length;
      }
      console.log(`[flash-sync] Upsert concluído: ${inserted} linhas afetadas`);

      // Auto-normalization
      try {
        const externalIds = rows.map((r) => r.external_id);
        const [{ data: savedRows }, { data: mappings }, { data: existingNorms }] = await Promise.all([
          adminClient.from("flash_transactions_raw").select("id, external_id, payload_json").eq("empresa_id", empresaId).in("external_id", externalIds),
          adminClient.from("flash_category_mapping").select("*").eq("empresa_id", empresaId),
          adminClient.from("flash_normalizacao").select("flash_transaction_id, status, conta_azul_payload").eq("empresa_id", empresaId).in("flash_transaction_id", rows.map(r => r.id).filter(Boolean).concat(transactions.map((t:any) => t.id).filter(Boolean))),
        ]);

        const normMap = new Map();
        (existingNorms || []).forEach(n => normMap.set(n.flash_transaction_id, n));

        const mappingIdx = new Map();
        (mappings || []).forEach((m) => mappingIdx.set(m.flash_type, m));

        const pickFlashType = (payload: any): string => {
          const candidates = ["type", "tipo", "category", "categoria", "transaction_type"];
          for (const k of candidates) {
            if (payload[k]) return String(payload[k]).trim();
          }
          return "indefinido";
        };

        const normRows = (savedRows || []).map((r: any) => {
          const flash_type = pickFlashType(r.payload_json);
          const m = mappingIdx.get(flash_type);
          
          // Force use of "Flash" account (ID from production)
          const fixedAccountId = "679d675b-006f-474a-be93-b68480396557"; 
          const fixedAccountName = "Flash";

          const categoryId = m?.conta_azul_category_id ?? null;
          const categoryName = m?.conta_azul_category_name ?? null;
          
          const hasFull = !!(categoryId && fixedAccountId);
          
          return {
            empresa_id: empresaId,
            flash_transaction_id: r.id,
            tipo_operacao: m?.tipo_operacao || "despesa",
            conta_azul_category_id: categoryId,
            conta_azul_category_name: categoryName,
            conta_azul_account_id: fixedAccountId,
            conta_azul_account_name: fixedAccountName,
            status: hasFull ? "normalizado" : "pendente",
            normalizado_at: hasFull ? new Date().toISOString() : null,
            flash_type_detectado: flash_type,
            motivo: hasFull 
              ? `Normalizado automaticamente via sync (mapping tipo "${flash_type}")` 
              : `Pendente: aguardando mapeamento para o tipo "${flash_type}"`,
          };
        });

        if (normRows.length > 0) {
          const chunk = 500;
          for (let i = 0; i < normRows.length; i += chunk) {
            await adminClient.from("flash_normalizacao").upsert(normRows.slice(i, i + chunk), { 
              onConflict: "flash_transaction_id" 
            });
          }
        }
      } catch (e) { console.error("Auto-norm failed", e); }
    }

    const durationMs = Date.now() - startedAt;
    if (logId) {
      await adminClient.from("flash_integration_logs").update({
        status: "sucesso",
        http_status: 200,
        duracao_ms: durationMs,
        response: { 
          transactions_received: transactions.length, 
          transactions_persisted: inserted, 
          pages_fetched: pagesFetched,
          raw_response: lastResponse
        },
      }).eq("id", logId);
    }

    return jsonResponse({
      success: true,
      totalProcessed: transactions.length,
      totalPersisted: inserted,
      pages: pagesFetched,
      duracao_ms: durationMs,
      rawResponse: lastResponse,
    });
  } catch (err) {
    const msg = err.message;
    if (logId) {
      await adminClient.from("flash_integration_logs").update({
        status: "erro",
        erro: msg,
        http_status: msg.includes("403") ? 403 : 500,
        duracao_ms: Date.now() - startedAt,
      }).eq("id", logId);
    }
    return jsonResponse({ success: false, error: msg }, msg.includes("403") ? 403 : 500);
  }
});