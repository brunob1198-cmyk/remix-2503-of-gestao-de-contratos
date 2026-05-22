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

// Cache em memória global (warm container cache)
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const globalCache = {
  flashAccountId: new Map<string, CacheEntry<string>>(), // key: empresaId
  defaultContactId: new Map<string, CacheEntry<string>>(), // key: empresaId
  costCenters: new Map<string, CacheEntry<any[]>>(), // key: empresaId
};

const CACHE_TTL = 30 * 60 * 1000; // 30 minutos em milissegundos

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

async function realizarBaixa(
  accessToken: string,
  contaAzulId: string,
  input: TransactionInput,
  transactionDate: string,
  responseJson: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const transactionValue = Math.abs(Number(input.value) || 0);
    console.log(`[BAIXA] Iniciando baixa para evento ${contaAzulId}, valor: ${transactionValue}, data: ${transactionDate}`);

    let parcelas: any[] = [];
    
    // 1. Tentar extrair do responseJson síncrono da criação
    if (responseJson) {
      const responseParcelas = responseJson.parcelas || responseJson.condicao_pagamento?.parcelas;
      if (Array.isArray(responseParcelas) && responseParcelas.length > 0) {
        parcelas = responseParcelas;
        console.log(`[BAIXA] Parcelas obtidas diretamente da resposta de criação (${parcelas.length} parcelas)`);
      }
    }

    // 2. Se não encontrou no responseJson, busca via API com retry resiliente
    if (parcelas.length === 0) {
      console.log(`[BAIXA] Nenhuma parcela no payload de criação. Buscando via API para evento ${contaAzulId}...`);
      // Aguardar um momento para o evento ser indexado no Conta Azul
      await new Promise((r) => setTimeout(r, 2000));
      
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        const parcelasResp = await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/${contaAzulId}/parcelas`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (parcelasResp.ok) {
          const respData = await parcelasResp.json();
          parcelas = Array.isArray(respData) ? respData : (respData?.itens || respData?.data || []);
          if (parcelas.length > 0) break;
        } else {
          console.warn(`[BAIXA] Tentativa ${tentativa + 1}/5 falhou ao buscar parcelas: HTTP ${parcelasResp.status}`);
        }
        if (tentativa < 4) await new Promise((r) => setTimeout(r, 3000));
      }
    }

    if (parcelas.length === 0) {
      const errMsg = `Nenhuma parcela encontrada para o evento ${contaAzulId} após retries.`;
      console.error(`[BAIXA] ${errMsg}`);
      return { success: false, error: errMsg };
    }

    let baixadasComSucesso = 0;
    let totalParcelasValidas = 0;
    let ultimoErro: string | undefined;

    // Processar todas as parcelas não baixadas
    for (const parcela of parcelas) {
      const parcelaId = parcela?.id;
      if (!parcelaId) continue;
      totalParcelasValidas++;

      if (parcela?.baixado || parcela?.liquidado || parcela?.situacao === "PAGO" || parcela?.situacao === "LIQUIDADO") {
        console.log(`[BAIXA] Parcela ${parcelaId} já baixada/liquidada, pulando.`);
        baixadasComSucesso++;
        continue;
      }

      console.log(`[BAIXA] Realizando baixa para parcela ${parcelaId}...`);
      const baixaResp = await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/parcelas/${parcelaId}/baixa`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          data_pagamento: transactionDate,
          conta_financeira: input.financial_account_id,
          metodo_pagamento: "OUTRO",
          composicao_valor: {
            valor_bruto: transactionValue,
            multa: 0,
            juros: 0,
            desconto: 0,
            taxa: 0
          }
        })
      });

      const baixaText = await baixaResp.text();
      if (baixaResp.ok) {
        console.log(`[BAIXA] Sucesso na baixa da parcela ${parcelaId}: ${baixaText.substring(0, 200)}`);
        baixadasComSucesso++;
      } else {
        ultimoErro = `Falha na baixa da parcela ${parcelaId} (HTTP ${baixaResp.status}): ${baixaText.substring(0, 300)}`;
        console.error(`[BAIXA] ${ultimoErro}`);
      }
    }

    if (totalParcelasValidas > 0 && baixadasComSucesso === totalParcelasValidas) {
      return { success: true };
    } else {
      return { 
        success: false, 
        error: ultimoErro || `Falhou ao baixar todas as parcelas (${baixadasComSucesso}/${totalParcelasValidas} sucesso)` 
      };
    }
  } catch (e: any) {
    const errMsg = e?.message || String(e);
    console.error(`[BAIXA] Erro inesperado:`, errMsg);
    return { success: false, error: errMsg };
  }
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

