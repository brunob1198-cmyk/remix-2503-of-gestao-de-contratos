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

async function refreshAccessToken(supabase: any, empresaId: string, tokenData: any): Promise<string> {
  const clientId = Deno.env.get("CONTAAZUL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("CONTAAZUL_CLIENT_SECRET")!;

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

  if (error || !data) throw new Error("Conta Azul não conectado.");

  const expiresAt = new Date(data.expires_at);
  if (expiresAt > new Date(Date.now() + 120000)) return data.access_token;

  return await refreshAccessToken(supabase, empresaId, data);
}

async function verifyAndReconcile(supabase: any, log: any, accessToken: string) {
  let { conta_azul_transaction_id, conta_azul_protocolo, flash_transaction_id, empresa_id } = log;
  
  try {
    // 1. Tentar resolver ID via protocolo
    if (!conta_azul_transaction_id && conta_azul_protocolo) {
      console.log(`[Reconcile] Buscando ID para protocolo ${conta_azul_protocolo}...`);
      // Descobrir se é pagar ou receber para usar o endpoint correto do protocolo
      const { data: normType } = await supabase
        .from("flash_normalizacao")
        .select("tipo_operacao")
        .eq("flash_transaction_id", flash_transaction_id)
        .maybeSingle();
      
      const protocolPath = (normType?.tipo_operacao === "receita") 
        ? "contas-a-receber/protocolos" 
        : "contas-a-pagar/protocolos";

      console.log(`[Reconcile] Buscando ID para protocolo ${conta_azul_protocolo} via ${protocolPath}...`);
      
      const protResp = await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/${protocolPath}/${conta_azul_protocolo}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
      });
      
      if (protResp.ok) {
        const protData = await protResp.json();
        console.log(`[Reconcile] Resposta protocolo ${conta_azul_protocolo}:`, JSON.stringify(protData));
        if (protData.status === "SUCCESS") {
          conta_azul_transaction_id = protData.resourceId || protData.id;
          if (conta_azul_transaction_id) {
            await supabase.from("flash_integration_logs").update({ conta_azul_transaction_id }).eq("id", log.id);
          }
        }
      } else {
        console.warn(`[Reconcile] Erro HTTP ao buscar protocolo ${conta_azul_protocolo}: ${protResp.status}`);
      }
    }

    // 2. Fallback: Busca por valor e data se ainda não temos ID
    if (!conta_azul_transaction_id) {
      console.log(`[Reconcile] Tentando busca fallback para ${flash_transaction_id}...`);
      const { data: norm } = await supabase
        .from("flash_normalizacao")
        .select("conta_azul_payload, tipo_operacao, description:conta_azul_payload->>description")
        .eq("flash_transaction_id", flash_transaction_id)
        .maybeSingle();

      if (norm) {
        const date = norm.conta_azul_payload?.date;
        const value = norm.conta_azul_payload?.amount;
        
        if (date && value) {
          const path = (norm.tipo_operacao === "receita") ? "contas-a-receber" : "contas-a-pagar";
          // Usando /buscar conforme documentação V2
          const searchUrl = `${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/${path}/buscar?vencimento_inicio=${date}&vencimento_fim=${date}&valor=${value}`;
          
          console.log(`[Reconcile] Tentando busca fallback em ${searchUrl}`);
          const searchResp = await fetch(searchUrl, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
          });
          
          if (searchResp.ok) {
            const results = await searchResp.json();
            // A resposta do buscar do CA V2 costuma ser uma lista de parcelas
            console.log(`[Reconcile] Busca CA retornou ${results?.length || 0} resultados.`);
            
            if (Array.isArray(results)) {
              const match = results.find((r: any) => {
                const descMatch = r.descricao?.toLowerCase().includes(norm.description?.toLowerCase() || "") ||
                                 norm.description?.toLowerCase().includes(r.descricao?.toLowerCase() || "");
                return descMatch;
              });
              
              if (match) {
                // No buscar, o id retornado costuma ser o id do EVENTO (ou tem o evento_id)
                conta_azul_transaction_id = match.evento_id || match.id || match.uuid;
                console.log(`[Reconcile] Encontrado via fallback! ID: ${conta_azul_transaction_id}`);
                await supabase.from("flash_integration_logs").update({ conta_azul_transaction_id }).eq("id", log.id);
              }
            }
          } else {
            const errText = await searchResp.text();
            console.error(`[Reconcile] Erro na busca fallback (HTTP ${searchResp.status}): ${errText}`);
          }
        }
      }
    }

    if (!conta_azul_transaction_id) return { status: "no_ca_id" };

    // 3. Verificar status e realizar baixa
    const resp = await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/${conta_azul_transaction_id}/parcelas`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
    });

    if (!resp.ok) return { status: "not_found_in_ca" };

    const parcelas = await resp.json();
    const parcela = parcelas[0];
    if (!parcela) return { status: "no_parcela" };

    if (parcela.status === "PAID" || parcela.baixado) {
       await supabase.from("flash_integration_logs").update({ 
         status: "ENVIADO", 
         reconciliado: true, 
         reconciliado_at: new Date().toISOString() 
       }).eq("id", log.id);
       
       await supabase.from("flash_normalizacao").update({ 
         status: "enviado",
         enviado_at: new Date().toISOString(),
         motivo: `Reconciliado via Job: Pago no Conta Azul`
       }).eq("flash_transaction_id", flash_transaction_id);

       return { status: "already_paid" };
    }

    const { data: normFinal } = await supabase
      .from("flash_normalizacao")
      .select("conta_azul_account_id, conta_azul_payload")
      .eq("flash_transaction_id", flash_transaction_id)
      .maybeSingle();

    if (!normFinal) return { status: "norm_not_found" };

    const transactionDate = normFinal.conta_azul_payload?.date || new Date().toISOString().split("T")[0];
    const transactionValue = normFinal.conta_azul_payload?.amount || 0;

    const baixaResp = await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/parcelas/${parcela.id}/baixa`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data_pagamento: transactionDate,
        conta_financeira: normFinal.conta_azul_account_id,
        composicao_valor: { valor_bruto: transactionValue }
      })
    });

    if (baixaResp.ok) {
      await supabase.from("flash_integration_logs").update({ 
        status: "ENVIADO",
        reconciliado: true, 
        reconciliado_at: new Date().toISOString()
      }).eq("id", log.id);

      await supabase.from("flash_normalizacao").update({ 
        status: "enviado",
        enviado_at: new Date().toISOString(),
        motivo: `Reconciliado via Job: Baixa realizada com sucesso`
      }).eq("flash_transaction_id", flash_transaction_id);

      return { status: "reconciled_with_baixa" };
    } else {
      return { status: "baixa_failed" };
    }
  } catch (e: any) {
    return { status: "error", error: e.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Para resolver o problema imediato do usuário, vamos ser bem permissivos no tempo
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    
    const { data: logs, error: logsErr } = await supabase
      .from("flash_integration_logs")
      .select("*")
      .eq("evento", "send_transaction")
      .eq("reconciliado", false)
      .lt("created_at", oneMinuteAgo)
      .or(`status.eq.ENVIADO,status.eq.erro,status.eq.REABERTO`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (logsErr) throw logsErr;

    const filteredLogs = logs?.filter(log => 
      log.status === "ENVIADO" || 
      (log.erro && (log.erro.includes("processado") || log.erro.includes("Protocolo") || log.erro.includes("PENDING")))
    ) || [];

    if (filteredLogs.length === 0) return new Response(JSON.stringify({ message: "Nada para processar" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const results = [];
    const tokenCache = new Map();

    for (const log of filteredLogs) {
      if (!tokenCache.has(log.empresa_id)) {
        try {
          const token = await getValidAccessToken(supabase, log.empresa_id);
          tokenCache.set(log.empresa_id, token);
        } catch (e) {
          results.push({ id: log.id, status: "token_error", error: e.message });
          continue;
        }
      }
      const res = await verifyAndReconcile(supabase, log, tokenCache.get(log.empresa_id));
      results.push({ id: log.id, ...res });
    }
    
    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});