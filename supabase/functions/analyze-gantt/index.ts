import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { atividades } = await req.json();
    
    if (!atividades || !Array.isArray(atividades)) {
      return new Response(
        JSON.stringify({ error: 'Lista de atividades é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `Você é um gerente de projetos sênior especialista em análise de cronogramas e Gantt.
Sua missão é avaliar uma lista de atividades em execução, comparar o previsto vs realizado, e sugerir uma nova data de fim ("data_fim_prevista") realista baseada no ritmo (produção) atual.

Regras da Análise:
1. Se a atividade nem iniciou e já passou da data de início, ela está atrasada em (hoje - data_inicio) dias. Desloque a data_fim para refletir isso.
2. Se a atividade está em andamento, compare: "qtd_produzida" / (dias passados desde "data_inicio"). Isso te dá o "ritmo real".
   - Se ritmo real < "producao_diaria_prevista", a nova duração total deve ser "quantidade_total" / ritmo real. Adicione essa duração à "data_inicio" para obter a nova "data_fim_prevista".
   - Se o ritmo real for 0 e a "data_inicio" está no passado, considere um ritmo mínimo seguro para recalcular ou adie a data baseada no atraso.
3. Não mexa na "data_inicio" a menos que precise postergá-la logicamente por dependências (assuma que as dependências não estão no escopo num primeiro momento, concentre-se nas datas contidas na própria atividade).
4. Retorne APENAS um JSON no formato especificado. Nada mais.

Formato esperado de saída (JSON Array):
[
  {
    "id": "uuid-da-atividade",
    "nova_data_fim": "2026-04-10"
  }
]`;

    const hoje = new Date().toISOString().split('T')[0];
    const userPrompt = `Abaixo estão as atividades do projeto. Hoje é dia ${hoje}. Analise cada uma.

ATENÇÃO: Mantenha exatamente o mesmo "id" recebido.
Retorne um JSON com a "nova_data_fim". Formato de saída deve ser estritamente YYYY-MM-DD.

Atividades:
${JSON.stringify(atividades.map((a: any) => ({
      id: a.id,
      nome: a.nome,
      data_inicio: a.data_inicio,
      data_fim_prevista: a.data_fim_prevista,
      quantidade_total: a.quantidade_total,
      producao_diaria_prevista: a.producao_diaria_prevista,
      qtd_produzida: a.qtd_produzida || 0
    })), null, 2)}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao seu workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      throw new Error(`AI Gateway error: ${response.status} ${errorText}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    let parsedResult;
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsedResult = JSON.parse(jsonString);
    } catch (parseError) {
      throw new Error('Failed to parse AI response: ' + content);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsedResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-gantt:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
