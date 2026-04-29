import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTAAZUL_API = "https://api-v2.contaazul.com";
const CONTAAZUL_TOKEN_URL = "https://auth.contaazul.com/oauth2/token";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function refreshAccessToken(supabase: any, empresaId: string, tokenData: any): Promise<string> {
  const clientId = Deno.env.get("CONTAAZUL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("CONTAAZUL_CLIENT_SECRET")!;

  if (!tokenData.refresh_token || tokenData.refresh_token === "pre_generated_no_refresh") {
    throw new Error("Refresh token do Conta Azul indisponível. Reconecte a integração.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokenData.refresh_token,
  });

  const resp = await fetch(CONTAAZUL_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    console.error("Erro refresh token CA:", resp.status, errBody);
    throw new Error("Falha ao renovar token do Conta Azul.");
  }

  const newTokens = await resp.json();
  const expiresAt = new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString();

  await supabase
    .from("contaazul_tokens")
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokenData.refresh_token,
      expires_at: expiresAt,
    })
    .eq("empresa_id", empresaId);

  return newTokens.access_token;
}

async function getValidAccessToken(supabase: any, empresaId: string): Promise<string> {
  const { data, error } = await supabase
    .from("contaazul_tokens")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Conta Azul não conectado para esta empresa.");
  }

  const expiresAt = new Date(data.expires_at);
  if (expiresAt > new Date(Date.now() + 120000)) {
    return data.access_token;
  }

  return await refreshAccessToken(supabase, empresaId, data);
}

async function isAlreadyIntegrated(supabase: any, flashTransactionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("flash_integration_logs")
    .select("id")
    .eq("flash_transaction_id", flashTransactionId)
    .eq("status", "ENVIADO")
    .maybeSingle();

  if (error) {
    console.error("Erro ao verificar duplicidade:", error);
    return false;
  }

  return !!data;
}

interface TransactionInput {
  flash_transaction_id: string;
  description: string;
  value: number;
  category_id: string;
  financial_account_id: string;
  date: string | null;
  type: "receita" | "despesa";
}

