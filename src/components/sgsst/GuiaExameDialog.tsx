import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresaAtual } from "@/hooks/useEmpresaAtual";
import { useSgsstFuncaoVinculos } from "@/hooks/sgsst/useSgsstFuncaoVinculos";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertTriangle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  grupoDaGuia,
  type ExameParaGuia,
} from "@/utils/sgsstGuiaExame";
import {
  gerarPdfGuiaExame,
  pendenciasGuiaExame,
  type GuiaExameDados,
} from "@/lib/guiaExameDocumento";

/**
 * Emissão da guia de encaminhamento para exame.
 *
 * Reúne, na mesma guia, TODOS os exames do trabalhador que ainda vão acontecer —
 * porque ele vai à clínica uma vez e faz a consulta e os complementares na mesma
 * ida. Uma guia por exame seria fiel ao banco e errada na prática.
 */

interface GuiaExameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Exame que originou o clique; serve para descobrir o trabalhador. */
  exame: ExameParaGuia | null;
  /** Todos os exames carregados na tela, para agrupar os do mesmo trabalhador. */
  exames: readonly ExameParaGuia[];
  nomeDoTrabalhador: string;
}

interface ColaboradorDaGuia {
  id: string;
  cpf?: string | null;
  rg?: string | null;
  nome?: string | null;
  matricula?: string | null;
  data_admissao?: string | null;
  funcao_id?: string | null;
  funcao?: { id: string; nome: string } | null;
  area?: { id: string; nome: string } | null;
}

interface ClinicaDaGuia {
  id: string;
  nome: string;
  cnpj?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  telefone?: string | null;
  responsavel_tecnico?: string | null;
}

interface PcmsoDaGuia {
  id: string;
  codigo?: string | null;
  titulo?: string | null;
  medico_responsavel?: string | null;
  crm_medico?: string | null;
  responsavel?: string | null;
}

