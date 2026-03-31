import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configurações do Supabase
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Chamar OpenAI para categorizar nova família do ERP
async function categorizarPorIA(categoriaErp: string, descricao: string): Promise<string> {
  // Simulando que se não houver OpenAI key, usaremos fallback mock.
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  
  if (!openAiKey) {
    // Mock rules se não tiver inteligência artificial configurada no ambiente
    const map = categoriaErp.toLowerCase();
    const desc = descricao.toLowerCase();
    
    if (map.includes("folha") || map.includes("salário") || desc.includes("obra")) return "Mão de Obra";
    if (map.includes("aço") || map.includes("cimento") || map.includes("material")) return "Materiais";
    if (map.includes("aluguel") || map.includes("locação") || map.includes("equipamento")) return "Equipamentos";
    if (map.includes("frete") || map.includes("combustível")) return "Transporte";
    if (map.includes("imposto") || map.includes("banco") || map.includes("financeiro")) return "Financeiros";
    return "Indiretos";
  }

  // Integração Real OpenAI
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um analista financeiro de engenharia civil. Classifique a despesa do ERP obrigatoriamente em uma das opções: 
                      "Mão de Obra", "Materiais", "Equipamentos", "Transporte", "Indiretos" ou "Financeiros". Responda APENAS com o nome da categoria.`
          },
          {
            role: "user",
            content: `Categoria ERP original: ${categoriaErp} | Descrição da Despesa: ${descricao}`
          }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (err) {
    console.warn("Falha ao categorizar via IA, usando Indiretos por fallback", err);
    return "Indiretos";
  }
}

// Simulador de Mock Data para despesas da Conta Azul
function gerarMockDespesasContaAzul() {
  const compras = [
    { id: "CA-1001", descricao: "Folha Pagamento Pedreiros", valor: 15400.00, status: "pago", dt: "2026-03-05", cat: "Remuneração e Salários", centro_custo: "Obra Alpha" },
    { id: "CA-1002", descricao: "Aço CA-50 10mm", valor: 8500.00, status: "pago", dt: "2026-03-10", cat: "Fornecedores Material Const", centro_custo: "Obra Alpha" },
    { id: "CA-1003", descricao: "Locação Betoneira", valor: 1200.00, status: "pago", dt: "2026-03-12", cat: "Aluguéis Ferramentas", centro_custo: "Obra Alpha" },
    { id: "CA-1004", descricao: "Alimentação Peões", valor: 3200.00, status: "pago", dt: "2026-03-15", cat: "Copa e Cozinha", centro_custo: "Obra Alpha" },
    { id: "CA-1005", descricao: "Frete Caminhão Munck", valor: 800.00, status: "pago", dt: "2026-03-16", cat: "Fretes e Carretos", centro_custo: "Obra Beta" },
    { id: "CA-1006", descricao: "Tarifa TED Bradesco", valor: 45.00, status: "pago", dt: "2026-03-20", cat: "Despesas Bancárias", centro_custo: "Geral (Sem Vínculo)" },
    { id: "CA-1007", descricao: "Areia Grossa", valor: 450.00, status: "pago", dt: "2026-03-22", cat: "Fornecedores Material Const", centro_custo: "Obra Alpha" },
    { id: "CA-1008", descricao: "Aluguel Retroescavadeira", valor: 5000.00, status: "pendente", dt: "2026-03-25", cat: "Aluguéis Ferramentas", centro_custo: "Obra Alpha" },
    { id: "CA-1009", descricao: "Pagto Empreiteiro Concreto", valor: 12500.00, status: "pago", dt: "2026-03-28", cat: "Serviços Terceiros", centro_custo: "Obra Alpha" },
  ];
  return compras;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, mockParams } = await req.json();

    if (action === "sync_contaazul") {
      console.log("Iniciando fluxo Conta Azul (Mock Mode)...");
      const comprasErp = mockParams?.itens || gerarMockDespesasContaAzul();

      // Buscar mapeamento existente e sites
      const { data: mapeamentos } = await supabase.from("mapeamento_categorias_erp").select("*");
      const mapCategorias = new Map(mapeamentos?.map(m => [m.categoria_erp, m.categoria_interna]));

      const { data: sites } = await supabase.from("sites").select("id, nome, projeto_id");

      let processadas = 0;
      for (const despesa of comprasErp) {
        // Encontrar categoria interna (De/Para)
        let categoriaInterna = mapCategorias.get(despesa.cat);
        if (!categoriaInterna) {
           categoriaInterna = await categorizarPorIA(despesa.cat, despesa.descricao);
           // Salva a decisão da IA para não perguntar de novo
           if (categoriaInterna) {
              await supabase.from("mapeamento_categorias_erp").insert({
                 categoria_erp: despesa.cat,
                 categoria_interna: categoriaInterna,
                 criado_por_ia: true
              });
              mapCategorias.set(despesa.cat, categoriaInterna);
           }
        }

        // Tentar cruzar o "Centro de Custo" com os Sites
        let siteId = null;
        let projetoId = null;
        if (despesa.centro_custo) {
           // Encontrar site pelo nome
           const siteEnc = sites?.find(s => 
              s.nome.toLowerCase() === despesa.centro_custo.toLowerCase() ||
              despesa.centro_custo.toLowerCase().includes(s.nome.toLowerCase())
           );
           if (siteEnc) {
             siteId = siteEnc.id;
             projetoId = siteEnc.projeto_id;
           }
        }

        // Fazer Upsert no banco (erp_id is unique)
        await supabase.from("custo_real_erp").upsert({
           erp_id: despesa.id,
           descricao: despesa.descricao,
           valor: despesa.valor,
           data_pagamento: despesa.status === "pago" ? despesa.dt : null,
           data_competencia: despesa.dt,
           status_erp: despesa.status,
           categoria_erp: despesa.cat,
           categoria_interna: categoriaInterna || "Indiretos",
           centro_custo: despesa.centro_custo,
           projeto_id: projetoId,
           site_id: siteId
        }, { onConflict: "erp_id" });

        processadas++;
      }

      return new Response(JSON.stringify({ success: true, message: `Sincronizadas ${processadas} contas do ERP.` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
