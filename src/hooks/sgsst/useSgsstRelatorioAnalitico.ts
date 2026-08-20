import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Relatório analítico anual do PCMSO — NR-07 item 7.6.
 *
 * A norma lista seis itens obrigatórios, e o relatório estava 100% ausente. Aqui
 * cada item é calculado a partir do que o sistema já registra:
 *
 *   a) número de exames clínicos realizados
 *   b) número e tipos de exames complementares
 *   c) estatística de resultados anormais
 *   d) incidência e prevalência de doenças ocupacionais por setor
 *   e) informações das CATs emitidas
 *   f) comparação com o relatório do ano anterior
 *
 * O recorte é por `data_realizacao` do exame, não por data de solicitação: o que
 * a norma pede é o que foi efetivamente realizado no exercício.
 */

export interface ContagemPorChave {
  chave: string;
  total: number;
}

export interface ResumoAnual {
  ano: number;
  /** (a) Consultas médicas — exames de natureza CLINICO. */
  examesClinicos: number;
  /** (b) Exames de apoio — natureza COMPLEMENTAR. */
  examesComplementares: number;
  /** (b) Quebra dos complementares por nome do exame. */
  complementaresPorTipo: ContagemPorChave[];
  /** (c) Classificação dos achados. */
  resultadosNormais: number;
  resultadosAlterados: number;
  resultadosInconclusivos: number;
  /** Exames realizados sem classificação — o relatório não pode fingir que são normais. */
  resultadosNaoClassificados: number;
  /** (d) Alterados por obra, base da incidência. */
  alteradosPorObra: ContagemPorChave[];
  /** ASOs emitidos no ano, por conclusão de aptidão. */
  asosPorAptidao: ContagemPorChave[];
  /** (e) CATs emitidas. */
  cats: number;
  catsPorTipo: ContagemPorChave[];
  catsPorObra: ContagemPorChave[];
  diasAfastamento: number;
  obitos: number;
  /** Trabalhadores ativos, denominador da prevalência. */
  trabalhadoresAtivos: number;
}

export interface RelatorioAnalitico {
  atual: ResumoAnual;
  /** (f) Mesmo cálculo para o ano anterior, para a comparação exigida. */
  anterior: ResumoAnual;
}

/** Percentual de alterados sobre os exames classificados. Ignora o não classificado. */
export function percentualAlterados(r: ResumoAnual): number | null {
  const classificados = r.resultadosNormais + r.resultadosAlterados + r.resultadosInconclusivos;
  if (classificados === 0) return null;
  return (r.resultadosAlterados / classificados) * 100;
}

/**
 * Prevalência: alterados por 100 trabalhadores ativos. Sem trabalhador cadastrado
 * o indicador não existe — devolve null em vez de dividir por zero.
 */
export function prevalenciaPor100(r: ResumoAnual): number | null {
  if (r.trabalhadoresAtivos === 0) return null;
  return (r.resultadosAlterados / r.trabalhadoresAtivos) * 100;
}

/** Variação percentual entre dois anos. Null quando não há base de comparação. */
export function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return ((atual - anterior) / anterior) * 100;
}

function agrupar(valores: (string | null | undefined)[], rotuloVazio: string): ContagemPorChave[] {
  const mapa = new Map<string, number>();
  for (const v of valores) {
    const chave = v?.trim() || rotuloVazio;
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([chave, total]) => ({ chave, total }))
    .sort((a, b) => b.total - a.total || a.chave.localeCompare(b.chave, "pt-BR"));
}

interface ExameLinha {
  natureza: string | null;
  nome_exame: string | null;
  resultado_classificacao: string | null;
  colaborador: { projeto?: { nome: string } | null } | null;
  /** Fallback quando o trabalhador não tem obra: o escopo do programa. */
  pcmso: { projeto?: { nome: string } | null } | null;
}

/**
 * Obra a que o exame se refere.
 *
 * Prioriza a obra do trabalhador, que é onde ele efetivamente trabalha, e cai
 * para a obra do programa quando o cadastro do trabalhador não a tem. Um PCMSO
 * pode ser geral da empresa, então esse fallback nem sempre resolve — daí o
 * rótulo explícito quando não há nenhuma das duas.
 */
