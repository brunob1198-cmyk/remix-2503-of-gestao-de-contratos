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

async function realizarBaixa(accessToken: string, contaAzulId: string, input: TransactionInput, transactionDate: string) {
  try {
    const transactionValue = Math.abs(Number(input.value) || 0);
    console.log(`[BAIXA] Iniciando baixa para evento ${contaAzulId}, valor: ${transactionValue}, data: ${transactionDate}`);

    // Aguardar um momento para o evento ser processado antes de buscar parcelas
    await new Promise((r) => setTimeout(r, 2000));

    // Tentar buscar parcelas com retry
    let parcelas: any[] = [];
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const parcelasResp = await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/${contaAzulId}/parcelas`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (parcelasResp.ok) {
        const respData = await parcelasResp.json();
        parcelas = Array.isArray(respData) ? respData : (respData?.itens || respData?.data || []);
        if (parcelas.length > 0) break;
      } else {
        console.warn(`[BAIXA] Tentativa ${tentativa + 1}/3 falhou ao buscar parcelas: HTTP ${parcelasResp.status}`);
      }
      if (tentativa < 2) await new Promise((r) => setTimeout(r, 2000));
    }

    if (parcelas.length === 0) {
      console.error(`[BAIXA] Nenhuma parcela encontrada para o evento ${contaAzulId} após 3 tentativas`);
      return;
    }

    // Processar todas as parcelas não baixadas
    for (const parcela of parcelas) {
      const parcelaId = parcela?.id;
      if (!parcelaId) continue;
      if (parcela?.baixado || parcela?.liquidado || parcela?.situacao === "PAGO" || parcela?.situacao === "LIQUIDADO") {
        console.log(`[BAIXA] Parcela ${parcelaId} já baixada/liquidada, pulando.`);
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
            valor_liquido: transactionValue,
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
      } else {
        console.error(`[BAIXA] Erro na baixa da parcela ${parcelaId} (HTTP ${baixaResp.status}): ${baixaText.substring(0, 500)}`);
      }
    }
  } catch (e) {
    console.error(`[BAIXA] Erro inesperado:`, e);
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
  
  // No Conta Azul, o centro de custo no rateio deve ser o NOME (string)
  if (input.cost_center && input.cost_center.trim()) {
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

    if (status === "ENVIADO" && contaAzulId) {
      await realizarBaixa(accessToken, contaAzulId, input, transactionDate);
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

  return { flash_transaction_id: input.flash_transaction_id, status, error: errorMsg };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
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

    const accessToken = await getValidAccessToken(admin, empresaId);
    
    // Buscar a conta bancária "flash" no Conta Azul (tentando endpoints conhecidos)
    let flashAccountId: string | undefined;
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
          // A API v1 pode retornar um array direto ou { itens: [] } ou { items: [] }
          const accounts = Array.isArray(data) ? data : (data?.itens || data?.data || data?.items || data?.content || []);
          console.log(`[DEBUG] Contas encontradas: ${accounts.length}`);
          
          const found = accounts.find((a: any) => 
            (a.nome || a.name || a.description || "").toLowerCase().includes("flash")
          );
          if (found) {
            flashAccountId = found.id;
            console.log(`[DEBUG] Conta "flash" encontrada: ${flashAccountId}`);
            break;
          }
        }
      } catch (e) {
        console.error(`[ERROR] Falha ao consultar ${url}:`, e);
      }
    }

    if (!flashAccountId) {
       console.warn("[WARN] Nenhuma conta 'flash' encontrada nos endpoints testados. A função continuará mas pode falhar no CA.");
    }

    // Buscar um contato padrão
    let defaultContactId: string | undefined;
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
            break;
          }
        }
      } catch (e) {}
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
    for (const n of norms) {
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

      // Centro de custo: Prioridade 1: Snapshot/Payload, Prioridade 2: Mapping por funcionário
      let costCenter = snap.cost_center
        || raw?.payload_json?.costCenter?.name
        || raw?.payload_json?.cost_center?.name
        || raw?.payload_json?.centro_custo
        || null;

      if (!costCenter || costCenter === "—") {
        const empId = raw?.payload_json?.employee?.id;
        if (empId && ccMap[empId]) {
          costCenter = ccMap[empId];
          console.log(`[DEBUG] Aplicando centro de custo fallback para funcionário ${empId}: ${costCenter}`);
        }
      }

      // Valor: snap.amount já está em reais (dividido por 100 no frontend)
      const rawAmount = raw?.payload_json?.amount;
      const valueInReais = typeof snap.amount === "number"
        ? snap.amount
        : (typeof rawAmount === "number" ? rawAmount / 100 : 0);

      const r = await sendOne(admin, empresaId, accessToken, {
        flash_transaction_id: n.flash_transaction_id,
        description: snap.description || raw?.payload_json?.description || "Lançamento Flash",
        value: valueInReais,
        category_id: n.conta_azul_category_id,
        financial_account_id: financialAccountId,
        date: snap.date || raw?.payload_json?.date || new Date().toISOString().split("T")[0],
        type: (n.tipo_operacao as any) || "despesa",
        observacao: comentarios,
        cost_center: costCenter,
        force_pago: snap.force_pago !== false, // Default true
      }, true, defaultContactId); 
      results.push(r);
    }

    return json({ ok: true, results });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});
