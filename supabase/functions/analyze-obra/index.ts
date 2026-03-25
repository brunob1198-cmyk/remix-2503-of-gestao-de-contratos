import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { obraData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um consultor especialista em gestão de obras e construção civil. Analise os dados da obra fornecidos e retorne uma análise estruturada.

Você DEVE responder usando a ferramenta "analise_obra" com dados estruturados. Seja objetivo, direto e use números concretos dos dados fornecidos.

Diretrizes:
- Resumo: Síntese executiva da situação atual da obra em 2-3 parágrafos
- Riscos: Liste riscos reais baseados nos dados (mínimo 2, máximo 5)
- Desvios de custo: Analise desvios entre custo real e esperado com percentuais
- Produtividade: Avalie ritmo de produção, médias e tendências
- Recomendações: Ações práticas e específicas (mínimo 3, máximo 6)
- Alertas críticos: Apenas itens que necessitam ação imediata`;

    const userPrompt = `Analise os seguintes dados da obra:\n\n${JSON.stringify(obraData, null, 2)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analise_obra",
              description: "Retorna análise estruturada da obra",
              parameters: {
                type: "object",
                properties: {
                  resumo: { type: "string", description: "Resumo executivo da obra" },
                  riscos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        titulo: { type: "string" },
                        descricao: { type: "string" },
                        severidade: { type: "string", enum: ["alta", "media", "baixa"] },
                      },
                      required: ["titulo", "descricao", "severidade"],
                    },
                  },
                  desvios_custo: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        categoria: { type: "string" },
                        descricao: { type: "string" },
                        percentual: { type: "number" },
                        impacto: { type: "string", enum: ["positivo", "negativo", "neutro"] },
                      },
                      required: ["categoria", "descricao", "percentual", "impacto"],
                    },
                  },
                  produtividade: {
                    type: "object",
                    properties: {
                      avaliacao_geral: { type: "string" },
                      pontos_fortes: { type: "array", items: { type: "string" } },
                      pontos_fracos: { type: "array", items: { type: "string" } },
                      tendencia: { type: "string", enum: ["melhorando", "estavel", "piorando"] },
                    },
                    required: ["avaliacao_geral", "pontos_fortes", "pontos_fracos", "tendencia"],
                  },
                  recomendacoes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        acao: { type: "string" },
                        prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
                        impacto_esperado: { type: "string" },
                      },
                      required: ["acao", "prioridade", "impacto_esperado"],
                    },
                  },
                  alertas_criticos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        alerta: { type: "string" },
                        acao_imediata: { type: "string" },
                      },
                      required: ["alerta", "acao_imediata"],
                    },
                  },
                },
                required: ["resumo", "riscos", "desvios_custo", "produtividade", "recomendacoes", "alertas_criticos"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analise_obra" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Configurações > Workspace > Uso." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao processar análise de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Resposta da IA inválida" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analise = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ analise }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-obra error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
