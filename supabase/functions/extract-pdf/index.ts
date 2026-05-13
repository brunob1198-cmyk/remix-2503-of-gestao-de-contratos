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

    console.log('PDF extraction requested by user:', user.id);

    const { pdfBase64, fileName } = await req.json();
    
    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'PDF content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `Você é um assistente especializado em extrair dados estruturados de documentos PDF de pedidos de compra, notas fiscais e orçamentos de obra.

IMPORTANTE: O layout dos documentos pode variar significativamente entre diferentes fornecedores e sistemas ERP. Use heurísticas inteligentes para identificar os campos, mesmo que não sigam um padrão rígido ou rótulos explícitos.

PROCEDIMENTO DE EXTRAÇÃO:
1. Identifique o tipo de documento (Pedido, Nota Fiscal, Orçamento).
2. Procure por identificadores de projeto em qualquer lugar do texto (ex: códigos no formato "OXXX.XX", "Job XXX", "Prj XXX", "Centro de Custo").
3. Localize o nome do Site/Local. Se não houver o rótulo "Site", procure por descrições de locais de entrega, nomes de subestações ou códigos de localidade que acompanhem o projeto.
4. Em tabelas de itens, extraia colunas mesmo que os cabeçalhos sejam abreviados ou incomuns. Use o contexto das linhas para deduzir qual coluna é a quantidade, preço unitário, etc.
5. Para valores monetários, identifique o separador decimal e de milhar corretamente.

DADOS A EXTRAIR:
1. DADOS DO PEDIDO:
   - Número do pedido/nota
   - Número do projeto (heurística: códigos como "O010.25")
   - Nome do site (identificado por contexto/proximidade se não houver rótulo)
   - Data do documento
   - Condição de pagamento
   - Valor total (procure por "Total Geral", "Líquido", "Valor da Nota")
   - Data de entrega

2. DADOS DO FORNECEDOR/COMPRADOR: Razão Social, CNPJ, Endereço.

3. ITENS (Lista detalhada): Código, Descrição, Qtd, Unidade, Preço Unitário, Total Item.

Retorne os dados em formato JSON estruturado. Use null para campos não encontrados.
O JSON deve seguir exatamente este formato:

{
  "pedido": {
    "numero": "string ou null",
    "numero_projeto": "string ou null",
    "nome_site": "string ou null",
    "data": "string ou null",
    "condicao_pagamento": "string ou null",
    "valor_total": "string ou null",
    "data_entrega": "string ou null"
  },
  "fornecedor": {
    "razao_social": "string ou null",
    "cnpj": "string ou null",
    "endereco": "string ou null",
    "cidade_estado": "string ou null",
    "contato": "string ou null"
  },
  "comprador": {
    "razao_social": "string ou null",
    "cnpj": "string ou null",
    "endereco": "string ou null"
  },
  "itens": [
    {
      "codigo": "string ou null",
      "descricao": "string",
      "quantidade": "string ou null",
      "unidade": "string ou null",
      "preco_unitario": "string ou null",
      "valor_total": "string ou null"
    }
  ],
  "heuristica_aplicada": "booleano indicando se campos foram deduzidos por contexto",
  "tipo_documento_detectado": "string"
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
                text: `Analise este documento PDF e extraia todos os dados estruturados. Nome do arquivo: ${fileName}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
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
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Try to parse JSON from the response
    let extractedData;
    try {
      // Find JSON in the response (might be wrapped in markdown code blocks)
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
    console.error('Error in extract-pdf function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
