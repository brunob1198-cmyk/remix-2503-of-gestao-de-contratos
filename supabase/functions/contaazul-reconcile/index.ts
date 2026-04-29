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
  const { conta_azul_transaction_id, flash_transaction_id, empresa_id } = log;
  
  if (!conta_azul_transaction_id) return { status: "no_ca_id" };

  try {
    // 1. Verificar se o lançamento existe e buscar parcelas
    const resp = await fetch(`${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/${conta_azul_transaction_id}/parcelas`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!resp.ok) {
      if (resp.status === 404) return { status: "not_found_in_ca" };
      throw new Error(`Erro API CA: ${resp.status}`);
    }

    const parcelas = await resp.json();
    const parcela = parcelas[0];
    if (!parcela) return { status: "no_parcela" };

    // 2. Verificar se já está baixado (pago)
    if (parcela.status === "PAID" || parcela.baixado) {
       await supabase.from("flash_integration_logs").update({ 
         reconciliado: true, 
         reconciliado_at: new Date().toISOString() 
       }).eq("id", log.id);
       return { status: "already_paid" };
    }

    // 3. Se não estiver baixado, tentar realizar a baixa (Re-tentativa de baixa)
    const { data: norm } = await supabase
      .from("flash_normalizacao")
      .select("conta_azul_account_id, conta_azul_payload")
      .eq("flash_transaction_id", flash_transaction_id)
      .maybeSingle();

    if (!norm) return { status: "norm_not_found" };

    const transactionDate = norm.conta_azul_payload?.date || new Date().toISOString().split("T")[0];
    const transactionValue = norm.conta_azul_payload?.amount || 0;

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
      await supabase.from("flash_integration_logs").update({ 
        reconciliado: true, 
        reconciliado_at: new Date().toISOString(),
        response: { ...log.response, reconciliation_baixa: "success" }
      }).eq("id", log.id);
      return { status: "reconciled_with_baixa" };
    } else {
      const err = await baixaResp.text();
      return { status: "baixa_failed", error: err };
    }
  } catch (e: any) {
    return { status: "error", error: e.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 1. Buscar transações marcadas como "ENVIADO" mas não reconciliadas há mais de 5 minutos
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: logs, error: logsErr } = await supabase
      .from("flash_integration_logs")
      .select("*")
      .eq("status", "ENVIADO")
      .eq("evento", "send_transaction")
      .is("reconciliado", null)
      .lt("created_at", fiveMinutesAgo)
      .limit(20);

    if (logsErr) throw logsErr;
    if (!logs || logs.length === 0) return new Response(JSON.stringify({ message: "Nada para processar" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const results = [];
    const tokenCache = new Map();

    for (const log of logs) {
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

    // 2. Tentar re-enviar transações que deram erro mas estão "enviado" na normalização (inconsistência)
    // Ou simplesmente transações que ficaram presas.
    
    return new Response(JSON.stringify({ processed: logs.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});