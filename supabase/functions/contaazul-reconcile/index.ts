import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTAAZUL_API = "https://api-v2.contaazul.com";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function refreshAccessToken(supabase: any, empresaId: string, tokenData: any): Promise<string> {
  const clientId = Deno.env.get("CONTAAZUL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("CONTAAZUL_CLIENT_SECRET")!;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokenData.refresh_token,
  });

  const resp = await fetch("https://auth.contaazul.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: body.toString(),
  });

  if (!resp.ok) throw new Error("Falha ao renovar token");

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

  if (error || !data) throw new Error("Conta Azul não conectado");

  const expiresAt = new Date(data.expires_at);
  if (expiresAt > new Date(Date.now() + 120000)) return data.access_token;

  return await refreshAccessToken(supabase, empresaId, data);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Busca logs pendentes de reconciliação (ENVIADO, não reconciliado, criados há mais de 1 minuto)
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { data: logs, error: logsError } = await supabase
      .from("flash_integration_logs")
      .select("*")
      .eq("status", "ENVIADO")
      .eq("reconciliado", false)
      .lt("created_at", oneMinuteAgo)
      .limit(20);

    if (logsError) throw logsError;
    if (!logs?.length) return new Response(JSON.stringify({ message: "Nenhum log pendente" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const results = [];

    // Agrupa por empresa para otimizar tokens
    const logsByEmpresa = logs.reduce((acc: any, log: any) => {
      if (!acc[log.empresa_id]) acc[log.empresa_id] = [];
      acc[log.empresa_id].push(log);
      return acc;
    }, {});

    for (const empresaId in logsByEmpresa) {
      try {
        const token = await getValidAccessToken(supabase, empresaId);
        const empresaLogs = logsByEmpresa[empresaId];

        for (const log of empresaLogs) {
          // Busca no Conta Azul
          // Como o protocolo é assíncrono, buscamos pela descrição e valor no dia da competência
          const payload = log.request?.payload;
          if (!payload) continue;

          const dataCompetencia = payload.data_competencia;
          const valor = payload.valor;
          const descricao = payload.descricao;

          // Busca transações financeiras no Conta Azul
          const url = `${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/contas-a-pagar?data_competencia_inicio=${dataCompetencia}&data_competencia_fim=${dataCompetencia}`;
          const resp = await fetch(url, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
          });

          if (resp.ok) {
            const data = await resp.json();
            const items = Array.isArray(data) ? data : (data.itens || []);
            
            // Procura correspondência
            const match = items.find((item: any) => 
              Math.abs(item.valor - valor) < 0.01 && 
              item.descricao.includes(descricao)
            );

            if (match) {
              await supabase
                .from("flash_integration_logs")
                .update({ 
                  reconciliado: true, 
                  reconciliado_at: new Date().toISOString(),
                  conta_azul_transaction_id: match.id || match.uuid
                })
                .eq("id", log.id);
              results.push({ id: log.id, status: "reconciliado", match_id: match.id });
            } else {
              results.push({ id: log.id, status: "não encontrado" });
            }
          }
        }
      } catch (e) {
        console.error(`Erro reconciliação empresa ${empresaId}:`, e);
      }
    }

    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});