export function GuiaExameDialog({
  open,
  onOpenChange,
  exame,
  exames,
  nomeDoTrabalhador,
}: GuiaExameDialogProps) {
  const { profile } = useAuth();
  const { empresa } = useEmpresaAtual();
  const [gerando, setGerando] = useState(false);

  const grupo = useMemo(
    () => (exame ? grupoDaGuia(exames, exame.colaborador_id) : null),
    [exame, exames]
  );

  const habilitado = open && !!exame;

  const { data: colaborador } = useQuery({
    queryKey: ["sgsst_colaborador_dados", "guia", exame?.colaborador_id],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = (await (supabase
        .from("sgsst_colaborador_dados" as never)
        .select(
          "id, cpf, rg, nome, matricula, data_admissao, funcao_id, funcao:sgsst_funcoes(id, nome), area:areas(id, nome)"
        )
        .eq("id", exame!.colaborador_id)
        .single() as never)) as {
        data: ColaboradorDaGuia | null;
        error: { message?: string } | null;
      };
      if (error) throw error;
      return data;
    },
  });

  const { data: clinica } = useQuery({
    queryKey: ["sgsst_clinicas", "guia", grupo?.clinicaId],
    enabled: habilitado && !!grupo?.clinicaId,
    queryFn: async () => {
      const { data, error } = (await (supabase
        .from("sgsst_clinicas" as never)
        .select("id, nome, cnpj, endereco, cidade, uf, telefone, responsavel_tecnico")
        .eq("id", grupo!.clinicaId!)
        .single() as never)) as {
        data: ClinicaDaGuia | null;
        error: { message?: string } | null;
      };
      if (error) throw error;
      return data;
    },
  });

  // O PCMSO ativo é quem responde pela solicitação. Não vem do exame porque exame
  // avulso — solicitado fora de um programa — também precisa de guia.
  const { data: pcmso } = useQuery({
    queryKey: ["sgsst_pcmso", "guia", profile?.empresa_id],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = (await (supabase
        .from("sgsst_pcmso" as never)
        .select("id, codigo, titulo, medico_responsavel, crm_medico, responsavel")
        .eq("empresa_id", profile!.empresa_id!)
        .eq("status", "ATIVO")
        .order("data_inicio", { ascending: false })
        .limit(1) as never)) as {
        data: PcmsoDaGuia[] | null;
        error: { message?: string } | null;
      };
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const vinculos = useSgsstFuncaoVinculos(
    habilitado ? colaborador?.funcao_id ?? null : null
  );

  /**
   * `null` enquanto não carregou — nunca `[]`. O documento usa a diferença: lista
   * vazia afirma que a função não tem risco, e mandaria o médico examinar sem
   * saber a que o trabalhador se expõe.
   */
  const riscos = useMemo(() => {
    // Sem função não há o que consultar, e a lista vazia aqui é verdadeira: a
    // pendência correspondente é "trabalhador sem função", não "função sem risco".
    if (!colaborador?.funcao_id) return [];

    // O hook entrega `itens` já com `[]` como padrão, então a distinção entre
    // "carregando/falhou" e "consultado e vazio" tem de vir do estado da consulta.
    // Sem isso o documento afirmaria que a função não tem risco enquanto ainda
    // estava carregando — e mandaria o médico examinar sem saber a exposição.
    if (vinculos.riscos.isLoading || vinculos.riscos.error) return null;

    return vinculos.riscos.itens.map((v) => ({
      categoria: v.risco?.categoria ?? "Não classificado",
      agente: v.risco?.agente || v.risco?.nome || "",
      exposicao: v.tipo_exposicao,
      tempoExposicao: v.tempo_exposicao,
    }));
  }, [
    colaborador?.funcao_id,
    vinculos.riscos.isLoading,
    vinculos.riscos.error,
    vinculos.riscos.itens,
  ]);

  const dados: GuiaExameDados | null = useMemo(() => {
    if (!grupo) return null;
    return {
      grupo,
      trabalhador: {
        nome: nomeDoTrabalhador,
        cpf: colaborador?.cpf,
        rg: colaborador?.rg,
        matricula: colaborador?.matricula,
        dataAdmissao: colaborador?.data_admissao,
        funcaoNome: colaborador?.funcao?.nome,
        setor: colaborador?.area?.nome,
      },
      empresa,
      riscos,
      clinica: clinica
        ? {
            nome: clinica.nome,
            cnpj: clinica.cnpj,
            endereco: clinica.endereco,
            cidade: clinica.cidade,
            uf: clinica.uf,
            telefone: clinica.telefone,
            responsavelTecnico: clinica.responsavel_tecnico,
          }
        : null,
      pcmso: pcmso
        ? {
            codigo: pcmso.codigo,
            titulo: pcmso.titulo,
            medicoResponsavel: pcmso.medico_responsavel,
            crmMedico: pcmso.crm_medico,
          }
        : null,
      responsavelSst: pcmso?.responsavel ?? null,
      geradoPor: profile?.nome ?? null,
    };
  }, [grupo, nomeDoTrabalhador, colaborador, empresa, riscos, clinica, pcmso, profile?.nome]);

  const pendencias = useMemo(
    () => (dados ? pendenciasGuiaExame(dados) : []),
    [dados]
  );

  const emitir = async () => {
    if (!dados) return;
    setGerando(true);
    try {
      await gerarPdfGuiaExame(dados);
      toast.success("Guia de encaminhamento gerada.");
      onOpenChange(false);
    } catch (err) {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Não foi possível gerar a guia: ${detalhe}`);
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Guia de encaminhamento para exame
          </DialogTitle>
          <DialogDescription>
            É o documento que o trabalhador leva ao médico. Não atesta aptidão — o ASO
            é emitido depois, pelo médico examinador.
          </DialogDescription>
        </DialogHeader>

        {!grupo ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nenhum exame pendente ou agendado para este trabalhador.
          </p>
        ) : (
          <div className="space-y-3 py-1">
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-sm font-semibold">{nomeDoTrabalhador}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {colaborador?.funcao?.nome ?? "função não cadastrada"}
                {colaborador?.area?.nome ? ` · ${colaborador.area.nome}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {grupo.exames.map((e) => (
                  <Badge key={e.id} variant="secondary" className="text-xs">
                    {e.nome_exame}
                    <span className="ml-1 text-muted-foreground">
                      ({e.natureza === "CLINICO" ? "clínico" : "complementar"})
                    </span>
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-tight text-muted-foreground">
                {grupo.exames.length === 1
                  ? "A guia leva o exame que ainda vai acontecer."
                  : `A guia reúne os ${grupo.exames.length} exames que ainda vão acontecer — o trabalhador faz todos na mesma ida.`}
              </p>
            </div>

            {pendencias.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                  {pendencias.length} ponto(s) a conferir
                </p>
                <ul className="mt-2 space-y-1">
                  {pendencias.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-400"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
                  Dá para emitir assim. O que falta aparece marcado no próprio PDF.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={emitir} disabled={!grupo || gerando} className="gap-1.5">
            {gerando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Emitir guia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