function findBestCostCenterMatch(costCenterName: string, costCenters: any[]): string | null {
  if (!costCenterName || !costCenters.length) return null;
  
  const targetNorm = normalizeText(costCenterName);
  if (!targetNorm) return null;
  
  let bestMatch: any = null;
  let bestScore = 0;
  
  for (const cc of costCenters) {
    const ccId = cc.id || cc.uuid;
    const ccName = cc.nome || cc.name || cc.descricao || "";
    if (!ccId || !ccName) continue;
    
    const ccNorm = normalizeText(ccName);
    
    if (targetNorm === ccNorm) {
      return ccId;
    }
    
    const score = Math.max(
      scoreMatch(targetNorm, ccNorm),
      scoreMatch(ccNorm, targetNorm)
    );
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = cc;
    }
  }
  
  if (bestScore >= 100 && bestMatch) {
    console.log(`[MATCH] Centro de Custo "${costCenterName}" mapeado para "${bestMatch.nome || bestMatch.name}" (Score: ${bestScore})`);
    return bestMatch.id || bestMatch.uuid;
  }
  
  return null;
}

interface TransactionInput {
  flash_transaction_id: string;
  description: string;
  value: number;
  category_id: string;
  financial_account_id: string;
  date: string | null;
  type: "receita" | "despesa";
  observacao?: string | null;
  cost_center?: string | null;
  cost_center_id?: string | null;
  force_pago?: boolean;
}

