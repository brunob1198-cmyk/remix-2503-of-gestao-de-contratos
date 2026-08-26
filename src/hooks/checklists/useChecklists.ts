import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  calcularPontuacao,
  pontosDaResposta,
  ehNaoConforme,
} from "@/utils/checklistPontuacao";

export type TipoRespostaChecklist =
  | "Sim_Nao"
  | "Conforme_NaoConforme"
  | "Conforme_NaoConforme_NA"
  | "Sim_Nao_NA"
  | "OK_NaoOK"
  | "Escala"
  | "Numero"
  | "Texto"
  | "Data"
  | "Hora"
  | "Selecao"
  | "MultiplaSelecao";

export interface ChecklistModelo {
  id: string;
  empresa_id: string;
  codigo?: string | null;
  nome: string;
  categoria: string;
  descricao?: string | null;
  status: "ativo" | "inativo" | "rascunho";
  periodicidade_sugerida?: string | null;
  responsavel_id?: string | null;
  projeto_id?: string | null;
  area_id?: string | null;
  tipo_aplicacao?: string | null;
  exigir_geolocalizacao?: boolean | null;
  latitude_alvo?: number | null;
  longitude_alvo?: number | null;
  raio_permitido_metros?: number | null;
  bloquear_fora_raio?: boolean | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined
  projeto?: { id: string; codigo: string; nome: string } | null;
  area?: { id: string; nome: string } | null;
  responsavel?: { id: string; nome: string | null } | null;
  secoes?: ChecklistSecao[];
}

export interface ChecklistSecao {
  id: string;
  empresa_id: string;
  modelo_id: string;
  titulo: string;
  ordem: number;
  created_at?: string;
  itens?: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  empresa_id: string;
  secao_id: string;
  titulo: string;
  descricao?: string | null;
  tipo_resposta: TipoRespostaChecklist;
  opcoes_selecao?: string[] | null;
  obrigatorio: boolean;
  ordem: number;
  exigir_comentario_nao_conforme: boolean;
  exigir_foto_nao_conforme: boolean;
  gerar_plano_acao_nao_conforme: boolean;
  peso_pontuacao: number;
  /**
   * Item impeditivo: nao conformidade nele reprova o checklist inteiro,
   * independente do percentual. Peso gradua a nota; critico veta.
   */
  critico?: boolean | null;
  created_at?: string;
}

export interface ChecklistAplicacao {
  id: string;
  empresa_id: string;
  modelo_id: string;
  codigo?: string | null;
  status: "em_andamento" | "concluido" | "reaberto" | "cancelado";
  aplicador_id?: string | null;
  responsavel_id?: string | null;
  projeto_id?: string | null;
  area_id?: string | null;
  colaborador_id?: string | null;
  funcao_id?: string | null;
  pgr_id?: string | null;
  apr_id?: string | null;
  pt_id?: string | null;
  inspecao_id?: string | null;
  incidente_id?: string | null;
  nao_conformidade_id?: string | null;
  data_aplicacao?: string;
  data_conclusao?: string | null;
  pontuacao_obtida: number;
  pontuacao_maxima: number;
  percentual_conformidade: number;
  total_itens: number;
  total_conforme: number;
  total_nao_conforme: number;
  total_na: number;
  /**
   * Veredito por item impeditivo, separado do percentual. Um checklist pode ter
   * 97,5% de conformidade e estar reprovado — e as duas informacoes precisam
   * caber na mesma linha da lista.
   */
  reprovado_por_item_critico?: boolean | null;
  itens_criticos_nao_conformes?: number | null;
  observacoes_gerais?: string | null;
  created_at?: string;
  // Joined
  modelo?: ChecklistModelo | null;
  projeto?: { id: string; codigo: string; nome: string } | null;
  area?: { id: string; nome: string } | null;
  aplicador?: { id: string; nome: string | null } | null;
  responsavel?: { id: string; nome: string | null } | null;
  respostas?: ChecklistResposta[];
  planos_acao?: ChecklistPlanoAcao[];
}

export interface ChecklistResposta {
  id: string;
  empresa_id: string;
  aplicacao_id: string;
  item_id: string;
  resposta_valor: string;
  comentario?: string | null;
  is_critico?: boolean;
  is_nao_conforme?: boolean;
  pontos_obtidos?: number;
  created_at?: string;
  evidencias?: ChecklistEvidencia[];
  item?: ChecklistItem | null;
}

export interface ChecklistEvidencia {
  id: string;
  empresa_id: string;
  aplicacao_id: string;
  resposta_id?: string | null;
  r2_url: string;
  r2_key?: string | null;
  nome_arquivo?: string | null;
  tipo_mime?: string | null;
  tamanho?: number | null;
  created_at?: string;
}

