import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  calcularConvocacao,
  faixaSeAplica,
  idadeEm,
  ordenarPorUrgencia,
  diagnosticoDaFilaVazia,
  type SituacaoConvocacao,
} from "@/utils/sgsstConvocacao";
import type { FaixaEtariaPcmso } from "@/hooks/sgsst/useSgsstPcmso";
import { incoerenciaDoExame } from "@/utils/sgsstExameCoerencia";

/**
 * Painel de convocação: quem precisa de exame e quando.
 *
 * Antes o módulo só exibia contadores; saber quem chamar continuava em planilha.
 * Aqui o cruzamento é feito de verdade: para cada trabalhador ativo, cada exame
 * previsto no PCMSO que se aplica à função e à faixa etária dele, comparado com a
 * data do último exame daquele nome.
 *
 * O cruzamento é montado no cliente a partir de três consultas, e não numa query
 * só, porque é um produto cartesiano com regra de faixa etária no meio — algo que
 * o PostgREST não expressa. As três consultas são enxutas e o volume é o de
 * trabalhadores ativos, não o de exames históricos.
 */

export interface ItemConvocacao {
  /** Chave estável para lista: trabalhador + exame. */
  chave: string;
  colaboradorId: string;
  trabalhador: string;
  cpf: string | null;
  funcao: string | null;
  obra: string | null;
  idade: number | null;
  nomeExame: string;
  tipoExame: string;
  periodicidadeMeses: number;
  faixaEtaria: FaixaEtariaPcmso | null;
  ultimaRealizacao: string | null;
  proximoVencimento: Date | null;
  situacao: SituacaoConvocacao;
  diasRestantes: number | null;
  /** Já existe exame agendado para este trabalhador com este nome. */
  jaAgendado: boolean;
  dataAgendada: string | null;
  /**
   * Já existe SOLICITAÇÃO aberta, mesmo sem data marcada.
   *
   * É o estado logo depois de emitir a guia de encaminhamento: o exame foi pedido
   * e ainda não tem data na clínica. Sem este campo a fila continuava mandando
   * convocar quem já foi convocado — e não havia como distinguir o que já foi
   * providenciado do que nem começou.
   */
  jaSolicitado: boolean;
  dataSolicitacao: string | null;
  /**
   * Existe exame deste nome marcado como REALIZADO mas SEM data.
   *
   * O calculo da periodicidade exige a data, entao esse exame nao entra. Sem este
   * sinal a fila dizia "nunca realizado" ao lado de um exame que a lista mostra
   * como realizado, e nada explicava a contradicao.
   */
  realizadoSemData: boolean;
}

interface ColabLinha {
  id: string;
  cpf: string | null;
  data_nascimento: string | null;
  funcao_id: string | null;
  nome: string | null;
  profile: { nome: string } | null;
  recurso: { nome: string } | null;
  funcao: { id: string; nome: string } | null;
  projeto: { nome: string } | null;
}

interface PrevistoLinha {
  nome_exame: string;
  tipo_exame: string;
  periodicidade_meses: number | null;
  funcao_id: string | null;
  faixa_etaria: FaixaEtariaPcmso | null;
  pcmso: { status: string | null } | null;
}

interface ExameFeitoLinha {
  colaborador_id: string;
  nome_exame: string;
  data_realizacao: string | null;
  data_solicitacao: string | null;
  data_agendada: string | null;
  status: string | null;
}

