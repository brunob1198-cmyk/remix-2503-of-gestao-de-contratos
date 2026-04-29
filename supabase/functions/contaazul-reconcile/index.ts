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
    // 1. Se não tiver ID mas tiver protocolo, tenta recuperar o ID pelo protocolo
    if (!conta_azul_transaction_id && conta_azul_protocolo) {
      console.log(`[Reconcile] Buscando ID para protocolo ${conta_azul_protocolo}...`);
      const protResp = await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/protocolos/${conta_azul_protocolo}`, {
        headers: { 
          Authorization: `Bearer ${accessToken}`, 
          Accept: "application/json" 
        }
      });
      
      const protText = await protResp.text();
      console.log(`[Reconcile] Resposta protocolo ${conta_azul_protocolo} (HTTP ${protResp.status}): ${protText}`);

      if (protResp.ok) {
        let protData;
        try {
          protData = JSON.parse(protText);
        } catch {
          return { status: "invalid_json_protocol", detail: protText };
        }

        if (protData.status === "SUCCESS") {
          conta_azul_transaction_id = protData.resourceId || protData.id;
          if (conta_azul_transaction_id) {
            console.log(`[Reconcile] Sucesso! ID encontrado: ${conta_azul_transaction_id}`);
            await supabase.from("flash_integration_logs").update({ conta_azul_transaction_id }).eq("id", log.id);
          }
        } else if (protData.status === "ERROR") {
          console.warn(`[Reconcile] Protocolo com erro:`, protData.errors || protData.message);
          return { status: "ca_protocol_error", detail: protData.errors || protData.message };
        } else {
          console.log(`[Reconcile] Protocolo ainda ${protData.status}`);
          return { status: "still_pending", detail: protData.status };
        }
      } else {
        // Se 404, talvez o protocolo expirou ou não existe mais, tentamos buscar pelo external_id no CA se possível?
        // Conta Azul API v1 não permite buscar por external_id facilmente em eventos-financeiros.
        return { status: "http_protocol_error", code: protResp.status, detail: protText };
      }
    }

    if (!conta_azul_transaction_id) {
      // Tenta forçar o status para erro se não conseguimos resolver
      return { status: "no_ca_id" };
    }

    // 2. Buscar parcelas do lançamento
    console.log(`[Reconcile] Buscando parcelas para ID ${conta_azul_transaction_id}...`);
    const resp = await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/${conta_azul_transaction_id}/parcelas`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[Reconcile] Erro ao buscar parcelas para ${conta_azul_transaction_id} (HTTP ${resp.status}): ${errText}`);
      if (resp.status === 404) return { status: "not_found_in_ca" };
      throw new Error(`Erro API CA: ${resp.status}`);
    }

    const parcelas = await resp.json();
    const parcela = parcelas[0];
    if (!parcela) {
       console.warn(`[Reconcile] Nenhuma parcela encontrada para ${conta_azul_transaction_id}`);
       return { status: "no_parcela" };
    }

    console.log(`[Reconcile] Parcela encontrada: ${parcela.id}, status: ${parcela.status}`);

    // 3. Verificar status da parcela
    if (parcela.status === "PAID" || parcela.baixado) {
       console.log(`[Reconcile] Parcela já está paga. Finalizando...`);
       await supabase.from("flash_integration_logs").update({ 
         status: "ENVIADO", 
         reconciliado: true, 
         reconciliado_at: new Date().toISOString() 
       }).eq("id", log.id);
       
       await supabase.from("flash_normalizacao").update({ 
         status: "enviado",
         enviado_at: new Date().toISOString(),
         motivo: `Reconciliado via Job: Pago no Conta Azul (ID: ${conta_azul_transaction_id})`
       }).eq("flash_transaction_id", flash_transaction_id);

       return { status: "already_paid" };
    }

    // 4. Tentar realizar a baixa se não estiver pago
    console.log(`[Reconcile] Parcela aberta. Buscando dados de normalização...`);
    const { data: norm } = await supabase
      .from("flash_normalizacao")
      .select("conta_azul_account_id, conta_azul_payload, tipo_operacao")
      .eq("flash_transaction_id", flash_transaction_id)
      .maybeSingle();

    if (!norm) return { status: "norm_not_found" };

    const transactionDate = norm.conta_azul_payload?.date || new Date().toISOString().split("T")[0];
    const transactionValue = norm.conta_azul_payload?.amount || 0;

    console.log(`[Reconcile] Realizando baixa para parcela ${parcela.id} (Valor: ${transactionValue}, Data: ${transactionDate})...`);
    const baixaResp = await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/parcelas/${parcela.id}/baixa`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data_pagamento: transactionDate,
        conta_financeira: norm.conta_azul_account_id,
        composicao_valor: { valor_bruto: transactionValue }
      })
    });

    if (baixaResp.ok) {
      console.log(`[Reconcile] Baixa realizada com sucesso!`);
      await supabase.from("flash_integration_logs").update({ 
        status: "ENVIADO",
        reconciliado: true, 
        reconciliado_at: new Date().toISOString()
      }).eq("id", log.id);

      await supabase.from("flash_normalizacao").update({ 
        status: "enviado",
        enviado_at: new Date().toISOString(),
        motivo: `Reconciliado via Job: Baixa realizada com sucesso (ID: ${conta_azul_transaction_id})`
      }).eq("flash_transaction_id", flash_transaction_id);

      return { status: "reconciled_with_baixa" };
    } else {
      const err = await baixaResp.text();
      console.error(`[Reconcile] Falha ao realizar baixa: ${err}`);
      return { status: "baixa_failed", error: err };
    }
  } catch (e: any) {
    console.error(`[Reconcile] Erro crítico: ${e.message}`);
    return { status: "error", error: e.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    console.log(`[Reconcile] Iniciando job de reconciliação para logs anteriores a ${twoMinutesAgo}...`);

    const { data: logs, error: logsErr } = await supabase
      .from("flash_integration_logs")
      .select("*")
      .eq("evento", "send_transaction")
      .eq("reconciliado", false)
      .lt("created_at", twoMinutesAgo)
      .or(`status.eq.ENVIADO,status.eq.erro,status.eq.REABERTO`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (logsErr) throw logsErr;

    const filteredLogs = logs?.filter(log => 
      log.status === "ENVIADO" || 
      (log.erro && (log.erro.includes("processado") || log.erro.includes("Protocolo") || log.erro.includes("PENDING")))
    ) || [];

    console.log(`[Reconcile] Encontrados ${logs?.length || 0} logs candidatos, ${filteredLogs.length} filtrados para processamento.`);

    if (filteredLogs.length === 0) {
      return new Response(JSON.stringify({ message: "Nada para processar", candidates: logs?.length }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const results = [];
    const tokenCache = new Map();

    for (const log of filteredLogs) {
      if (!tokenCache.has(log.empresa_id)) {
        try {
          const token = await getValidAccessToken(supabase, log.empresa_id);
          tokenCache.set(log.empresa_id, token);
        } catch (e) {
          console.error(`[Reconcile] Erro ao obter token para empresa ${log.empresa_id}: ${e.message}`);
          results.push({ id: log.id, status: "token_error", error: e.message });
          continue;
        }
      }
      
      const res = await verifyAndReconcile(supabase, log, tokenCache.get(log.empresa_id));
      results.push({ id: log.id, ...res });
    }
    
    console.log(`[Reconcile] Job finalizado. Resultados:`, JSON.stringify(results));
    return new Response(JSON.stringify({ processed: filteredLogs.length, results }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (e: any) {
    console.error(`[Reconcile] Erro global: ${e.message}`);
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});