function obraDoExame(e: ExameLinha): string | undefined {
  return e.colaborador?.projeto?.nome || e.pcmso?.projeto?.nome || undefined;
}

interface AsoLinha {
  aptidao: string | null;
}

interface CatLinha {
  tipo_cat: string | null;
  dias_afastamento: number | null;
  houve_obito: boolean | null;
  projeto: { nome: string } | null;
  colaborador: { projeto?: { nome: string } | null } | null;
}

async function carregarAno(ano: number): Promise<ResumoAnual> {
  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;

  const [examesRes, asosRes, catsRes, ativosRes] = await Promise.all([
    // Só o que foi efetivamente realizado no exercício.
    supabase
      .from("sgsst_exames" as never)
      .select(
        "natureza, nome_exame, resultado_classificacao, colaborador:sgsst_colaborador_dados(projeto:projetos(nome)), pcmso:sgsst_pcmso(projeto:projetos(nome))"
      )
      .eq("status", "REALIZADO")
      .gte("data_realizacao", inicio)
      .lte("data_realizacao", fim) as never as Promise<{ data: ExameLinha[] | null; error: unknown }>,

    supabase
      .from("sgsst_asos" as never)
      .select("aptidao")
      .gte("data_emissao", inicio)
      .lte("data_emissao", fim) as never as Promise<{ data: AsoLinha[] | null; error: unknown }>,

    supabase
      .from("sgsst_cats" as never)
      .select(
        "tipo_cat, dias_afastamento, houve_obito, projeto:projetos(nome), colaborador:sgsst_colaborador_dados(projeto:projetos(nome))"
      )
      .gte("data_acidente", inicio)
      .lte("data_acidente", fim) as never as Promise<{ data: CatLinha[] | null; error: unknown }>,

    supabase
      .from("sgsst_colaborador_dados" as never)
      .select("id", { count: "exact", head: true })
      .eq("status", "ativo") as never as Promise<{ count: number | null; error: unknown }>,
  ]);

  for (const r of [examesRes, asosRes, catsRes, ativosRes]) {
    if (r.error) throw r.error;
  }

  const exames = examesRes.data ?? [];
  const asos = asosRes.data ?? [];
  const cats = catsRes.data ?? [];

  const complementares = exames.filter((e) => e.natureza !== "CLINICO");
  const alterados = exames.filter((e) => e.resultado_classificacao === "ALTERADO");

  return {
    ano,
    examesClinicos: exames.filter((e) => e.natureza === "CLINICO").length,
    examesComplementares: complementares.length,
    complementaresPorTipo: agrupar(
      complementares.map((e) => e.nome_exame),
      "Sem nome"
    ),
    resultadosNormais: exames.filter((e) => e.resultado_classificacao === "NORMAL").length,
    resultadosAlterados: alterados.length,
    resultadosInconclusivos: exames.filter((e) => e.resultado_classificacao === "INCONCLUSIVO")
      .length,
    resultadosNaoClassificados: exames.filter((e) => !e.resultado_classificacao).length,
    alteradosPorObra: agrupar(alterados.map(obraDoExame), "Obra não informada"),
    asosPorAptidao: agrupar(
      asos.map((a) => a.aptidao),
      "Sem conclusão"
    ),
    cats: cats.length,
    catsPorTipo: agrupar(
      cats.map((c) => c.tipo_cat),
      "Sem tipo"
    ),
    catsPorObra: agrupar(
      cats.map((c) => c.projeto?.nome || c.colaborador?.projeto?.nome),
      "Obra não informada"
    ),
    diasAfastamento: cats.reduce((s, c) => s + (c.dias_afastamento ?? 0), 0),
    obitos: cats.filter((c) => c.houve_obito === true).length,
    trabalhadoresAtivos: ativosRes.count ?? 0,
  };
}

export function useSgsstRelatorioAnalitico(ano: number) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_relatorio_analitico", empresaId, ano],
    enabled: !!empresaId && Number.isFinite(ano),
    queryFn: async (): Promise<RelatorioAnalitico> => {
      // Os dois anos em paralelo: a comparação é item obrigatório, não um extra.
      const [atual, anterior] = await Promise.all([carregarAno(ano), carregarAno(ano - 1)]);
      return { atual, anterior };
    },
  });

  return { relatorio: data ?? null, isLoading, error, refetch };
}