export interface ChecklistPlanoAcao {
  id: string;
  empresa_id: string;
  aplicacao_id: string;
  resposta_id?: string | null;
  item_id?: string | null;
  codigo?: string | null;
  o_que_fazer: string;
  por_que?: string | null;
  onde?: string | null;
  quando_prazo?: string | null;
  quem_responsavel_id?: string | null;
  como_fazer?: string | null;
  quanto_custo?: number | null;
  prioridade: "Baixa" | "Media" | "Alta" | "Critica";
  status: "Aberto" | "Em_Andamento" | "Concluido" | "Atrasado" | "Cancelado";
  evidencia_conclusao_r2_url?: string | null;
  data_conclusao?: string | null;
  validado_por_id?: string | null;
  data_validacao?: string | null;
  nao_conformidade_sgsst_id?: string | null;
  created_at?: string;
  // Joined
  quem_responsavel?: { id: string; nome: string | null } | null;
  validado_por?: { id: string; nome: string | null } | null;
  aplicacao?: ChecklistAplicacao | null;
  item?: ChecklistItem | null;
}

// 1. MODELOS HOOK
export function useChecklistModelos() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: modelos = [], isLoading, error: queryError, refetch } = useQuery({
    queryKey: ["checklist_modelos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("checklist_modelos" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          area:areas(id, nome),
          responsavel:profiles!checklist_modelos_responsavel_id_fkey(id, nome),
          secoes:checklist_secoes(
            *,
            itens:checklist_itens(*)
          )
        `)
        .order("created_at", { ascending: false })
        // Teto explícito. A consulta traz o modelo INTEIRO — seções e itens de cada
        // um —, então o payload cresce por item cadastrado, não por modelo. Sem
        // limite, o PostgREST cortava no teto padrão sem avisar; com ele, ao menos
        // o corte é conhecido. Modelo é catálogo: quinhentos é folga larga.
        .limit(500) as any);

      if (error) throw error;
      return (data as ChecklistModelo[]) || [];
    },
  });

  const isTableMissing = Boolean(
    queryError && ((queryError as any).code === "PGRST205" || (queryError as any).message?.includes("schema cache"))
  );

  const createModelo = useMutation({
    mutationFn: async (input: {
      nome: string;
      categoria?: string;
      codigo?: string;
      descricao?: string;
      periodicidade_sugerida?: string;
      responsavel_id?: string;
      projeto_id?: string;
      area_id?: string;
      tipo_aplicacao?: string;
      secoes: Array<{
        titulo: string;
        ordem: number;
        itens: Array<{
          titulo: string;
          descricao?: string;
          tipo_resposta: TipoRespostaChecklist;
          opcoes_selecao?: string[];
          obrigatorio: boolean;
          ordem: number;
          exigir_comentario_nao_conforme?: boolean;
          exigir_foto_nao_conforme?: boolean;
          gerar_plano_acao_nao_conforme?: boolean;
          peso_pontuacao?: number;
          critico?: boolean;
        }>;
      }>;
    }) => {
      const cleanUuid = (id?: string | null) => (id && id !== "todas" && id !== "todos" && id.trim() !== "" ? id : null);

      // 1. Insert Modelo
      const { data: modelo, error: mErr } = await (supabase
        .from("checklist_modelos" as any)
        .insert({
          empresa_id: empresaId,
          nome: input.nome,
          categoria: input.categoria || "Geral",
          codigo: input.codigo || `CHK-${Math.floor(1000 + Math.random() * 9000)}`,
          descricao: input.descricao,
          periodicidade_sugerida: input.periodicidade_sugerida || "Diario",
          responsavel_id: cleanUuid(input.responsavel_id),
          projeto_id: cleanUuid(input.projeto_id),
          area_id: cleanUuid(input.area_id),
          tipo_aplicacao: input.tipo_aplicacao || "Geral",
          created_by: profile?.id,
          status: "ativo",
        })
        .select()
        .single() as any);

      if (mErr) {
        if (mErr.message?.includes("schema cache") || mErr.code === "PGRST205") {
          throw new Error("As tabelas de checklist estão sendo sincronizadas no banco. Por favor, execute a migration SQL no Supabase ou aguarde a atualização do cache do PostgREST.");
        }
        throw mErr;
      }

      // 2. Insert Secoes & Itens
      for (const secao of input.secoes) {
        const { data: secaoDb, error: sErr } = await (supabase
          .from("checklist_secoes" as any)
          .insert({
            empresa_id: empresaId,
            modelo_id: modelo.id,
            titulo: secao.titulo,
            ordem: secao.ordem,
          })
          .select()
          .single() as any);

        if (sErr) throw sErr;

        if (secao.itens && secao.itens.length > 0) {
          const itensToInsert = secao.itens.map((it) => ({
            empresa_id: empresaId,
            secao_id: secaoDb.id,
            titulo: it.titulo,
            descricao: it.descricao,
            tipo_resposta: it.tipo_resposta,
            opcoes_selecao: it.opcoes_selecao || null,
            obrigatorio: it.obrigatorio ?? true,
            ordem: it.ordem,
            exigir_comentario_nao_conforme: it.exigir_comentario_nao_conforme ?? true,
            exigir_foto_nao_conforme: it.exigir_foto_nao_conforme ?? false,
            gerar_plano_acao_nao_conforme: it.gerar_plano_acao_nao_conforme ?? true,
            peso_pontuacao: it.peso_pontuacao ?? 1.0,
            critico: it.critico ?? false,
          }));

          const { error: iErr } = await (supabase.from("checklist_itens" as any).insert(itensToInsert) as any);
          if (iErr) throw iErr;
        }
      }

      return modelo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist_modelos"] });
      toast.success("Modelo de checklist criado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao criar modelo: ${err.message || err}`);
    },
  });

  const duplicateModelo = useMutation({
    mutationFn: async (modeloId: string) => {
      if (!empresaId) throw new Error("Empresa não identificada.");

      const { data: orig, error: fetchErr } = await (supabase
        .from("checklist_modelos" as any)
        .select(`*, secoes:checklist_secoes(*, itens:checklist_itens(*))`)
        .eq("id", modeloId)
        .single() as any);

      if (fetchErr) throw fetchErr;

      return createModelo.mutateAsync({
        nome: `${orig.nome} (Cópia)`,
        categoria: orig.categoria,
        codigo: `${orig.codigo}-CP`,
        descricao: orig.descricao,
        periodicidade_sugerida: orig.periodicidade_sugerida,
        secoes: (orig.secoes || []).map((sec: any) => ({
          titulo: sec.titulo,
          ordem: sec.ordem,
          itens: (sec.itens || []).map((it: any) => ({
            titulo: it.titulo,
            descricao: it.descricao,
            tipo_resposta: it.tipo_resposta,
            opcoes_selecao: it.opcoes_selecao,
            obrigatorio: it.obrigatorio,
            ordem: it.ordem,
            exigir_comentario_nao_conforme: it.exigir_comentario_nao_conforme,
            exigir_foto_nao_conforme: it.exigir_foto_nao_conforme,
            gerar_plano_acao_nao_conforme: it.gerar_plano_acao_nao_conforme,
            peso_pontuacao: it.peso_pontuacao,
            critico: it.critico ?? false,
          })),
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist_modelos"] });
      toast.success("Modelo duplicado com sucesso!");
    },
  });

  const deleteModelo = useMutation({
    mutationFn: async (id: string) => {
      // 1. First delete dependent applications to avoid FK constraint errors
      const { data: apps } = await (supabase
        .from("checklist_aplicacoes" as any)
        .select("id")
        .eq("modelo_id", id) as any);

      if (apps && apps.length > 0) {
        for (const app of apps) {
          // Trigger cascading delete for application (responses, evidences, etc)
          await supabase.from("checklist_aplicacoes" as any).delete().eq("id", app.id);
        }
      }

      // 2. Delete sections and items (cascading is usually handled by DB, but we ensure here)
      const { error } = await (supabase.from("checklist_modelos" as any).delete().eq("id", id) as any);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist_modelos"] });
      queryClient.invalidateQueries({ queryKey: ["checklist_aplicacoes"] });
      toast.success("Modelo e suas aplicações removidos com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao excluir modelo: ${err.message || err}`);
    },
  });

  return {
    modelos,
    isLoading,
    isTableMissing,
    refetch,
    createModelo,
    duplicateModelo,
    deleteModelo,
  };
}

// 2. APLICAÇÕES HOOK
/**
 * Aplicações de checklist.
 *
 * A consulta trazia TODAS as aplicações da empresa, sem limite, com os planos de
 * ação embutidos. O PostgREST corta no teto padrão em silêncio — e aplicação de
 * checklist é o registro que mais acumula nesta tela: uma por inspeção, por turno,
 * por frente de serviço. A lista aparecia incompleta sem dizer que era incompleta.
 */
export function useChecklistAplicacoes(params?: { page?: number; pageSize?: number }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 50;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["checklist_aplicacoes", empresaId, page, pageSize],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error, count } = await (supabase
        .from("checklist_aplicacoes" as any)
        .select(`
          *,
          modelo:checklist_modelos(id, nome, codigo, categoria),
          projeto:projetos(id, codigo, nome),
          area:areas(id, nome),
          aplicador:profiles!checklist_aplicacoes_aplicador_id_fkey(id, nome),
          responsavel:profiles!checklist_aplicacoes_responsavel_id_fkey(id, nome),
          planos_acao:checklist_planos_acao(*)
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1) as any);

      if (error) throw error;

      const rows = (data as ChecklistAplicacao[]) || [];
      return { rows, total: count ?? rows.length };
    },
  });

  const createAplicacao = useMutation({
    mutationFn: async (input: {
      modelo_id: string;
      projeto_id?: string;
      area_id?: string;
      responsavel_id?: string;
      colaborador_id?: string;
      pgr_id?: string;
      apr_id?: string;
      pt_id?: string;
      inspecao_id?: string;
    }) => {
      if (!empresaId) throw new Error("Empresa não identificada.");

      const codigo = `APP-${Math.floor(10000 + Math.random() * 90000)}`;

      const { data, error } = await (supabase
        .from("checklist_aplicacoes" as any)
        .insert({
          empresa_id: empresaId,
          modelo_id: input.modelo_id,
          codigo,
          aplicador_id: profile?.id,
          responsavel_id: input.responsavel_id || null,
          projeto_id: input.projeto_id || null,
          area_id: input.area_id || null,
          colaborador_id: input.colaborador_id || null,
          pgr_id: input.pgr_id || null,
          apr_id: input.apr_id || null,
          pt_id: input.pt_id || null,
          inspecao_id: input.inspecao_id || null,
          status: "em_andamento",
          data_aplicacao: new Date().toISOString(),
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as ChecklistAplicacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist_aplicacoes"] });
      toast.success("Aplicação de checklist iniciada!");
    },
  });

  const finishAplicacao = useMutation({
    mutationFn: async (input: {
      aplicacao_id: string;
      observacoes_gerais?: string;
      respostas: Array<{
        item_id: string;
        resposta_valor: string;
        comentario?: string;
        is_critico?: boolean;
        is_nao_conforme?: boolean;
        pontos_obtidos?: number;
        /** Peso do item, vindo do modelo. Sem ele o cálculo trata tudo como 1. */
        peso_pontuacao?: number | null;
        /** Item impeditivo, vindo do modelo. */
        critico?: boolean | null;
        /** Forma antiga: só as URLs. Mantida para a fila offline já gravada. */
        evidencias_urls?: string[];
        /** Forma nova: cada foto com a coordenada do instante em que foi tirada. */
        evidencias?: Array<{
          url: string;
          origem?: "CAMERA" | "ARQUIVO" | null;
          capturadaEm?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          precisao?: number | null;
          motivoSemGeo?: string | null;
        }>;
      }>;
      planos_acao: Array<{
        item_id?: string;
        o_que_fazer: string;
        por_que?: string;
        onde?: string;
        quando_prazo?: string;
        quem_responsavel_id?: string;
        como_fazer?: string;
        quanto_custo?: number;
        prioridade?: "Baixa" | "Media" | "Alta" | "Critica";
      }>;
    }) => {
      // A pontuação usa o `peso_pontuacao` do item, que antes era ignorado: o
      // cálculo somava 1.0 fixo e "extintor obstruído" pesava igual a "quadro de
      // avisos atualizado". A regra está em `checklistPontuacao`, com teste.
      const pontuacao = calcularPontuacao(input.respostas);

      /**
       * Falhas de gravação, acumuladas para serem RELATADAS.
       *
       * Antes cada erro caía num `console.warn` e a mutação seguia até devolver um
       * objeto sintético — o `onSuccess` então anunciava "Checklist concluído e
       * enviado com sucesso!" mesmo quando nada tinha sido gravado. Quem estava na
       * obra ia embora achando que havia registro.
       *
       * Agora as respostas individuais são tentadas uma a uma (uma falhar não deve
       * derrubar as outras) e, no fim, o que falhou vira exceção.
       */
      const falhas: string[] = [];

      for (const r of input.respostas) {
        if (!r.item_id || !r.resposta_valor) continue;

        if (empresaId && input.aplicacao_id && !input.aplicacao_id.startsWith("app_")) {
          try {
            // Insert Resposta safely
            const { data: respDb, error: rErr } = await (supabase
              .from("checklist_respostas" as any)
              .insert({
                empresa_id: empresaId,
                aplicacao_id: input.aplicacao_id,
                item_id: r.item_id,
                resposta_valor: r.resposta_valor,
                comentario: r.comentario || null,
                // Copia a marcação `critico` do item. A coluna existia desde o
                // início e era gravada sempre como falso, porque nada a alimentava:
                // a tela nunca preenchia `is_critico` no payload.
                is_critico: r.critico ?? r.is_critico ?? false,
                is_nao_conforme: ehNaoConforme(r),
                // Vale o peso do item, não 1.0 fixo.
                pontos_obtidos: pontosDaResposta(r),
              })
              .select()
              .single() as any);

            if (rErr) {
              falhas.push(`resposta do item ${r.item_id}: ${rErr.message ?? rErr}`);
            } else if (respDb && (r.evidencias?.length || r.evidencias_urls?.length)) {
              /**
               * Duas formas aceitas de propósito.
               *
               * `evidencias` é a nova, com a coordenada capturada no instante da
               * foto. `evidencias_urls` é a antiga, apenas as URLs — e continua
               * aceita porque itens já enfileirados no IndexedDB de algum celular
               * foram gravados nesse formato. Trocar a forma sem aceitar a antiga
               * deixaria esses checklists sem sincronizar para sempre.
               */
              const comGeo = (r.evidencias ?? []).map((ev) => ({
                empresa_id: empresaId,
                aplicacao_id: input.aplicacao_id,
                resposta_id: respDb.id,
                r2_url: ev.url,
                r2_key: ev.url,
                latitude: ev.latitude ?? null,
                longitude: ev.longitude ?? null,
                precisao_metros: ev.precisao ?? null,
                capturada_em: ev.capturadaEm ?? null,
                origem_captura: ev.origem ?? null,
                // A coluna é excludente com a coordenada no banco: só vai o motivo
                // quando de fato não houve ponto.
                motivo_sem_geo: ev.latitude ? null : ev.motivoSemGeo ?? null,
              }));

              const legado = (r.evidencias_urls ?? []).map((url) => ({
                empresa_id: empresaId,
                aplicacao_id: input.aplicacao_id,
                resposta_id: respDb.id,
                r2_url: url,
                r2_key: url,
              }));

              const evidInserts = comGeo.length > 0 ? comGeo : legado;

              const { error: eErr } = await (supabase
                .from("checklist_evidencias" as any)
                .insert(evidInserts) as any);

              // A foto é a prova do desvio. Perdê-la em silêncio esvazia o
              // registro exatamente no item que mais precisa dele.
              if (eErr) {
                falhas.push(
                  `evidência(s) do item ${r.item_id}: ${eErr.message ?? eErr}`
                );
              }
            }
          } catch (respErr) {
            falhas.push(
              `resposta do item ${r.item_id}: ${(respErr as Error).message ?? respErr}`
            );
          }
        }
      }

      // Insert Planos de Ação 5W2H
      if (empresaId && input.aplicacao_id && !input.aplicacao_id.startsWith("app_")) {
        for (const pa of input.planos_acao) {
          try {
            const { error: paErrDb } = await (supabase
              .from("checklist_planos_acao" as any)
              .insert({
                empresa_id: empresaId,
                aplicacao_id: input.aplicacao_id,
                item_id: pa.item_id || null,
                // O código é gerado no banco, sequencial por empresa e ano. Antes
                // era um sorteio de quatro dígitos sem unicidade: colisão passava
                // de 50% de chance perto do centésimo plano, e dois planos com o
                // mesmo código destroem a rastreabilidade do que precisa ser
                // rastreado.
                o_que_fazer: pa.o_que_fazer,
                por_que: pa.por_que || null,
                onde: pa.onde || null,
                quando_prazo: pa.quando_prazo || null,
                quem_responsavel_id: pa.quem_responsavel_id || null,
                como_fazer: pa.como_fazer || null,
                quanto_custo: pa.quanto_custo || null,
                prioridade: pa.prioridade || "Media",
                status: "Aberto",
              }) as any);

            if (paErrDb) {
              falhas.push(`plano de ação "${pa.o_que_fazer}": ${paErrDb.message ?? paErrDb}`);
            }
          } catch (paErr) {
            falhas.push(
              `plano de ação "${pa.o_que_fazer}": ${(paErr as Error).message ?? paErr}`
            );
          }
        }
      }

      // Aplicação apenas local (offline) não tem o que atualizar no servidor: a
      // fila de sincronização cuida dela.
      const apenasLocal =
        !empresaId || !input.aplicacao_id || input.aplicacao_id.startsWith("app_");

      if (apenasLocal) {
        return {
          id: input.aplicacao_id,
          empresa_id: empresaId || "",
          modelo_id: "",
          status: "concluido",
          pontuacao_obtida: pontuacao.pontuacaoObtida,
          pontuacao_maxima: pontuacao.pontuacaoMaxima,
          percentual_conformidade: pontuacao.percentualConformidade ?? 0,
          total_itens: pontuacao.totalItens,
          total_conforme: pontuacao.totalConforme,
          total_nao_conforme: pontuacao.totalNaoConforme,
          total_na: pontuacao.totalNa,
          reprovado_por_item_critico: pontuacao.reprovadoPorItemCritico,
          itens_criticos_nao_conformes: pontuacao.itensCriticosNaoConformes,
          observacoes_gerais: input.observacoes_gerais || null,
        } as ChecklistAplicacao;
      }

      const { data: updated, error: uErr } = await (supabase
        .from("checklist_aplicacoes" as any)
        .update({
          status: "concluido",
          data_conclusao: new Date().toISOString(),
          pontuacao_obtida: pontuacao.pontuacaoObtida,
          pontuacao_maxima: pontuacao.pontuacaoMaxima,
          // Nulo quando nada foi avaliado. Antes o código gravava 100% nesse
          // caso — um checklist inteiro marcado "não aplicável" aparecia como
          // conformidade total, que é o oposto do que os dados dizem.
          percentual_conformidade: pontuacao.percentualConformidade,
          total_itens: pontuacao.totalItens,
          total_conforme: pontuacao.totalConforme,
          total_nao_conforme: pontuacao.totalNaoConforme,
          total_na: pontuacao.totalNa,
          // O veredito nao substitui o percentual: os dois convivem na mesma linha.
          reprovado_por_item_critico: pontuacao.reprovadoPorItemCritico,
          itens_criticos_nao_conformes: pontuacao.itensCriticosNaoConformes,
          observacoes_gerais: input.observacoes_gerais || null,
        })
        .eq("id", input.aplicacao_id)
        .select()
        .single() as any);

      // A falha do fechamento é a mais grave e não pode ser engolida: sem ela a
      // aplicação fica "em andamento" para sempre, e o usuário foi embora com um
      // aviso de sucesso.
      if (uErr) {
        throw new Error(
          `Não foi possível fechar o checklist: ${uErr.message ?? uErr}. As respostas já gravadas foram mantidas — reabra a aplicação e conclua novamente.`
        );
      }

      if (falhas.length > 0) {
        throw new Error(
          `O checklist foi fechado, mas ${falhas.length} registro(s) não foram gravados: ${falhas
            .slice(0, 3)
            .join("; ")}${falhas.length > 3 ? "; …" : ""}`
        );
      }

      return updated as ChecklistAplicacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist_aplicacoes"] });
      queryClient.invalidateQueries({ queryKey: ["checklist_planos_acao"] });
      toast.success("Checklist concluído e enviado com sucesso!");
    },
    // Sem este `onError`, qualquer falha desta mutação era anunciada como sucesso.
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Erro ao concluir o checklist.", { duration: 10000 });
    },
  });

  const deleteAplicacao = useMutation({
    mutationFn: async (id: string) => {
      // The database schema should have CASCADE, but we ensure deletion of sub-resources
      // like responses and evidences if necessary, or just rely on the main delete if CASCADE is active.
      // Given the error in the print, we need to ensure the deletion flow is clean.
      const { error } = await (supabase.from("checklist_aplicacoes" as any).delete().eq("id", id) as any);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist_aplicacoes"] });
      toast.success("Aplicação de checklist excluída!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao excluir aplicação: ${err.message || err}`);
    },
  });

  return {
    aplicacoes: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    refetch,
    createAplicacao,
    finishAplicacao,
    deleteAplicacao,
  };
}

// 3. PLANOS DE AÇÃO 5W2H HOOK
/**
 * Planos de ação 5W2H.
 *
 * Mesma correção das aplicações: a consulta trazia todos os planos da empresa sem
 * limite. Plano de ação acumula mais rápido que aplicação — um checklist com dez
 * não conformidades gera dez planos.
 */
export function useChecklistPlanosAcao(params?: { page?: number; pageSize?: number }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 50;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["checklist_planos_acao", empresaId, page, pageSize],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error, count } = await (supabase
        .from("checklist_planos_acao" as any)
        .select(`
          *,
          quem_responsavel:profiles!checklist_planos_acao_quem_responsavel_id_fkey(id, nome),
          validado_por:profiles!checklist_planos_acao_validado_por_id_fkey(id, nome),
          aplicacao:checklist_aplicacoes(
            id, codigo, projeto_id, area_id, modelo:checklist_modelos(nome)
          ),
          item:checklist_itens(id, titulo)
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1) as any);

      if (error) throw error;

      const rows = (data as ChecklistPlanoAcao[]) || [];
      return { rows, total: count ?? rows.length };
    },
  });

  const updatePlanoAcao = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ChecklistPlanoAcao> & { id: string }) => {
      const { data, error } = await (supabase
        .from("checklist_planos_acao" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as ChecklistPlanoAcao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist_planos_acao"] });
      toast.success("Plano de Ação atualizado!");
    },
  });

  const convertToNaoConformidade = useMutation({
    mutationFn: async (plano: ChecklistPlanoAcao) => {
      if (!empresaId) throw new Error("Empresa não identificada.");

      /**
       * Esta escalação nunca funcionou. O insert usava quatro nomes de coluna que
       * `sgsst_nao_conformidades` não tem — `gravidade`, `responsavel_tratamento`,
       * `data_limite` — e um `origem_tipo: "CHECKLIST"` que o CHECK da tabela não
       * aceitava. Faltava também `projeto_id`, que é NOT NULL. O erro aparecia em
       * toast, então o botão falhava à vista de todos, sempre.
       *
       * Agora os nomes são os reais, a obra vem da aplicação de origem e o valor
       * CHECKLIST passou a ser aceito pela migration 20260824100000.
       */
      const projetoId = plano.aplicacao?.projeto_id;

      if (!projetoId) {
        throw new Error(
          "A aplicação de origem não tem obra vinculada, e a não conformidade do SGSST exige obra. Edite a aplicação e informe a obra antes de escalar."
        );
      }

      const { data: ncDb, error: ncErr } = await (supabase
        .from("sgsst_nao_conformidades" as any)
        .insert({
          empresa_id: empresaId,
          projeto_id: projetoId,
          area_id: plano.aplicacao?.area_id || null,
          // Numeração da própria tabela de NC, que já tem índice único por
          // empresa. O sorteio anterior de quatro dígitos colidia com o índice.
          codigo: null,
          titulo: `[Checklist 5W2H] ${plano.o_que_fazer}`,
          descricao: [
            `Origem: aplicação de checklist ${plano.aplicacao?.codigo ?? ""}`.trim(),
            plano.por_que ? `Por que: ${plano.por_que}` : "",
            plano.como_fazer ? `Como: ${plano.como_fazer}` : "",
            plano.onde ? `Onde: ${plano.onde}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          origem_tipo: "CHECKLIST",
          origem_id: plano.aplicacao_id,
          criticidade:
            plano.prioridade === "Critica"
              ? "CRITICA"
              : plano.prioridade === "Alta"
                ? "ALTA"
                : plano.prioridade === "Baixa"
                  ? "BAIXA"
                  : "MEDIA",
          status: "ABERTA",
          responsavel_id: plano.quem_responsavel_id || null,
          data_identificacao: new Date().toISOString().split("T")[0],
          prazo: plano.quando_prazo || null,
        })
        .select()
        .single() as any);

      if (ncErr) throw ncErr;

      // Update Plano de Ação with link to SGSST NC
      await (supabase
        .from("checklist_planos_acao" as any)
        .update({ nao_conformidade_sgsst_id: ncDb.id })
        .eq("id", plano.id) as any);

      return ncDb;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist_planos_acao"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_nao_conformidades"] });
      toast.success("Plano de ação convertido em Não Conformidade do SGSST!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao converter em NC: ${err.message || err}`);
    },
  });

  return {
    planosAcao: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    refetch,
    updatePlanoAcao,
    convertToNaoConformidade,
  };
}