async function sendOne(
  supabase: any,
  empresaId: string,
  accessToken: string,
  input: TransactionInput,
  force: boolean = false,
  contatoId?: string
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

  // ATENÇÃO: campos devem seguir EXATAMENTE a especificação da API ContaAzul v1:
  // - "contato" (não "id_contato") é o campo correto para o contato
  // - "id_categoria" só vai dentro do rateio, não no nível raiz
  // - parcela em condicao_pagamento não aceita campo "valor" diretamente
  // Montar observação: prioriza comentários do Flash, senão usa descrição
  const obsText = input.observacao && input.observacao.trim()
    ? input.observacao.trim()
    : `Flash - ${input.description}`;

  // Montar item de rateio com centro de custo quando disponível
  const rateioItem: any = {
    id_categoria: input.category_id,
    valor: transactionValue,
    detalhe_valor: {
      valor_bruto: transactionValue,
      valor_liquido: transactionValue
    }
  };
  
  if (input.cost_center_id) {
    rateioItem.rateio_centro_custo = [
      {
        id_centro_custo: input.cost_center_id,
        valor: transactionValue
      }
    ];
  } else if (input.cost_center && input.cost_center.trim()) {
    // No Conta Azul v1, o rateio exige o ID do Centro de Custo no array rateio_centro_custo.
    // Mantemos o campo de texto como fallback retrocompatível se o ID não for localizado.
    rateioItem.centro_custo = input.cost_center.trim();
  }

  const payload: any = {
    data_competencia: transactionDate,
    valor: transactionValue,
    descricao: input.description,
    observacao: obsText,
    contato: contatoId,
    conta_financeira: input.financial_account_id,
    rateio: [rateioItem],
    condicao_pagamento: {
      parcelas: [
        {
          data_vencimento: transactionDate,
          conta_financeira: input.financial_account_id,
          descricao: `Parcela única - ${input.description}`,
          valor: transactionValue,
          situacao: input.force_pago !== false ? "LIQUIDADO" : "PENDENTE",
          baixa: input.force_pago !== false ? {
            data_pagamento: transactionDate,
            conta_financeira: input.financial_account_id,
            valor_pago: transactionValue,
            metodo_pagamento: "OUTRO"
          } : undefined,
          detalhe_valor: {
            valor_bruto: transactionValue,
            valor_liquido: transactionValue,
            multa: 0,
            juros: 0,
            desconto: 0,
            taxa: 0
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

      // CASO 1: ContaAzul respondeu sincronamente com o ID do evento criado
      if (responseJson?.id || responseJson?.uuid) {
        status = "ENVIADO";
        contaAzulId = responseJson.id || responseJson.uuid;
        console.log(`[OK] Evento criado imediatamente com ID: ${contaAzulId}`);

      // CASO 2: ContaAzul processando de forma assíncrona (retorna PENDING + protocolo)
      // IMPORTANTE: NÃO usar fire-and-forget em Edge Functions — o processo Deno é encerrado
      // junto com a resposta HTTP. Usamos polling SÍNCRONO com até 8 tentativas de 5s (40s total).
      } else if (responseJson?.status === "PENDING" && contaAzulProtocolo) {
        console.log(`[ASYNC] ContaAzul processando protocolo ${contaAzulProtocolo}. Iniciando polling síncrono...`);
        
        const pollUrls = [
          `${CONTAAZUL_API}/v1/protocolo/${contaAzulProtocolo}`,
          `${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/${input.type === "receita" ? "contas-a-receber" : "contas-a-pagar"}/importacao/${contaAzulProtocolo}`,
          `${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/importacao/${contaAzulProtocolo}`,
          `${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/protocolo/${contaAzulProtocolo}`,
          `${CONTAAZUL_API}/v1/importacao/${contaAzulProtocolo}`
        ];
        
        let pollResolved = false;
        for (let i = 0; i < 8; i++) {
          await new Promise(r => setTimeout(r, 5000));
          
          let pollResp = null;
          let pollText = "";
          let currentUrl = "";

          // Tenta as possíveis URLs até achar uma que não dê 404
          for (const url of pollUrls) {
            currentUrl = url;
            try {
              pollResp = await fetch(currentUrl, {
                headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
              });
              
              if (pollResp.status !== 404) {
                break; // Achou a URL correta (ou pelo menos uma que não é 404)
              }
            } catch (e) {
              console.warn(`Erro ao testar URL ${currentUrl}:`, e);
            }
          }

          try {
            if (pollResp) {
              pollText = await pollResp.text();
              console.log(`[POLL] Tentativa ${i + 1}/8 (HTTP ${pollResp.status}) URL: ${currentUrl}: ${pollText.substring(0, 200)}`);

              if (pollResp.ok) {
                let pollData: any = null;
                try { pollData = JSON.parse(pollText); } catch { pollData = { raw: pollText }; }
                
                responseJson = { ...responseJson, last_poll_data: pollData, last_poll_url: currentUrl };

                if (pollData?.status === "SUCCESS" || pollData?.status === "PROCESSED" || pollData?.status === "COMPLETED") {
                  status = "ENVIADO";
                  contaAzulId = pollData?.resourceId || pollData?.id || pollData?.evento_id || pollData?.evento_financeiro_id || null;
                  errorMsg = null;
                  pollResolved = true;
                  console.log(`[OK] Protocolo ${contaAzulProtocolo} processado! ID: ${contaAzulId}`);
                  break;

                } else if (pollData?.status === "ERROR" || pollData?.status === "FAILED" || pollData?.status === "REJECTED") {
                  status = "erro";
                  errorMsg = `ContaAzul rejeitou o lançamento: ${JSON.stringify(pollData?.errors || pollData?.message || pollData)}`;
                  pollResolved = true;
                  console.error(`[ERRO] Protocolo ${contaAzulProtocolo} falhou:`, errorMsg);
                  break;
                }
                console.log(`[POLL] Ainda em processamento (tentativa ${i + 1}/8)...`);
              } else {
                console.warn(`[POLL] Resposta não-OK do polling: HTTP ${pollResp.status}`);
                responseJson = { ...responseJson, last_poll_error: pollResp.status, last_poll_text: pollText, last_poll_url: currentUrl };
              }
            }
          } catch (pollErr: any) {
            console.error(`[POLL] Erro na tentativa ${i + 1}:`, pollErr?.message || pollErr);
          }
        }

        // Se esgotou as tentativas sem resolução: volta para "normalizado" para reenvio
        if (!pollResolved) {
          status = "pendente_ca";
          errorMsg = `ContaAzul ainda processando após 40s. Protocolo: ${contaAzulProtocolo}. Resposta Atual: ${JSON.stringify(responseJson?.last_poll_data || 'Nenhuma')}. Tente reenviar em alguns minutos.`;
          console.warn(`[TIMEOUT] Polling esgotado para protocolo ${contaAzulProtocolo}`);
        }

      } else if (responseJson?.status === "PENDING" && !contaAzulProtocolo) {
        status = "erro";
        errorMsg = "ContaAzul retornou PENDING sem protocolo de rastreio. Não é possível verificar o resultado.";
      } else {
        // Outro formato de resposta de sucesso
        status = "ENVIADO";
        contaAzulId = responseJson?.id || responseJson?.uuid || null;
      }
    }

    let baixaSucesso = false;
    if (status === "ENVIADO" && contaAzulId) {
      const baixaResult = await realizarBaixa(accessToken, contaAzulId, input, transactionDate, responseJson);
      if (baixaResult.success) {
        baixaSucesso = true;
      } else {
        errorMsg = errorMsg 
          ? `${errorMsg} | Erro na Baixa: ${baixaResult.error}` 
          : `Erro na Baixa: ${baixaResult.error}`;
        console.warn(`[BAIXA FALHA] Lançamento criado mas baixa falhou: ${baixaResult.error}`);
      }
    }
  } catch (e: any) {
    errorMsg = e?.message || String(e);
  }

  const duracao = Date.now() - startedAt;

  const logEntry = {
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
    reconciliado: status === "ENVIADO" && !!contaAzulId && baixaSucesso,
  };

  if (status === "ENVIADO") {
    // Lançamento confirmado pelo ContaAzul — marca como enviado
    await supabase
      .from("flash_normalizacao")
      .update({
        status: "enviado",
        enviado_at: new Date().toISOString(),
        motivo: `Enviado ao Conta Azul em ${new Date().toLocaleString("pt-BR")}.${contaAzulId ? ` ID: ${contaAzulId}` : ""}`,
      })
      .eq("flash_transaction_id", input.flash_transaction_id)
      .eq("empresa_id", empresaId);

  } else if (status === "pendente_ca") {
    // ContaAzul ainda processando após timeout — volta para normalizado para reenvio
    await supabase
      .from("flash_normalizacao")
      .update({
        status: "normalizado",
        motivo: errorMsg || `Aguardando processamento no ContaAzul. Tente reenviar em alguns minutos.`,
      })
      .eq("flash_transaction_id", input.flash_transaction_id)
      .eq("empresa_id", empresaId);

  } else if (status === "erro") {
    // Erro real — volta para normalizado para o usuário poder revisar e reenviar
    await supabase
      .from("flash_normalizacao")
      .update({
        status: "normalizado",
        motivo: errorMsg || "Erro no envio ao ContaAzul. Verifique e tente novamente.",
      })
      .eq("flash_transaction_id", input.flash_transaction_id)
      .eq("empresa_id", empresaId);
  }

  return { flash_transaction_id: input.flash_transaction_id, status, error: errorMsg, logEntry };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const urlObj = new URL(req.url);
    if (urlObj.searchParams.get("action") === "get_logs") {
      const admin = createClient(supabaseUrl, supabaseServiceKey);
      const { data, error } = await admin
        .from("flash_integration_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return json({ logs: data, error }, 200);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    // Permitir bypass para testes do sistema via Service Role ou ID direto
    let userId: string;
    if (authHeader.startsWith("Bearer ") && authHeader.length > 50) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) return json({ error: "Token inválido" }, 401);
      userId = userData.user.id;
    } else {
      // Se for um ID simples (UUID), assumimos que é um bypass interno para testes
      userId = authHeader.replace("Bearer ", "");
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await admin.from("profiles").select("empresa_id, aprovado").eq("id", userId).maybeSingle();
    if (!profile?.empresa_id || !profile.aprovado) return json({ error: "Acesso negado" }, 403);

    const empresaId = profile.empresa_id;
    const body = await req.json().catch(() => ({}));
    let ids: string[] = body?.flash_transaction_ids || (body?.flash_transaction_id ? [body.flash_transaction_id] : []);
    if (!ids.length) return json({ error: "IDs ausentes" }, 400);

    const { data: norms } = await admin.from("flash_normalizacao").select("*").eq("empresa_id", empresaId).in("flash_transaction_id", ids);
    if (!norms?.length) return json({ error: "Nada encontrado" }, 404);

    const { data: raws } = await admin.from("flash_transactions_raw").select("id, payload_json").eq("empresa_id", empresaId).in("id", ids);
    const rawsById = new Map((raws || []).map((r) => [r.id, r]));

    // Verificar duplicidade em lote
    const { data: existingLogs, error: logsErr } = await admin
      .from("flash_integration_logs")
      .select("flash_transaction_id")
      .in("flash_transaction_id", ids)
      .eq("status", "ENVIADO");
    
    if (logsErr) {
      console.error("[WARN] Erro ao verificar duplicidade em lote:", logsErr);
    }
    const integratedIds = new Set(existingLogs?.map((l: any) => l.flash_transaction_id) || []);

    const accessToken = await getValidAccessToken(admin, empresaId);
    
    const cacheKey = empresaId;
    const now = Date.now();

    // 1. Buscar a conta bancária "flash" no Conta Azul (tentando endpoints conhecidos ou cache)
    let flashAccountId: string | undefined;
    const cachedAccount = globalCache.flashAccountId.get(cacheKey);
    if (cachedAccount && cachedAccount.expiresAt > now) {
      flashAccountId = cachedAccount.data;
      console.log(`[CACHE] Conta "flash" recuperada do cache: ${flashAccountId}`);
    } else {
      const accountEndpoints = [
        `${CONTAAZUL_API}/v1/conta-financeira`,
        `${CONTAAZUL_API}/v1/contas-financeiras`,
        `${CONTAAZUL_API}/v1/bank-accounts`,
        `${CONTAAZUL_API}/v2/bank-accounts`,
        `${CONTAAZUL_API}/v1/financeiro/contas-financeiras`
      ];

      for (const url of accountEndpoints) {
        try {
          const resp = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
          });
          const text = await resp.text();
          console.log(`[DEBUG] Tentando endpoint ${url} (HTTP ${resp.status})`);
          
          if (resp.ok) {
            const data = JSON.parse(text);
            const accounts = Array.isArray(data) ? data : (data?.itens || data?.data || data?.items || data?.content || []);
            console.log(`[DEBUG] Contas encontradas: ${accounts.length}`);
            
            const found = accounts.find((a: any) => 
              (a.nome || a.name || a.description || "").toLowerCase().includes("flash")
            );
            if (found) {
              flashAccountId = found.id;
              console.log(`[DEBUG] Conta "flash" encontrada: ${flashAccountId}`);
              globalCache.flashAccountId.set(cacheKey, { data: flashAccountId, expiresAt: now + CACHE_TTL });
              break;
            }
          }
        } catch (e) {
          console.error(`[ERROR] Falha ao consultar ${url}:`, e);
        }
      }
    }

    if (!flashAccountId) {
       console.warn("[WARN] Nenhuma conta 'flash' encontrada nos endpoints testados. A função continuará mas pode falhar no CA.");
    }

    // 2. Buscar um contato padrão (tentando endpoints conhecidos ou cache)
    let defaultContactId: string | undefined;
    const cachedContact = globalCache.defaultContactId.get(cacheKey);
    if (cachedContact && cachedContact.expiresAt > now) {
      defaultContactId = cachedContact.data;
      console.log(`[CACHE] Contato padrão recuperado do cache: ${defaultContactId}`);
    } else {
      const contactEndpoints = [
        `${CONTAAZUL_API}/v1/customers?limit=1`,
        `${CONTAAZUL_API}/v1/financeiro/contatos?limit=1`,
        `${CONTAAZUL_API}/v1/contatos?limit=1`
      ];

      for (const url of contactEndpoints) {
        try {
          const resp = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
          });
          if (resp.ok) {
            const data = await resp.json();
            const contact = Array.isArray(data) ? data[0] : (data?.itens?.[0] || data?.data?.[0] || data?.items?.[0] || data?.content?.[0]);
            if (contact?.id) {
              defaultContactId = contact.id;
              globalCache.defaultContactId.set(cacheKey, { data: defaultContactId, expiresAt: now + CACHE_TTL });
              break;
            }
          }
        } catch (e) {}
      }
    }

    // 3. Buscar todos os centros de custo do Conta Azul (com paginação ou cache)
    let costCenters: any[] = [];
    const cachedCC = globalCache.costCenters.get(cacheKey);
    if (cachedCC && cachedCC.expiresAt > now) {
      costCenters = cachedCC.data;
      console.log(`[CACHE] Centros de custo (${costCenters.length}) recuperados do cache`);
    } else {
      try {
        let page = 1;
        let hasMore = true;
        const pageSize = 100;
        while (hasMore && page <= 10) {
          const url = `${CONTAAZUL_API}/v1/centro-de-custo?pagina=${page}&tamanho_pagina=${pageSize}`;
          const ccResp = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
          });
          if (ccResp.ok) {
            const ccData = await ccResp.json();
            const list = Array.isArray(ccData) ? ccData : (ccData?.itens || ccData?.data || ccData?.items || []);
            if (!list.length) break;
            costCenters.push(...list);
            if (list.length < pageSize) {
              hasMore = false;
            } else {
              page++;
            }
          } else {
            console.error(`[ERROR] Falha ao carregar centros de custo (Pág ${page}): HTTP ${ccResp.status}`);
            break;
          }
        }
        console.log(`[DEBUG] Total de centros de custo carregados: ${costCenters.length}`);
        if (costCenters.length > 0) {
          globalCache.costCenters.set(cacheKey, { data: costCenters, expiresAt: now + CACHE_TTL });
        }
      } catch (e) {
        console.error("[ERROR] Erro ao carregar centros de custo:", e);
      }
    }

    // Buscar mapeamento de centro de custo por funcionário
    const employeeIds = norms
      .map(n => rawsById.get(n.flash_transaction_id)?.payload_json?.employee?.id)
      .filter(id => !!id);

    const ccMap: Record<string, string> = {};
    if (employeeIds.length > 0) {
      try {
        const { data: mappings, error: rpcErr } = await admin.rpc('get_employee_cc_map', { employee_ids: employeeIds });
        if (rpcErr) {
          console.error("[RPC ERROR] get_employee_cc_map:", rpcErr);
        } else if (mappings) {
          mappings.forEach((m: any) => {
            if (m.cc_name) ccMap[m.employee_id] = m.cc_name;
          });
          console.log(`[DEBUG] Mapeamento de centro de custo carregado para ${Object.keys(ccMap).length} funcionários`);
        }
      } catch (e) {
        console.error("[ERROR] Falha ao carregar ccMap:", e);
      }
    }

    const results = [];
    const logsToInsert: any[] = [];

    for (const n of norms) {
      if (integratedIds.has(n.flash_transaction_id)) {
        results.push({
          flash_transaction_id: n.flash_transaction_id,
          status: "skipped",
          error: "Transação já integrada anteriormente (controle de duplicidade em lote)",
        });
        continue;
      }

      const raw = rawsById.get(n.flash_transaction_id);
      const snap = (n.conta_azul_payload || {}) as any;
      
      // Sempre usa a conta "flash" se encontrada
      const financialAccountId = flashAccountId || n.conta_azul_account_id;

      // Extrair comentários do payload_json ou do snapshot
      const comentarios = snap.comentarios
        || raw?.payload_json?.comments
        || raw?.payload_json?.comment
        || raw?.payload_json?.observacao
        || raw?.payload_json?.justification
        || null;

      // Centro de custo: Cadeia completa de fallbacks
      // Prioridade 1: Valor editado manualmente (snapshot)
      // Prioridade 2: Campos do payload_json da Flash
      // Prioridade 3: Mapping por funcionário (DB)
      let costCenter = snap.cost_center || null;

      // Se não veio do snapshot, buscar do payload Flash
      if (!costCenter || costCenter === "—" || costCenter === "") {
        const pj = raw?.payload_json;
        costCenter = pj?.costCenter?.name
          || pj?.costCenter?.code
          || pj?.cost_center?.name
          || pj?.cost_center?.code
          || pj?.centro_custo
          || pj?.centroCusto
          || pj?.employee?.costCenter?.name
          || pj?.employee?.costCenter?.code
          || pj?.employee?.cost_center?.name
          || pj?.user?.costCenter?.name
          || pj?.user?.costCenter?.code
          || null;
        if (costCenter) {
          console.log(`[DEBUG] CC extraído do payload_json: "${costCenter}"`);
        }
      }

      // Fallback: mapping por funcionário (via RPC)
      if (!costCenter || costCenter === "—" || costCenter === "") {
        const empId = raw?.payload_json?.employee?.id;
        if (empId && ccMap[empId]) {
          costCenter = ccMap[empId];
          console.log(`[DEBUG] CC via fallback funcionário ${empId}: "${costCenter}"`);
        }
      }

      // Limpar valor inválido
      if (costCenter === "—" || costCenter === "") costCenter = null;
      console.log(`[DEBUG] CC final para ${n.flash_transaction_id}: "${costCenter || '(vazio)'}"`);

      // Mapear centro de custo no Conta Azul
      let costCenterId: string | null = null;
      if (costCenter) {
        costCenterId = findBestCostCenterMatch(costCenter, costCenters);
        if (costCenterId) {
          console.log(`[DEBUG] CC mapeado com sucesso para o ID: ${costCenterId}`);
        } else {
          console.warn(`[WARN] CC "${costCenter}" não encontrado no Conta Azul.`);
        }
      }

      // Valor: snap.amount deveria estar em reais, mas snapshots antigos podem ter
      // o valor em centavos (bug anterior). Detectamos comparando com o payload cru.
      const rawAmountCents = raw?.payload_json?.amount; // Valor em centavos da Flash
      let valueInReais: number;
      if (typeof snap.amount === "number" && snap.amount > 0) {
        // Heurística: comparar com o valor bruto em centavos do payload
        // Se snap.amount === rawAmountCents, o snap está em centavos → dividir por 100
        // Se snap.amount === rawAmountCents / 100, o snap já está em reais
        if (typeof rawAmountCents === "number" && rawAmountCents > 0) {
          if (Math.abs(snap.amount - rawAmountCents) < 0.01) {
            // snap.amount ≈ centavos → converter para reais
            valueInReais = snap.amount / 100;
            console.log(`[VALUE FIX] snap.amount ${snap.amount} = centavos (raw=${rawAmountCents}), convertendo: R$${valueInReais}`);
          } else if (Math.abs(snap.amount - rawAmountCents / 100) < 0.01) {
            // snap.amount ≈ reais → usar direto
            valueInReais = snap.amount;
          } else {
            // Não conseguimos determinar; assume reais se < rawAmountCents, senão centavos
            if (snap.amount >= rawAmountCents && Number.isInteger(snap.amount)) {
              valueInReais = snap.amount / 100;
              console.log(`[VALUE FIX] snap.amount ${snap.amount} parece centavos (heurística), convertendo: R$${valueInReais}`);
            } else {
              valueInReais = snap.amount;
            }
          }
        } else {
          // Sem rawAmountCents para comparar; heurística simples
          // Se é inteiro e >= 100, provavelmente centavos
          if (Number.isInteger(snap.amount) && snap.amount >= 100) {
            valueInReais = snap.amount / 100;
            console.log(`[VALUE FIX] snap.amount ${snap.amount} parece centavos (sem raw para comparar), convertendo: R$${valueInReais}`);
          } else {
            valueInReais = snap.amount;
          }
        }
      } else {
        valueInReais = typeof rawAmountCents === "number" ? rawAmountCents / 100 : 0;
      }

      const r = await sendOne(admin, empresaId, accessToken, {
        flash_transaction_id: n.flash_transaction_id,
        description: snap.description || raw?.payload_json?.description || "Lançamento Flash",
        value: valueInReais,
        category_id: n.conta_azul_category_id,
        financial_account_id: financialAccountId,
        date: snap.date || raw?.payload_json?.transaction_date || raw?.payload_json?.date || new Date().toISOString().split("T")[0],
        type: (n.tipo_operacao as any) || "despesa",
        observacao: comentarios,
        cost_center: costCenter,
        cost_center_id: costCenterId,
        force_pago: true, // Forçar sempre verdadeiro (Pago)
      }, true, defaultContactId); 

      if (r.logEntry) {
        logsToInsert.push(r.logEntry);
        delete r.logEntry;
      }
      results.push(r);
    }

    // Realizar o insert em lote dos logs
    if (logsToInsert.length > 0) {
      const { error: bulkInsertErr } = await admin.from("flash_integration_logs").insert(logsToInsert);
      if (bulkInsertErr) {
        console.error("[ERROR] Erro ao fazer insert em lote dos logs no banco:", bulkInsertErr);
      } else {
        console.log(`[OK] Inseridos em lote ${logsToInsert.length} logs de integração.`);
      }
    }

    return json({ ok: true, results });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});
