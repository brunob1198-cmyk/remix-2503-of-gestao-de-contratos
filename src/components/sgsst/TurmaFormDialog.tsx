import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstTreinamentoTurma, SgsstTreinamentoTurmaInput, ModalidadeTurma, StatusTurma, useSgsstTreinamentos } from "@/hooks/sgsst/useSgsstTreinamentos";
import { Users } from "lucide-react";

interface TurmaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turma?: SgsstTreinamentoTurma | null;
  onSave: (data: SgsstTreinamentoTurmaInput) => Promise<void>;
  isLoading?: boolean;
}

export function TurmaFormDialog({
  open,
  onOpenChange,
  turma,
  onSave,
  isLoading = false,
}: TurmaFormDialogProps) {
  const { treinamentos } = useSgsstTreinamentos();

  const [treinamentoId, setTreinamentoId] = useState("");
  const [codigoTurma, setCodigoTurma] = useState("");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState<number | "">(8);
  const [instrutor, setInstrutor] = useState("");
  const [local, setLocal] = useState("");
  const [modalidade, setModalidade] = useState<ModalidadeTurma>("PRESENCIAL");
  const [capacidade, setCapacidade] = useState(30);
  const [status, setStatus] = useState<StatusTurma>("PLANEJADA");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (turma) {
      setTreinamentoId(turma.treinamento_id || "");
      setCodigoTurma(turma.codigo_turma || "");
      setDataInicial(turma.data_inicial ? turma.data_inicial.split("T")[0] : "");
      setDataFinal(turma.data_final ? turma.data_final.split("T")[0] : "");
      setCargaHoraria(turma.carga_horaria || 8);
      setInstrutor(turma.instrutor || "");
      setLocal(turma.local || "");
      setModalidade(turma.modalidade || "PRESENCIAL");
      setCapacidade(turma.capacidade || 30);
      setStatus(turma.status || "PLANEJADA");
      setObservacoes(turma.observacoes || "");
    } else {
      setTreinamentoId("");
      setCodigoTurma("");
      setDataInicial(new Date().toISOString().split("T")[0]);
      setDataFinal("");
      setCargaHoraria(8);
      setInstrutor("");
      setLocal("Sala de Treinamento / Canteiro");
      setModalidade("PRESENCIAL");
      setCapacidade(30);
      setStatus("PLANEJADA");
      setObservacoes("");
    }
  }, [turma, open]);

  // When selected training changes, update default carga horaria
  const handleTreinamentoChange = (id: string) => {
    setTreinamentoId(id);
    const tr = treinamentos.find((t) => t.id === id);
    if (tr && tr.carga_horaria) {
      setCargaHoraria(tr.carga_horaria);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treinamentoId || !dataInicial) return;

    await onSave({
      treinamento_id: treinamentoId,
      codigo_turma: codigoTurma.trim() || null,
      data_inicial: dataInicial,
      data_final: dataFinal || null,
      carga_horaria: cargaHoraria !== "" ? Number(cargaHoraria) : null,
      instrutor: instrutor.trim() || null,
      local: local.trim() || null,
      modalidade,
      capacidade: Number(capacidade) || 30,
      status,
      observacoes: observacoes.trim() || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {turma ? "Editar Turma de Treinamento" : "Abrir Nova Turma de Treinamento"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="tr">Treinamento / Capacitação *</Label>
            <Select value={treinamentoId} onValueChange={handleTreinamentoChange}>
              <SelectTrigger id="tr">
                <SelectValue placeholder="Selecione o treinamento do catálogo..." />
              </SelectTrigger>
              <SelectContent>
                {treinamentos.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    [{t.codigo || "TR"}] {t.nome} ({t.carga_horaria}h)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="codTurma">Código da Turma</Label>
              <Input
                id="codTurma"
                placeholder="Ex: TURMA-NR35-01"
                value={codigoTurma}
                onChange={(e) => setCodigoTurma(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modalidade">Modalidade *</Label>
              <Select value={modalidade} onValueChange={(val: ModalidadeTurma) => setModalidade(val)}>
                <SelectTrigger id="modalidade">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENCIAL">Presencial</SelectItem>
                  <SelectItem value="ONLINE">Online / EAD</SelectItem>
                  <SelectItem value="HIBRIDO">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status da Turma *</Label>
              <Select value={status} onValueChange={(val: StatusTurma) => setStatus(val)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANEJADA">Planejada</SelectItem>
                  <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                  <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                  <SelectItem value="CANCELADA">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dataIni">Data Inicial *</Label>
              <Input
                id="dataIni"
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataFim">Data Final</Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="capacidade">Capacidade (Alunos)</Label>
              <Input
                id="capacidade"
                type="number"
                min={1}
                value={capacidade}
                onChange={(e) => setCapacidade(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="instrutor">Instrutor / Facilitador</Label>
              <Input
                id="instrutor"
                placeholder="Ex: Eng. Marcio Souza (SST)"
                value={instrutor}
                onChange={(e) => setInstrutor(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="local">Local do Treinamento</Label>
              <Input
                id="local"
                placeholder="Ex: Auditório Central / Plataforma Teams"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações da Turma</Label>
            <Textarea
              id="obs"
              placeholder="Instruções de vestimenta, EPIs necessários para aula prática..."
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !treinamentoId || !dataInicial}>
              {isLoading ? "Salvando..." : turma ? "Atualizar Turma" : "Criar Turma"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
