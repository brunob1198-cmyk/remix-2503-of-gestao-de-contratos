import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { incoerenciaDoExame } from "@/utils/sgsstExameCoerencia";
import {
  SgsstExame,
  SgsstExameInput,
  TipoExameOcupacional,
  StatusExameOcupacional,
  NaturezaExame,
  ClassificacaoResultado,
} from "@/hooks/sgsst/useSgsstAsosAndExames";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";
import { useSgsstPcmso } from "@/hooks/sgsst/useSgsstPcmso";
import { useSgsstClinicas } from "@/hooks/sgsst/useSgsstClinicas";
import { FileText } from "lucide-react";

interface ExameFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exame?: SgsstExame | null;
  onSave: (data: SgsstExameInput) => Promise<void>;
  isLoading?: boolean;
}

export function ExameFormDialog({
  open,
  onOpenChange,
  exame,
  onSave,
  isLoading = false,
}: ExameFormDialogProps) {
  const { colaboradores } = useSgsstColaboradoresResumo();
  const { pcmsoList } = useSgsstPcmso();
  const { clinicas } = useSgsstClinicas();

  const [colaboradorId, setColaboradorId] = useState("");
  const [pcmsoId, setPcmsoId] = useState("none");
  const [nomeExame, setNomeExame] = useState("");
  const [tipo, setTipo] = useState<TipoExameOcupacional>("Periódico");
  const [dataSolicitacao, setDataSolicitacao] = useState("");
  const [dataRealizacao, setDataRealizacao] = useState("");
  const [resultado, setResultado] = useState("");
  const [medicoResponsavel, setMedicoResponsavel] = useState("");
  const [status, setStatus] = useState<StatusExameOcupacional>("PENDENTE");
  const [observacoes, setObservacoes] = useState("");
  const [natureza, setNatureza] = useState<NaturezaExame>("COMPLEMENTAR");
  const [resultadoClassificacao, setResultadoClassificacao] = useState<ClassificacaoResultado | "none">("none");
  const [clinicaId, setClinicaId] = useState("none");
  const [dataAgendada, setDataAgendada] = useState("");
  const [horaAgendada, setHoraAgendada] = useState("");

  /** Recalculada a cada render: é barata e precisa acompanhar status e data. */
  const incoerencia = incoerenciaDoExame({ status, dataRealizacao });

  useEffect(() => {
    if (exame) {
      setColaboradorId(exame.colaborador_id || "");
      setPcmsoId(exame.pcmso_id || "none");
      setNomeExame(exame.nome_exame || "");
      setTipo(exame.tipo || "Periódico");
      setDataSolicitacao(exame.data_solicitacao ? exame.data_solicitacao.split("T")[0] : "");
      setDataRealizacao(exame.data_realizacao ? exame.data_realizacao.split("T")[0] : "");
      setResultado(exame.resultado || "");
      setNatureza(exame.natureza || "COMPLEMENTAR");
      setResultadoClassificacao(exame.resultado_classificacao || "none");
      setClinicaId(exame.clinica_id || "none");
      setDataAgendada(exame.data_agendada ? exame.data_agendada.split("T")[0] : "");
      setHoraAgendada(exame.hora_agendada ? exame.hora_agendada.slice(0, 5) : "");
      setMedicoResponsavel(exame.medico_responsavel || "");
      setStatus(exame.status || "PENDENTE");
      setObservacoes(exame.observacoes || "");
    } else {
      setColaboradorId("");
      setPcmsoId("none");
      setNomeExame("");
      setTipo("Periódico");
      setDataSolicitacao(new Date().toISOString().split("T")[0]);
      setDataRealizacao("");
      setResultado("");
      setMedicoResponsavel("");
      setStatus("PENDENTE");
      setObservacoes("");
      setNatureza("COMPLEMENTAR");
      setResultadoClassificacao("none");
      setClinicaId("none");
      setDataAgendada("");
      setHoraAgendada("");
    }
  }, [exame, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colaboradorId || !nomeExame.trim()) return;

    // Realizado sem data é CONTRADIÇÃO, não informação pendente: não existe saber
    // que o exame aconteceu e não saber quando. Gravado assim, a lista mostrava
    // "REALIZADO" e a fila de convocação continuava dizendo "nunca realizado",
    // porque o cálculo da periodicidade exige a data.
    if (incoerencia?.gravidade === "IMPEDE") {
      toast.error(incoerencia.resumo, { description: incoerencia.comoResolver, duration: 9000 });
      return;
    }

    await onSave({
      colaborador_id: colaboradorId,
      pcmso_id: pcmsoId === "none" ? null : pcmsoId,
      nome_exame: nomeExame.trim(),
      tipo,
      data_solicitacao: dataSolicitacao || new Date().toISOString().split("T")[0],
      data_realizacao: dataRealizacao || null,
      resultado: resultado.trim() || null,
      natureza,
      resultado_classificacao:
        resultadoClassificacao === "none" ? null : resultadoClassificacao,
      medico_responsavel: medicoResponsavel.trim() || null,
      status,
      observacoes: observacoes.trim() || null,
      clinica_id: clinicaId === "none" ? null : clinicaId,
      data_agendada: dataAgendada || null,
      hora_agendada: horaAgendada || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {exame ? "Editar Exame Ocupacional" : "Solicitar Exame Ocupacional"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="colab">Colaborador / Trabalhador *</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger id="colab">
                <SelectValue placeholder="Selecione o colaborador..." />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayNome} (CPF: {c.cpf || "—"}) — {c.funcao || "Sem função"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pcmso">PCMSO de Referência</Label>
              <Select value={pcmsoId} onValueChange={setPcmsoId}>
                <SelectTrigger id="pcmso">
                  <SelectValue placeholder="Selecione o PCMSO..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Sem PCMSO Vinculado --</SelectItem>
                  {pcmsoList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.codigo || "PCMSO"}] {p.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tipoExame">Tipo de Exame *</Label>
              <Select value={tipo} onValueChange={(val: TipoExameOcupacional) => setTipo(val)}>
                <SelectTrigger id="tipoExame">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admissional">Admissional</SelectItem>
                  <SelectItem value="Periódico">Periódico</SelectItem>
                  <SelectItem value="Retorno ao Trabalho">Retorno ao Trabalho</SelectItem>
                  <SelectItem value="Mudança de Risco/Função">Mudança de Risco/Função</SelectItem>
                  <SelectItem value="Demissional">Demissional</SelectItem>
                  <SelectItem value="Complementar">Complementar</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nomeExame">Nome do Exame *</Label>
            <Input
              id="nomeExame"
              placeholder="Ex: Hemograma Completo, Avaliação Clínica, Audiometria, Raio-X de Tórax"
              value={nomeExame}
              onChange={(e) => setNomeExame(e.target.value)}
              required
            />
          </div>

          {/* Onde e quando o exame vai ser feito.
              A clínica é o que a GUIA DE ENCAMINHAMENTO imprime como endereço — sem
              ela o trabalhador recebe um papel sem saber para onde ir. E a data
              agendada é o que a fila de convocação lê como "agendado". */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div>
              <h4 className="text-sm font-semibold leading-none">Onde o exame será feito</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                A clínica escolhida aqui é o endereço que sai na guia de encaminhamento.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="clinica">Clínica credenciada</Label>
                <Select value={clinicaId} onValueChange={setClinicaId}>
                  <SelectTrigger id="clinica">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- A definir --</SelectItem>
                    {clinicas
                      .filter((c) => c.status !== "INATIVA")
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                          {c.cidade ? ` — ${c.cidade}` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dataAgendada">Data agendada</Label>
                <Input
                  id="dataAgendada"
                  type="date"
                  value={dataAgendada}
                  onChange={(e) => setDataAgendada(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="horaAgendada">Hora</Label>
                <Input
                  id="horaAgendada"
                  type="time"
                  value={horaAgendada}
                  onChange={(e) => setHoraAgendada(e.target.value)}
                />
              </div>
            </div>

            {clinicas.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma clínica cadastrada ainda. Cadastre na aba <strong>Clínicas</strong> e
                ela passa a aparecer aqui.
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dataSolicitacao">Data da Solicitação *</Label>
              <Input
                id="dataSolicitacao"
                type="date"
                value={dataSolicitacao}
                onChange={(e) => setDataSolicitacao(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataRealizacao">Data da Realização</Label>
              <Input
                id="dataRealizacao"
                type="date"
                value={dataRealizacao}
                onChange={(e) => setDataRealizacao(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status do Exame *</Label>
              <Select value={status} onValueChange={(val: StatusExameOcupacional) => setStatus(val)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="AGENDADO">Agendado</SelectItem>
                  <SelectItem value="REALIZADO">Realizado</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="medico">Médico / Laboratório Responsável</Label>
              <Input
                id="medico"
                placeholder="Ex: Dr. Carlos Mendes / Clinmed"
                value={medicoResponsavel}
                onChange={(e) => setMedicoResponsavel(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="natureza">Natureza do exame *</Label>
              <Select value={natureza} onValueChange={(v: NaturezaExame) => setNatureza(v)}>
                <SelectTrigger id="natureza">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLINICO">Clínico (consulta médica)</SelectItem>
                  <SelectItem value="COMPLEMENTAR">
                    Complementar (laboratório, imagem, audiometria)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O relatório analítico conta clínicos e complementares separadamente.
              </p>
            </div>
          </div>

          {/* A classificação é o que permite contar "resultados anormais" no
              relatório analítico. O texto livre continua, para o detalhe clínico:
              a classificação é para estatística, não substitui o laudo. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="classificacao">Classificação do resultado</Label>
              <Select
                value={resultadoClassificacao}
                onValueChange={(v) =>
                  setResultadoClassificacao(v as ClassificacaoResultado | "none")
                }
              >
                <SelectTrigger id="classificacao">
                  <SelectValue placeholder="Ainda não classificado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ainda não classificado</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="ALTERADO">Alterado</SelectItem>
                  <SelectItem value="INCONCLUSIVO">Inconclusivo</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Obrigatório na estatística de achados do relatório anual (NR-07 7.6.2).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resultado">Detalhe do resultado</Label>
              <Input
                id="resultado"
                placeholder="Ex.: Perda em 4 kHz à esquerda"
                value={resultado}
                onChange={(e) => setResultado(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Texto livre para o achado clínico. Não entra na contagem.
              </p>
            </div>
          </div>

          {incoerencia?.gravidade === "IMPEDE" && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <strong>{incoerencia.resumo}</strong>
              <br />
              {incoerencia.comoResolver}
            </div>
          )}

          {incoerencia?.gravidade === "AVISA" && (
            <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              <strong>{incoerencia.resumo}</strong> {incoerencia.comoResolver}
            </div>
          )}

          {status === "REALIZADO" && resultadoClassificacao === "none" && (
            <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              Exame marcado como realizado mas sem classificação. Ele aparecerá como
              "não classificado" no relatório analítico — o relatório não presume que
              um exame sem classificação é normal.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações Gerais</Label>
            <Textarea
              id="obs"
              placeholder="Notas sobre o agendamento, clínica conveniada..."
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !colaboradorId || !nomeExame.trim()}>
              {isLoading ? "Salvando..." : exame ? "Atualizar Exame" : "Solicitar Exame"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