async function sendOne(
  supabase: any,
  empresaId: string,
  accessToken: string,
  input: TransactionInput,
  force: boolean = false
) {
  const startedAt = Date.now();
  
  // Verificação de duplicidade (pode ser ignorada se force=true, ex: reaberto)
  if (!force) {
    const alreadySent = await isAlreadyIntegrated(supabase, input.flash_transaction_id);
    if (alreadySent) {
      return {
        flash_transaction_id: input.flash_transaction_id,
        status: "skipped",
        error: "Transação já integrada anteriormente (controle de duplicidade)",
      };
    }
  }

  const transactionValue = Math.abs(Number(input.value) || 0);
  const transactionDate = input.date ? (input.date.includes("T") ? input.date.split("T")[0] : input.date) : new Date().toISOString().split("T")[0];

  // Validação rigorosa dos valores para evitar erro de composição obrigatória
  if (!transactionValue || transactionValue <= 0) {
    return {
      flash_transaction_id: input.flash_transaction_id,
      status: "skipped",
      error: "Valor da transação deve ser maior que zero",
    };
  }

  // Payload conforme Conta Azul API v1 (eventos-financeiros)
  // IMPORTANTE: Para evitar erro de composição obrigatória, usamos APENAS detalhe_valor.
  // Campos como 'valor' ou 'composicao_valor' nas parcelas/rateio podem causar conflitos.
  const payload = {
    data_competencia: transactionDate,
    valor: transactionValue, // Valor total do lançamento no topo é obrigatório
    descricao: input.description,
    observacao: `Flash - ${input.description}`,
    conta_financeira: input.financial_account_id,
    rateio: [
      {
        id_categoria: input.category_id,
        valor: transactionValue,
        detalhe_valor: {
          valor_bruto: transactionValue,
          valor_liquido: transactionValue
        }
      }
    ],
    condicao_pagamento: {
      parcelas: [
        {
          data_vencimento: transactionDate,
          conta_financeira: input.financial_account_id,
          descricao: `Parcela única - ${input.description}`,
          detalhe_valor: {
            valor_bruto: transactionValue,
            valor_liquido: transactionValue
          }
        }
      ]
    }
  };

  console.log(`[DEBUG] Enviando transação ${input.flash_transaction_id} para Conta Azul:`, JSON.stringify(payload, null, 2));

  let httpStatus: number | null = null;
  let responseJson: any = null;
  let errorMsg: string | null = null;
  let contaAzulId: string | null = null;
  let contaAzulProtocolo: string | null = null;
  let status: string = "erro";

  try {
    const endpoint = input.type === "receita" 
      ? `${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/contas-a-receber`
      : `${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/contas-a-pagar`;

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    httpStatus = resp.status;
    const text = await resp.text();
    
    console.log(`[DEBUG] Resposta Conta Azul (HTTP ${httpStatus}):`, text);

    try {
      responseJson = text ? JSON.parse(text) : null;
    } catch {
      responseJson = { raw: text };
    }

    if (!resp.ok) {
      errorMsg = `HTTP ${resp.status}: ${typeof responseJson === "object" ? JSON.stringify(responseJson) : text}`;
    } else {
      contaAzulProtocolo = responseJson?.protocolo || responseJson?.protocolId || null;
      
      if (responseJson?.status === "PENDING" && contaAzulProtocolo) {
        console.log(`[DEBUG] Protocolo ${contaAzulProtocolo} pendente. Aguardando processamento...`);
        // Tenta verificar o status do protocolo 3 vezes com intervalo de 2s
        for (let i = 0; i < 3; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const statusResp = await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/protocolos/${contaAzulProtocolo}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          
          if (statusResp.ok) {
            const statusData = await statusResp.json();
            console.log(`[DEBUG] Status do protocolo ${contaAzulProtocolo} (tentativa ${i+1}):`, JSON.stringify(statusData));
            
            if (statusData.status === "SUCCESS") {
              status = "ENVIADO";
              contaAzulId = statusData.resourceId || statusData.id || null;
              responseJson = { ...responseJson, final_status: statusData };
              break;
            } else if (statusData.status === "ERROR") {
              status = "erro";
              errorMsg = `Erro no processamento assíncrono do Conta Azul: ${JSON.stringify(statusData.errors || statusData.message)}`;
              responseJson = { ...responseJson, final_status: statusData };
              break;
            }
          }
        }
        
        // Se ainda estiver pendente após as tentativas, marcamos como enviado mas avisamos que está em processamento
        if (status === "erro" && !errorMsg) {
          status = "ENVIADO";
          errorMsg = "Lançamento em processamento assíncrono no Conta Azul (Protocolo pendente)";
        }
      } else {
        status = "ENVIADO";
        contaAzulId = responseJson?.id || responseJson?.uuid || null;
      }
    }
  } catch (e: any) {
    errorMsg = e?.message || String(e);
  }

  const duracao = Date.now() - startedAt;

  // Log persistente
  await supabase.from("flash_integration_logs").insert({
    empresa_id: empresaId,
    flash_transaction_id: input.flash_transaction_id,
    conta_azul_transaction_id: contaAzulId,
    conta_azul_protocolo: contaAzulProtocolo,
    evento: "send_transaction",
    status,
    http_status: httpStatus,
    duracao_ms: duracao,
    request: { flash_transaction_id: input.flash_transaction_id, payload },
    response: responseJson,
    erro: errorMsg,
  });

  // Atualiza flash_normalizacao quando sucesso
  if (status === "ENVIADO") {
    await supabase
      .from("flash_normalizacao")
      .update({
        status: "enviado",
        enviado_at: new Date().toISOString(),
        motivo: `Enviado ao Conta Azul em ${new Date().toLocaleString("pt-BR")}${contaAzulId ? ` (ID: ${contaAzulId})` : ""}.`,
      })
      .eq("flash_transaction_id", input.flash_transaction_id)
      .eq("empresa_id", empresaId);
  }

  return {
    flash_transaction_id: input.flash_transaction_id,
    status,
    http_status: httpStatus,
    conta_azul_transaction_id: contaAzulId,
    error: errorMsg,
    response: responseJson,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Token inválido" }, 401);

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await admin
      .from("profiles")
      .select("empresa_id, aprovado")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile?.empresa_id || !profile.aprovado) {
      return json({ error: "Usuário sem empresa ou não aprovado" }, 403);
    }

    const empresaId = profile.empresa_id;
    const body = await req.json().catch(() => ({}));

    let ids: string[] = [];
    if (Array.isArray(body?.flash_transaction_ids)) ids = body.flash_transaction_ids;
    else if (Array.isArray(body?.transactions)) ids = body.transactions.map((t: any) => t.flash_transaction_id).filter(Boolean);
    else if (body?.flash_transaction_id) ids = [body.flash_transaction_id];

    if (!ids.length) return json({ error: "Informe flash_transaction_ids" }, 400);

    const { data: norms, error: normErr } = await admin
      .from("flash_normalizacao")
      .select("*")
      .eq("empresa_id", empresaId)
      .in("flash_transaction_id", ids);

    if (normErr) return json({ error: normErr.message }, 500);
    if (!norms?.length) return json({ error: "Nenhum lançamento normalizado encontrado" }, 404);

    const { data: raws } = await admin
      .from("flash_transactions_raw")
      .select("id, external_id, payload_json")
      .eq("empresa_id", empresaId)
      .in("id", ids);
    const rawsById = new Map((raws || []).map((r) => [r.id, r]));

    const accessToken = await getValidAccessToken(admin, empresaId);

    const results: any[] = [];
    for (const n of norms) {
      if (n.status === "enviado") {
        results.push({
          flash_transaction_id: n.flash_transaction_id,
          status: "skipped",
          error: "Já enviado anteriormente",
        });
        continue;
      }
      if (!n.conta_azul_category_id || !n.conta_azul_account_id) {
        results.push({
          flash_transaction_id: n.flash_transaction_id,
          status: "skipped",
          error: "Categoria ou conta financeira ausente",
        });
        continue;
      }

      const raw = rawsById.get(n.flash_transaction_id);
      const snap = (n.conta_azul_payload || {}) as any;
      const description =
        snap.description ||
        raw?.payload_json?.description ||
        raw?.payload_json?.descricao ||
        raw?.payload_json?.merchant ||
        "Lançamento Flash";
      const value =
        typeof snap.amount === "number"
          ? snap.amount
          : Number(raw?.payload_json?.amount ?? raw?.payload_json?.value ?? raw?.payload_json?.valor ?? 0);
      const date =
        snap.date ||
        raw?.payload_json?.date ||
        raw?.payload_json?.data ||
        new Date().toISOString().split("T")[0];

      const r = await sendOne(admin, empresaId, accessToken, {
        flash_transaction_id: n.flash_transaction_id,
        description: String(description),
        value,
        category_id: n.conta_azul_category_id,
        financial_account_id: n.conta_azul_account_id,
        date,
        type: (n.tipo_operacao as any) || "despesa",
      }, n.status === "normalizado"); // Force send if status is "normalizado" (reopened or new)
      results.push(r);
    }

    const sucesso = results.filter((r) => r.status === "ENVIADO").length;
    const erro = results.filter((r) => r.status === "erro").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    return json({ ok: true, total: results.length, sucesso, erro, skipped, results });
  } catch (e: any) {
    console.error("Erro send-transaction:", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});