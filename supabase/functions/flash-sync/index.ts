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
// Adjust the base URL / endpoint to match Flash's actual API.
// Flash Business API usually uses /v1/business/transactions
const FLASH_API_BASE_URL =
  Deno.env.get("FLASH_API_BASE_URL") ?? "https://api.flashapp.com.br";
const FLASH_TRANSACTIONS_PATH =
  Deno.env.get("FLASH_TRANSACTIONS_PATH") ?? "/v1/business/transactions";
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
  return (
    payload.data ??
    payload.items ??
    payload.results ??
    []
  ) as FlashTransaction[];
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
    url.searchParams.set("page_size", String(FLASH_PAGE_SIZE));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    } else {
      url.searchParams.set("page", String(page));
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (res.status === 403) {
      throw new Error("403 Forbidden: Acesso Negado. Verifique as permissões do token no painel da Flash (ex: Leitura de Transações / API Business).");
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

  // Action: Test - retorna diagnóstico completo (URL, headers, status, body)
  if (body.action === "test") {
    const today = new Date().toISOString().split('T')[0];
    const url = new URL(FLASH_TRANSACTIONS_PATH, FLASH_API_BASE_URL);
    url.searchParams.set("page_size", "1");
    url.searchParams.set("start_date", today);
    url.searchParams.set("end_date", today);

    const requestHeaders = {
      Authorization: `Bearer ${maskToken(flashToken)}`,
      Accept: "application/json",
    };

    const diagnostic: Record<string, unknown> = {
      request: {
        method: "GET",
        url: url.toString(),
        base_url: FLASH_API_BASE_URL,
        path: FLASH_TRANSACTIONS_PATH,
        query_params: {
          page_size: "1",
          start_date: today,
          end_date: today,
        },
        headers: requestHeaders,
        body: null,
        token_preview: maskToken(flashToken),
      },
    };

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${flashToken}`,
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

      if (res.status === 403) {
        return jsonResponse({
          success: false,
          status: 403,
          error: "Acesso Negado (403). Verifique se o token possui permissões para acessar a API de Negócios/Transações no painel da Flash.",
          hint: "Geralmente é necessário habilitar o escopo 'business' ou 'transactions' na geração do token. Veja 'diagnostic' para a chamada completa.",
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

      return jsonResponse({
        success: true,
        message: "Conexão estabelecida com sucesso!",
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
        response: { transactions_received: transactions.length, transactions_persisted: inserted, pages_fetched: pagesFetched },
      }).eq("id", logId);
    }

    return jsonResponse({
      success: true,
      totalProcessed: transactions.length,
      totalPersisted: inserted,
      pages: pagesFetched,
      duracao_ms: durationMs,
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