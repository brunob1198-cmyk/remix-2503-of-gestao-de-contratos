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
const FLASH_API_BASE_URL =
  Deno.env.get("FLASH_API_BASE_URL") ?? "https://api.flashapp.com.br";
const FLASH_TRANSACTIONS_PATH =
  Deno.env.get("FLASH_TRANSACTIONS_PATH") ?? "/v1/transactions";
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
      // No metadata, but a full page came back — try next page defensively.
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

  // Authenticate caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } =
    await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const userId = claimsData.claims.sub as string;

  // Service role for inserts that bypass RLS (logs + raw storage)
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // Resolve empresa_id from profile
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("empresa_id")
    .eq("id", userId)
    .single();

  if (profileError || !profile?.empresa_id) {
    return jsonResponse(
      { error: "Usuário sem empresa vinculada" },
      400
    );
  }
  const empresaId = profile.empresa_id as string;

  // Parse body
  let body: { startDate?: string; endDate?: string } = {};
  try {
    if (req.method === "POST") {
      body = await req.json();
    } else {
      const url = new URL(req.url);
      body = {
        startDate: url.searchParams.get("startDate") ?? undefined,
        endDate: url.searchParams.get("endDate") ?? undefined,
      };
    }
  } catch {
    return jsonResponse({ error: "Body JSON inválido" }, 400);
  }

  const startDate = body.startDate;
  const endDate = body.endDate;
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!startDate || !endDate || !isoDate.test(startDate) || !isoDate.test(endDate)) {
    return jsonResponse(
      { error: "startDate e endDate são obrigatórios (formato YYYY-MM-DD)" },
      400
    );
  }

  const flashToken = Deno.env.get("FLASH_API_TOKEN");
  if (!flashToken) {
    return jsonResponse(
      { error: "FLASH_API_TOKEN não configurado" },
      500
    );
  }

  // Pre-create a log row (pendente)
  const { data: logRow, error: logInsertError } = await adminClient
    .from("flash_integration_logs")
    .insert({
      empresa_id: empresaId,
      evento: "getTransactions",
      request: { startDate, endDate, page_size: FLASH_PAGE_SIZE },
      status: "pendente",
    })
    .select()
    .single();

  if (logInsertError) {
    console.error("Failed to create log row:", logInsertError);
  }
  const logId = logRow?.id as string | undefined;

  try {
    const { transactions, pagesFetched, lastResponse } = await getTransactions({
      startDate,
      endDate,
      token: flashToken,
    });

    // Persist raw transactions (upsert by external_id within empresa)
    let inserted = 0;
    if (transactions.length > 0) {
      const rows = transactions.map((tx, idx) => ({
        empresa_id: empresaId,
        external_id: extractExternalId(tx, idx),
        payload_json: tx,
      }));

      // Chunked upsert
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error: upsertError, count } = await adminClient
          .from("flash_transactions_raw")
          .upsert(chunk, {
            onConflict: "empresa_id,external_id",
            count: "exact",
            ignoreDuplicates: false,
          });
        if (upsertError) {
          throw new Error(`Erro ao salvar transações: ${upsertError.message}`);
        }
        inserted += count ?? chunk.length;
      }
    }

    const durationMs = Date.now() - startedAt;
    if (logId) {
      await adminClient
        .from("flash_integration_logs")
        .update({
          status: "sucesso",
          http_status: 200,
          duracao_ms: durationMs,
          response: {
            transactions_received: transactions.length,
            transactions_persisted: inserted,
            pages_fetched: pagesFetched,
            last_page_meta: lastResponse?.meta ?? null,
          },
        })
        .eq("id", logId);
    }

    return jsonResponse({
      success: true,
      transactions_received: transactions.length,
      transactions_persisted: inserted,
      pages_fetched: pagesFetched,
      duration_ms: durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt;
    console.error("flash-sync error:", message);

    if (logId) {
      await adminClient
        .from("flash_integration_logs")
        .update({
          status: "erro",
          erro: message,
          duracao_ms: durationMs,
        })
        .eq("id", logId);
    }

    return jsonResponse({ success: false, error: message }, 500);
  }
});
