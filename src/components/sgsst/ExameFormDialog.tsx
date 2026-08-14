import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstExame, SgsstExameInput, TipoExameOcupacional, StatusExameOcupacional } from "@/hooks/sgsst/useSgsstAsosAndExames";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";
import { useSgsstPcmso } from "@/hooks/sgsst/useSgsstPcmso";
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

  useEffect(() => {
    if (exame) {
      setColaboradorId(exame.colaborador_id || "");
      setPcmsoId(exame.pcmso_id || "none");
      setNomeExame(exame.nome_exame || "");
      setTipo(exame.tipo || "Periódico");
      setDataSolicitacao(exame.data_solicitacao ? exame.data_solicitacao.split("T")[0] : "");
      setDataRealizacao(exame.data_realizacao ? exame.data_realizacao.split("T")[0] : "");
      setResultado(exame.resultado || "");
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
    }
  }, [exame, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colaboradorId || !nomeExame.trim()) return;

    await onSave({
      colaborador_id: colaboradorId,
      pcmso_id: pcmsoId === "none" ? null : pcmsoId,
      nome_exame: nomeExame.trim(),
      tipo,
      data_solicitacao: dataSolicitacao || new Date().toISOString().split("T")[0],
      data_realizacao: dataRealizacao || null,
      resultado: resultado.trim() || null,
      medico_responsavel: medicoResponsavel.trim() || null,
      status,
      observacoes: observacoes.trim() || null,
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
              <Label htmlFor="resultado">Parecer / Resultado Simplificado</Label>
              <Input
                id="resultado"
                placeholder="Ex: Normal, Sem alterações"
                value={resultado}
                onChange={(e) => setResultado(e.target.value)}
              />
            </div>
          </div>

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