/** Teto de segurança das consultas agregadas de Planos de Ação e Reincidências. */
export const CHECKLIST_STATS_LIMITE_LINHAS = 5000;

export interface ChecklistPlanoAcaoStatsRow {
  id: string;
  status: ChecklistPlanoAcao["status"];
  prioridade: ChecklistPlanoAcao["prioridade"];
  quando_prazo: string | null;
  created_at: string | null;
  projeto_nome: string;
  modelo_nome: string;
  responsavel_nome: string;
}

/**
 * Estatísticas agregadas de Planos de Ação 5W2H para o dashboard executivo.
 *
 * useChecklistPlanosAcao pagina porque existe para navegação linha a linha; aqui é
 * outra consulta, dedicada só a alimentar os gráficos de status e ranking por
 * obra/checklist/responsável. Reaproveitar a lista paginada faria o gráfico
 * mostrar só a página atual em vez do total — um bug sutil, porque o número bate
 * "por acaso" enquanto a lista cabe numa página só.
 */
export function useChecklistPlanosAcaoStats() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["checklist_planos_acao_stats", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("checklist_planos_acao" as any)
        .select(`
          id, status, prioridade, quando_prazo, created_at,
          quem_responsavel:profiles!checklist_planos_acao_quem_responsavel_id_fkey(nome),
          aplicacao:checklist_aplicacoes(
            projeto_id,
            projeto:projetos(nome),
            modelo:checklist_modelos(nome)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(CHECKLIST_STATS_LIMITE_LINHAS) as any);

      if (error) throw error;

      const rows = (data as any[]) || [];
      const linhas: ChecklistPlanoAcaoStatsRow[] = rows.map((p) => ({
        id: p.id,
        status: p.status,
        prioridade: p.prioridade,
        quando_prazo: p.quando_prazo,
        created_at: p.created_at,
        projeto_nome: p.aplicacao?.projeto?.nome || "Sem obra vinculada",
        modelo_nome: p.aplicacao?.modelo?.nome || "Checklist removido",
        responsavel_nome: p.quem_responsavel?.nome || "Não atribuído",
      }));

      return { linhas, truncado: rows.length >= CHECKLIST_STATS_LIMITE_LINHAS };
    },
  });

  return {
    linhas: data?.linhas ?? [],
    truncado: data?.truncado ?? false,
    isLoading,
    error,
  };
}

export interface ChecklistReincidenciaLinha {
  chave: string;
  item_id: string;
  item_titulo: string;
  projeto_id: string | null;
  projeto_nome: string;
  ocorrencias: number;
  primeira_ocorrencia: string;
  ultima_ocorrencia: string;
}

/**
 * Reincidências: o mesmo item de checklist reprovado mais de uma vez na mesma
 * obra. Um checklist reprovado isolado é um evento; agrupado por item + obra ao
 * longo do tempo, ele vira padrão — e é o padrão que antecipa acidente ou multa,
 * não o evento isolado. A agregação é feita no cliente porque o volume de
 * respostas não-conformes é uma fração pequena do total de respostas, e a consulta
 * já chega filtrada por is_nao_conforme = true.
 */
export function useChecklistReincidencias(params?: { minOcorrencias?: number }) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const minOcorrencias = params?.minOcorrencias ?? 2;

  const { data, isLoading, error } = useQuery({
    queryKey: ["checklist_reincidencias", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("checklist_respostas" as any)
        .select(`
          item_id, created_at,
          item:checklist_itens(titulo),
          aplicacao:checklist_aplicacoes(projeto_id, data_aplicacao, projeto:projetos(nome))
        `)
        .eq("is_nao_conforme", true)
        .order("created_at", { ascending: false })
        .limit(CHECKLIST_STATS_LIMITE_LINHAS) as any);

      if (error) throw error;

      const rows = (data as any[]) || [];
      const mapa = new Map<string, ChecklistReincidenciaLinha>();

      for (const r of rows) {
        const projetoId: string | null = r.aplicacao?.projeto_id ?? null;
        const chave = `${r.item_id}::${projetoId ?? "sem_obra"}`;
        const dataOcorrencia: string = r.aplicacao?.data_aplicacao || r.created_at;
        const existente = mapa.get(chave);

        if (existente) {
          existente.ocorrencias += 1;
          if (dataOcorrencia < existente.primeira_ocorrencia) existente.primeira_ocorrencia = dataOcorrencia;
          if (dataOcorrencia > existente.ultima_ocorrencia) existente.ultima_ocorrencia = dataOcorrencia;
        } else {
          mapa.set(chave, {
            chave,
            item_id: r.item_id,
            item_titulo: r.item?.titulo || "Item removido",
            projeto_id: projetoId,
            projeto_nome: r.aplicacao?.projeto?.nome || "Sem obra vinculada",
            ocorrencias: 1,
            primeira_ocorrencia: dataOcorrencia,
            ultima_ocorrencia: dataOcorrencia,
          });
        }
      }

      const todas = Array.from(mapa.values()).sort((a, b) => b.ocorrencias - a.ocorrencias);
      return { todas, truncado: rows.length >= CHECKLIST_STATS_LIMITE_LINHAS };
    },
  });

  const todas = data?.todas ?? [];

  return {
    linhas: todas.filter((l) => l.ocorrencias >= minOcorrencias),
    totalItensComOcorrencia: todas.length,
    truncado: data?.truncado ?? false,
    isLoading,
    error,
  };
}
