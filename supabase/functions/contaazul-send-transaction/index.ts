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

  if (!transactionValue || transactionValue <= 0) {
    return {
      flash_transaction_id: input.flash_transaction_id,
      status: "skipped",
      error: "Valor da transação deve ser maior que zero",
    };
  }

  // Validação explícita para evitar erro 400 no Conta Azul
  if (!input.category_id) {
    return {
      flash_transaction_id: input.flash_transaction_id,
      status: "erro",
      error: "Categoria (category_id) é obrigatória para o envio ao Conta Azul",
    };
  }

  const payload = {
    data_competencia: transactionDate,
    valor: transactionValue,
    descricao: input.description,
    observacao: `Flash - ${input.description}`,
    conta_financeira: input.financial_account_id,
    id_categoria: input.category_id,
    rateio: [
      {
        id_categoria: input.category_id,
        valor: transactionValue, // Garantindo que categoriesRatio[0].value (valor do rateio) esteja preenchido
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
          valor: transactionValue,
          detalhe_valor: {
            valor_bruto: transactionValue,
            valor_liquido: transactionValue
          }
        }
      ]
    }
  };

  console.log(`[CONTA AZUL PAYLOAD] [ID: ${input.flash_transaction_id}] Payload estruturado para envio:`, JSON.stringify(payload, null, 2));

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
      
      if (responseJson?.status === "PENDING" && (contaAzulProtocolo !== null && contaAzulProtocolo !== undefined)) {
        console.log(`[DEBUG] Protocolo ${contaAzulProtocolo} pendente. Aguardando processamento...`);
        
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 4000));
          
          const importPath = input.type === "receita" ? "contas-a-receber/importacao" : "contas-a-pagar/importacao";
          const statusResp = await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/${importPath}/${contaAzulProtocolo}`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
          });
          
          if (statusResp.ok) {
            const statusData = await statusResp.json();
            console.log(`[DEBUG] Status do protocolo ${contaAzulProtocolo} (tentativa ${i+1}):`, statusData.status);
            responseJson = { ...responseJson, last_polling_status: statusData };

            if (statusData.status === "SUCCESS") {
              status = "ENVIADO";
              contaAzulId = statusData.resourceId || statusData.id || null;
              break;
            } else if (statusData.status === "ERROR") {
              status = "erro";
              errorMsg = `Erro Conta Azul: ${JSON.stringify(statusData.errors || statusData.message || statusData)}`;
              break;
            }
          } else if (statusResp.status === 404) {
            console.log(`[DEBUG] Protocolo ${contaAzulProtocolo} retornou 404. Tentando busca fallback imediato...`);
            const path = input.type === "receita" ? "contas-a-receber" : "contas-a-pagar";
            const searchUrl = `${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/${path}/buscar?data_vencimento_de=${transactionDate}&data_vencimento_ate=${transactionDate}`;
            const searchResp = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
            
            if (searchResp.ok) {
              const sData = await searchResp.json();
              const itens = sData.itens || sData;
              if (Array.isArray(itens)) {
                const match = itens.find((r: any) => 
                  Math.abs((r.valor || r.total) - transactionValue) < 0.01 && 
                  (r.descricao?.toLowerCase().includes(input.description.toLowerCase()) || input.description.toLowerCase().includes(r.descricao?.toLowerCase()))
                );
                
                if (match) {
                  status = "ENVIADO";
                  contaAzulId = match.id || match.uuid;
                  console.log(`[DEBUG] Encontrado via fallback imediato! ID: ${contaAzulId}`);
                  break;
                }
              }
            }
          }
        }
        
        if (status === "erro") {
          const lastStatus = responseJson?.last_polling_status?.status || "PENDING";
          if (lastStatus === "PENDING") {
            status = "erro"; 
            errorMsg = "O Conta Azul recebeu o lançamento mas está demorando para processar (Status: Pendente). Verifique se o lançamento aparece no Conta Azul em alguns minutos antes de tentar novamente.";
          } else {
            errorMsg = `Rejeição Conta Azul: ${lastStatus}. Verifique logs do payload para detalhes.`;
          }
        }
      } else if (responseJson?.status === "PENDING" && !contaAzulProtocolo) {
        status = "erro";
        errorMsg = "Conta Azul retornou status PENDING mas não forneceu um protocolo de rastreio.";
      } else {
        status = "ENVIADO";
        contaAzulId = responseJson?.id || responseJson?.uuid || null;
      }
    }

    if (status === "ENVIADO" && contaAzulId) {
      try {
        const parcelasResp = await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/${contaAzulId}/parcelas`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (parcelasResp.ok) {
          const parcelas = await parcelasResp.json();
          const parcelaId = parcelas[0]?.id;
          if (parcelaId && !parcelas[0]?.baixado) {
            console.log(`[DEBUG] Realizando baixa para parcela ${parcelaId}...`);
            await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/parcelas/${parcelaId}/baixa`, {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                data_pagamento: transactionDate,
                conta_financeira: input.financial_account_id,
                composicao_valor: { valor_bruto: transactionValue }
              })
            });
          }
        }
      } catch (baixaE) { console.error(`Erro na baixa:`, baixaE); }
    }
  } catch (e: any) {
    errorMsg = e?.message || String(e);
  }

  const duracao = Date.now() - startedAt;

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
    reconciliado: status === "ENVIADO" && !!contaAzulId,
  });

  if (status === "ENVIADO") {
    await supabase
      .from("flash_normalizacao")
      .update({
        status: "enviado",
        enviado_at: new Date().toISOString(),
        motivo: errorMsg || `Enviado ao Conta Azul em ${new Date().toLocaleString("pt-BR")}.`,
      })
      .eq("flash_transaction_id", input.flash_transaction_id)
      .eq("empresa_id", empresaId);
  }

  return { flash_transaction_id: input.flash_transaction_id, status, error: errorMsg };
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
    const { data: profile } = await admin.from("profiles").select("empresa_id, aprovado").eq("id", userData.user.id).maybeSingle();
    if (!profile?.empresa_id || !profile.aprovado) return json({ error: "Acesso negado" }, 403);

    const empresaId = profile.empresa_id;
    const body = await req.json().catch(() => ({}));
    let ids: string[] = body?.flash_transaction_ids || (body?.flash_transaction_id ? [body.flash_transaction_id] : []);
    if (!ids.length) return json({ error: "IDs ausentes" }, 400);

    const { data: norms } = await admin.from("flash_normalizacao").select("*").eq("empresa_id", empresaId).in("flash_transaction_id", ids);
    if (!norms?.length) return json({ error: "Nada encontrado" }, 404);

    const { data: raws } = await admin.from("flash_transactions_raw").select("id, payload_json").eq("empresa_id", empresaId).in("id", ids);
    const rawsById = new Map((raws || []).map((r) => [r.id, r]));

    const accessToken = await getValidAccessToken(admin, empresaId);
    const results = [];
    for (const n of norms) {
      const raw = rawsById.get(n.flash_transaction_id);
      const snap = (n.conta_azul_payload || {}) as any;
      const r = await sendOne(admin, empresaId, accessToken, {
        flash_transaction_id: n.flash_transaction_id,
        description: snap.description || raw?.payload_json?.description || "Lançamento Flash",
        value: typeof snap.amount === "number" ? snap.amount : Number(raw?.payload_json?.amount || 0),
        category_id: n.conta_azul_category_id,
        financial_account_id: n.conta_azul_account_id,
        date: snap.date || raw?.payload_json?.date || new Date().toISOString().split("T")[0],
        type: (n.tipo_operacao as any) || "despesa",
      }, true); 
      results.push(r);
    }

    return json({ ok: true, results });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});
