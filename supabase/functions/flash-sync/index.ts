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
// Endpoint sempre confiável para validar token (documentado)
const FLASH_VALIDATE_PATH = "/core/v1/companies";
const FLASH_PAGE_SIZE = Number(Deno.env.get("FLASH_PAGE_SIZE") ?? "100");
const FLASH_MAX_PAGES = Number(Deno.env.get("FLASH_MAX_PAGES") ?? "100");

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
  const list = payload.data ?? payload.items ?? payload.results ?? payload.transactions ?? payload.content ?? payload.expense_transactions;
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
  let page = 1;
  let cursor: string | null = null;
  let pagesFetched = 0;
  let lastResponse: FlashApiResponse | null = null;

  while (pagesFetched < FLASH_MAX_PAGES) {
    const url = new URL(FLASH_TRANSACTIONS_PATH, FLASH_API_BASE_URL);
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);
    // Variações comuns de parâmetros de data (a API irá ignorar os inválidos)
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    url.searchParams.set("createdAtFrom", startDate);
    url.searchParams.set("createdAtTo", endDate);
    url.searchParams.set("transactionDateFrom", startDate);
    url.searchParams.set("transactionDateTo", endDate);
    url.searchParams.set("expenseDateFrom", startDate);
    url.searchParams.set("expenseDateTo", endDate);
    url.searchParams.set("page_size", String(FLASH_PAGE_SIZE));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    } else {
      url.searchParams.set("page", String(page));
    }

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
    all.push(...list);
    pagesFetched += 1;

    // Pagination control
    const nextCursor = (payload.next_cursor ?? null) as string | null;
    const nextPage = payload.next_page ?? null;
    const totalPages = payload.total_pages ?? null;
    const hasMore = payload.has_more ?? null;

    if (nextCursor) {
      cursor = nextCursor;
      continue;
    }
    if (typeof nextPage === "number") {
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
    const { transactions, pagesFetched, lastResponse } = await getTransactions({
      startDate,
      endDate,
      token: flashToken,
    });

    let inserted = 0;
    if (transactions.length > 0) {
      const rows = transactions.map((tx, idx) => ({
        empresa_id: empresaId,
        external_id: extractExternalId(tx, idx),
        payload_json: tx,
      }));

      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error: upsertError, count } = await adminClient
          .from("flash_transactions_raw")
          .upsert(chunk, {
            onConflict: "empresa_id,external_id",
            count: "exact",
          });
        if (upsertError) throw upsertError;
        inserted += count ?? chunk.length;
      }

      // Auto-normalization
      try {
        const externalIds = rows.map((r) => r.external_id);
        const [{ data: savedRows }, { data: mappings }] = await Promise.all([
          adminClient.from("flash_transactions_raw").select("id, external_id, payload_json").eq("empresa_id", empresaId).in("external_id", externalIds),
          adminClient.from("flash_category_mapping").select("*").eq("empresa_id", empresaId),
        ]);

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
          const hasFull = !!(m && m.conta_azul_category_id && m.conta_azul_account_id);
          return {
            empresa_id: empresaId,
            flash_transaction_id: r.id,
            tipo_operacao: m?.tipo_operacao || "despesa",
            conta_azul_category_id: m?.conta_azul_category_id ?? null,
            conta_azul_category_name: m?.conta_azul_category_name ?? null,
            conta_azul_account_id: m?.conta_azul_account_id ?? null,
            conta_azul_account_name: m?.conta_azul_account_name ?? null,
            status: hasFull ? "normalizado" : "pendente",
            normalizado_at: hasFull ? new Date().toISOString() : null,
          };
        });

        if (normRows.length > 0) {
          const chunk = 500;
          for (let i = 0; i < normRows.length; i += chunk) {
            await adminClient.from("flash_normalizacao").upsert(normRows.slice(i, i + chunk), { onConflict: "flash_transaction_id" });
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