export function useSgsstConvocacao(options?: { hoje?: Date }) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_convocacao", empresaId],
    enabled: !!empresaId,
    // A base muda quando um exame é lançado; meio minuto evita recalcular a cada
    // navegação sem deixar o painel obsoleto.
    staleTime: 1000 * 30,
    queryFn: async (): Promise<{ itens: ItemConvocacao[]; porQueVazia: string }> => {
      const [colabRes, previstosRes, feitosRes] = await Promise.all([
        supabase
          .from("sgsst_colaborador_dados" as never)
          .select(
            "id, cpf, data_nascimento, funcao_id, nome, profile:profiles(nome), recurso:recursos(nome), funcao:sgsst_funcoes(id, nome), projeto:projetos(nome)"
          )
          .eq("status", "ativo") as never as Promise<{
          data: ColabLinha[] | null;
          error: unknown;
        }>,

        // Só programas vigentes definem o que é exigido hoje.
        supabase
          .from("sgsst_pcmso_exames" as never)
          .select(
            "nome_exame, tipo_exame, periodicidade_meses, funcao_id, faixa_etaria, pcmso:sgsst_pcmso(status)"
          ) as never as Promise<{ data: PrevistoLinha[] | null; error: unknown }>,

        supabase
          .from("sgsst_exames" as never)
          .select("colaborador_id, nome_exame, data_realizacao, data_agendada, data_solicitacao, status") as never as Promise<{
          data: ExameFeitoLinha[] | null;
          error: unknown;
        }>,
      ]);

      for (const r of [colabRes, previstosRes, feitosRes]) {
        if (r.error) throw r.error;
      }

      const colaboradores = colabRes.data ?? [];
      const previstosTodos = previstosRes.data ?? [];
      const previstos = previstosTodos.filter((p) => p.pcmso?.status === "ATIVO");
      const feitos = feitosRes.data ?? [];

      // Última realização por trabalhador + nome do exame.
      const ultimaPor = new Map<string, string>();
      // Agendamento futuro por trabalhador + nome do exame.
      const agendadoPor = new Map<string, string>();
      // Solicitacao aberta por trabalhador + nome do exame, com ou sem data.
      const solicitadoPor = new Map<string, string>();
      // Marcado REALIZADO e sem data: nao entra no calculo, e a fila precisa dizer.
      const realizadoSemDataPor = new Set<string>();

      for (const f of feitos) {
        const chave = `${f.colaborador_id}::${f.nome_exame}`;

        if (f.status === "REALIZADO" && f.data_realizacao) {
          const atual = ultimaPor.get(chave);
          if (!atual || f.data_realizacao > atual) ultimaPor.set(chave, f.data_realizacao);
        } else if (
          incoerenciaDoExame({ status: f.status, dataRealizacao: f.data_realizacao })
            ?.gravidade === "IMPEDE"
        ) {
          realizadoSemDataPor.add(chave);
        }

        if (f.data_agendada && (f.status === "AGENDADO" || f.status === "PENDENTE")) {
          const atual = agendadoPor.get(chave);
          if (!atual || f.data_agendada < atual) agendadoPor.set(chave, f.data_agendada);
        }

        // Solicitação aberta, COM OU SEM data marcada.
        //
        // O mapa de agendamento acima exige `data_agendada`, e por isso a
        // solicitação recém-criada — o estado logo depois de emitir a guia — era
        // invisível aqui: a fila continuava mandando convocar quem já tinha sido
        // convocado. Registrar a solicitação separadamente é o que permite
        // distinguir "ainda não pedi" de "pedi e falta marcar".
        if (f.status === "PENDENTE" || f.status === "AGENDADO") {
          const atual = solicitadoPor.get(chave);
          const data = f.data_solicitacao ?? "";
          // Vence a mais ANTIGA: é ela que mede há quanto tempo o pedido está
          // aberto, que é o que interessa acompanhar.
          if (atual === undefined || (data && data < atual)) {
            solicitadoPor.set(chave, data);
          }
        }
      }

      const hoje = options?.hoje ?? new Date();
      const itens: ItemConvocacao[] = [];

      for (const c of colaboradores) {
        const idade = idadeEm(c.data_nascimento, hoje);
        const nome = c.profile?.nome || c.recurso?.nome || c.nome || "Trabalhador sem nome";

        for (const p of previstos) {
          // Exame previsto para uma função específica só vale para quem a exerce.
          if (p.funcao_id && p.funcao_id !== c.funcao_id) continue;
          if (!faixaSeAplica(p.faixa_etaria, idade)) continue;

          const chave = `${c.id}::${p.nome_exame}`;
          const ultima = ultimaPor.get(chave) ?? null;
          const agendada = agendadoPor.get(chave) ?? null;

          const calc = calcularConvocacao({
            ultimaRealizacao: ultima,
            periodicidadeMeses: p.periodicidade_meses,
            hoje,
          });

          itens.push({
            chave,
            colaboradorId: c.id,
            trabalhador: nome,
            cpf: c.cpf,
            funcao: c.funcao?.nome ?? null,
            obra: c.projeto?.nome ?? null,
            idade,
            nomeExame: p.nome_exame,
            tipoExame: p.tipo_exame,
            periodicidadeMeses: p.periodicidade_meses ?? 0,
            faixaEtaria: p.faixa_etaria,
            ultimaRealizacao: ultima,
            proximoVencimento: calc.proximoVencimento,
            situacao: calc.situacao,
            diasRestantes: calc.diasRestantes,
            jaAgendado: !!agendada,
            dataAgendada: agendada,
            realizadoSemData: realizadoSemDataPor.has(chave),
            jaSolicitado: solicitadoPor.has(chave),
            dataSolicitacao: solicitadoPor.get(chave) || null,
          });
        }
      }

      return {
        itens: ordenarPorUrgencia(itens),
        // Guardado no resultado da consulta porque so aqui se sabe POR QUE a fila
        // ficou vazia — e a tela precisa dizer isso em vez de listar as tres
        // condicoes e deixar o usuario adivinhar qual falhou.
        porQueVazia: diagnosticoDaFilaVazia({
          colaboradoresAtivos: colaboradores.length,
          previstosTotal: previstosTodos.length,
          previstosAtivos: previstos.length,
        }),
      };
    },
  });

  const itens = data?.itens ?? [];

  return {
    itens,
    /** Contagens por situação, para os cartões do painel. */
    resumo: {
      vencidos: itens.filter((i) => i.situacao === "VENCIDO").length,
      venceEsteMes: itens.filter((i) => i.situacao === "VENCE_ESTE_MES").length,
      aVencer: itens.filter((i) => i.situacao === "A_VENCER").length,
      emDia: itens.filter((i) => i.situacao === "EM_DIA").length,
      semBase: itens.filter((i) => i.situacao === "SEM_BASE").length,
      agendados: itens.filter((i) => i.jaAgendado).length,
    },
    /** Explica a fila vazia, nomeando a condicao que faltou. */
    porQueVazia: data?.porQueVazia ?? "",
    isLoading,
    error,
    refetch,
  };
}
