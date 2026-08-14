import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

  const { data: modelos = [], isLoading, refetch } = useQuery({
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
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as ChecklistModelo[]) || [];
    },
  });

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
        }>;
      }>;
    }) => {
      if (!empresaId) throw new Error("Empresa não identificada.");

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
          responsavel_id: input.responsavel_id || null,
          projeto_id: input.projeto_id || null,
          area_id: input.area_id || null,
          tipo_aplicacao: input.tipo_aplicacao || "Geral",
          created_by: profile?.id,
          status: "ativo",
        })
        .select()
        .single() as any);

      if (mErr) throw mErr;

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
      const { error } = await (supabase.from("checklist_modelos" as any).delete().eq("id", id) as any);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist_modelos"] });
      toast.success("Modelo removido!");
    },
    onError: (err: any) => {
      toast.error(`Não foi possível excluir o modelo (já possui aplicações vinculadas). ${err.message || ""}`);
    },
  });

  return {
    modelos,
    isLoading,
    refetch,
    createModelo,
    duplicateModelo,
    deleteModelo,
  };
}

// 2. APLICAÇÕES HOOK
export function useChecklistAplicacoes() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: aplicacoes = [], isLoading, refetch } = useQuery({
    queryKey: ["checklist_aplicacoes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("checklist_aplicacoes" as any)
        .select(`
          *,
          modelo:checklist_modelos(id, nome, codigo, categoria),
          projeto:projetos(id, codigo, nome),
          area:areas(id, nome),
          aplicador:profiles!checklist_aplicacoes_aplicador_id_fkey(id, nome),
          responsavel:profiles!checklist_aplicacoes_responsavel_id_fkey(id, nome),
          planos_acao:checklist_planos_acao(*)
        `)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as ChecklistAplicacao[]) || [];
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
        evidencias_urls?: string[];
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
      if (!empresaId) throw new Error("Empresa não identificada.");

      // Calculate Scores
      let totalConforme = 0;
      let totalNaoConforme = 0;
      let totalNa = 0;
      let pontuacaoObtida = 0;
      let pontuacaoMaxima = 0;

      for (const r of input.respostas) {
        if (r.resposta_valor === "NA" || r.resposta_valor === "N/A") {
          totalNa++;
        } else if (r.is_nao_conforme || r.resposta_valor === "NaoConforme" || r.resposta_valor === "Nao" || r.resposta_valor === "NaoOK") {
          totalNaoConforme++;
          pontuacaoMaxima += 1.0;
        } else {
          totalConforme++;
          pontuacaoObtida += 1.0;
          pontuacaoMaxima += 1.0;
        }

        // Insert Resposta
        const { data: respDb, error: rErr } = await (supabase
          .from("checklist_respostas" as any)
          .insert({
            empresa_id: empresaId,
            aplicacao_id: input.aplicacao_id,
            item_id: r.item_id,
            resposta_valor: r.resposta_valor,
            comentario: r.comentario || null,
            is_critico: r.is_critico ?? false,
            is_nao_conforme: r.is_nao_conforme ?? (r.resposta_valor === "NaoConforme" || r.resposta_valor === "Nao"),
            pontos_obtidos: r.is_nao_conforme ? 0 : 1.0,
          })
          .select()
          .single() as any);

        if (rErr) throw rErr;

        // Insert Evidencias R2 if present
        if (r.evidencias_urls && r.evidencias_urls.length > 0) {
          const evidInserts = r.evidencias_urls.map((url) => ({
            empresa_id: empresaId,
            aplicacao_id: input.aplicacao_id,
            resposta_id: respDb.id,
            r2_url: url,
            r2_key: url,
          }));
          await (supabase.from("checklist_evidencias" as any).insert(evidInserts) as any);
        }
      }

      // Insert Planos de Ação 5W2H
      for (const pa of input.planos_acao) {
        await (supabase
          .from("checklist_planos_acao" as any)
          .insert({
            empresa_id: empresaId,
            aplicacao_id: input.aplicacao_id,
            item_id: pa.item_id || null,
            codigo: `PA-${Math.floor(1000 + Math.random() * 9000)}`,
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
      }

      const percentual = pontuacaoMaxima > 0 ? (pontuacaoObtida / pontuacaoMaxima) * 100 : 100;

      // Update Aplicacao Record
      const { data: updated, error: uErr } = await (supabase
        .from("checklist_aplicacoes" as any)
        .update({
          status: "concluido",
          data_conclusao: new Date().toISOString(),
          pontuacao_obtida: pontuacaoObtida,
          pontuacao_maxima: pontuacaoMaxima,
          percentual_conformidade: Math.round(percentual),
          total_itens: input.respostas.length,
          total_conforme: totalConforme,
          total_nao_conforme: totalNaoConforme,
          total_na: totalNa,
          observacoes_gerais: input.observacoes_gerais || null,
        })
        .eq("id", input.aplicacao_id)
        .select()
        .single() as any);

      if (uErr) throw uErr;
      return updated as ChecklistAplicacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist_aplicacoes"] });
      queryClient.invalidateQueries({ queryKey: ["checklist_planos_acao"] });
      toast.success("Checklist concluído e enviado com sucesso!");
    },
  });

  return {
    aplicacoes,
    isLoading,
    refetch,
    createAplicacao,
    finishAplicacao,
  };
}

// 3. PLANOS DE AÇÃO 5W2H HOOK
export function useChecklistPlanosAcao() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: planosAcao = [], isLoading, refetch } = useQuery({
    queryKey: ["checklist_planos_acao", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("checklist_planos_acao" as any)
        .select(`
          *,
          quem_responsavel:profiles!checklist_planos_acao_quem_responsavel_id_fkey(id, nome),
          validado_por:profiles!checklist_planos_acao_validado_por_id_fkey(id, nome),
          aplicacao:checklist_aplicacoes(id, codigo, modelo:checklist_modelos(nome)),
          item:checklist_itens(id, titulo)
        `)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as ChecklistPlanoAcao[]) || [];
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

      // Create record in sgsst_nao_conformidades without duplicate logic
      const codigo = `NC-CHK-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data: ncDb, error: ncErr } = await (supabase
        .from("sgsst_nao_conformidades" as any)
        .insert({
          empresa_id: empresaId,
          codigo,
          titulo: `[Checklist 5W2H] ${plano.o_que_fazer}`,
          descricao: `Origem: Aplicação de Checklist | ${plano.por_que || ""}`,
          origem_tipo: "CHECKLIST",
          origem_id: plano.aplicacao_id,
          gravidade: plano.prioridade === "Critica" ? "CRITICA" : plano.prioridade === "Alta" ? "ALTA" : "MEDIA",
          status: "ABERTA",
          responsavel_tratamento: plano.quem_responsavel?.nome || "Responsável Checklist",
          data_identificacao: new Date().toISOString().split("T")[0],
          data_limite: plano.quando_prazo || null,
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
    planosAcao,
    isLoading,
    refetch,
    updatePlanoAcao,
    convertToNaoConformidade,
  };
}
