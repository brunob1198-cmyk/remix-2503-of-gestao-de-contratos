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
    // Verify authentication is now handled after creating the service client


    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader || '' } },
    }).auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Contract extraction requested by user:', user.id);

    const { pdfBase64, fileName, contentType, filePath } = await req.json();

    let effectiveType = contentType || 'application/pdf';
    let contractDocument: { type: string; file?: { file_data: string; filename?: string }; image_url?: { url: string } } | null = null;

    if (filePath) {
      console.log('Creating signed URL for file from storage:', filePath);
      const { data: signedData, error: signedError } = await supabase.storage
        .from('contratos')
        .createSignedUrl(filePath, 60 * 15);

      if (signedError || !signedData?.signedUrl) {
        console.error('Error creating signed URL:', signedError);
        throw new Error(`Failed to access file from storage: ${signedError?.message || 'signed URL not generated'}`);
      }

      contractDocument = {
        type: 'file',
        file: {
          file_data: signedData.signedUrl,
          filename: fileName || 'contrato.pdf',
        },
      };
    } else if (pdfBase64) {
      contractDocument = {
        type: 'image_url',
        image_url: {
          url: `data:${effectiveType};base64,${pdfBase64}`,
        },
      };
    }

    if (!contractDocument) {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `Você é um assistente especializado em extrair dados estruturados de Contratos e Aditivos contratuais de engenharia/serviços.

IMPORTANTE: Analise o documento rigorosamente. NUNCA INVENTE DADOS. Se um campo não for encontrado, retorne null. Resuma textos muito longos de forma objetiva sem perder a essência. 
Extraia todos os dados solicitados, organizados nas seguintes propriedades:

1. DADOS DO CONTRATO:
   - valor_total: Retorne O VALOR como número ou string com a moeda (ex: 150000.00). Use null se não achar.
   - prazo_inicio: Formato ISO (YYYY-MM-DD) ou null. Tente deduzir da  data de assinatura ou um termo explícito de vigência inicial.
   - prazo_fim: Formato ISO (YYYY-MM-DD) ou null. Deduzido com base no início e a vigência, ou término expresso.
   
2. LISTA DE CLIENTES: (Múltiplos clientes ou contratantes)
   - Uma lista de CNPJs no formato de array de strings.
   
3. TEXTOS LONGOS E CLÁUSULAS GERAIS (Faça um resumo de até 300 caracteres cada do que achar):
   - escopo: Resumo do que está sendo contratado (O objeto do contrato).
   - condicoes_pagamento: Resumo de como e quando ocorrerão os pagamentos (ex: 30D DDF, 50% entrada).
   - garantias: Regras de garantia de execução (ex: Seguros, cauções, retenção técnica de x%).
   - liberacao_garantias: Regras de quando e como liberar a garantia/retenção.
   - medicoes: Como ocorrem as medições para pagamento (ex: Mensal, por etapa).
   - multas: Regras e percentuais de multas por atraso ou rescisão.
   - reajuste: Regras de reajuste (ex: IPCA a cada 12 meses).
   - observacoes: Outras informações vitais não mapeadas nas seções anteriores.

Retorne os dados em formato JSON estruturado. Use null para campos não encontrados.
O JSON deve seguir exatamente este formato:

{
  "valor_total": "string ou null",
  "prazo_inicio": "string ou null",
  "prazo_fim": "string ou null",
  "cnpjs_clientes": ["string"],
  "escopo": "string ou null",
  "condicoes_pagamento": "string ou null",
  "garantias": "string ou null",
  "liberacao_garantias": "string ou null",
  "medicoes": "string ou null",
  "multas": "string ou null",
  "reajuste": "string ou null",
  "observacoes": "string ou null"
}`;

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
          { 
            role: 'user', 
            content: [
              {
                type: 'text',
                text: `Analise este documento de Contrato/Aditivo e extraia todos os dados estruturados conforme as regras. Nome do arquivo: ${fileName}`
              },
              contractDocument
            ]
          }
        ],
        max_tokens: 1200,
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
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    let extractedData;
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      extractedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      throw new Error('Failed to parse extracted data');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData,
        fileName 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-contract function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
