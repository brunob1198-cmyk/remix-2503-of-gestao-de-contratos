import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SgsstTreinamentoParticipante, SgsstTreinamentoTurma, ResultadoParticipante } from "@/hooks/sgsst/useSgsstTreinamentos";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";
import { UserCheck } from "lucide-react";

interface ParticipanteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turma: SgsstTreinamentoTurma | null;
  participante?: SgsstTreinamentoParticipante | null;
  onAdd: (colaboradorId: string) => Promise<void>;
  onUpdate: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export function ParticipanteFormDialog({
  open,
  onOpenChange,
  turma,
  participante,
  onAdd,
  onUpdate,
  isLoading = false,
}: ParticipanteFormDialogProps) {
  const { colaboradores } = useSgsstColaboradoresResumo();

  const [colaboradorId, setColaboradorId] = useState("");
  const [presenca, setPresenca] = useState(true);
  const [percentualPresenca, setPercentualPresenca] = useState(100);
  const [resultado, setResultado] = useState<ResultadoParticipante>("PENDENTE");
  const [dataConclusao, setDataConclusao] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (participante) {
      setColaboradorId(participante.colaborador_id || "");
      setPresenca(!!participante.presenca);
      setPercentualPresenca(participante.percentual_presenca || 100);
      setResultado(participante.resultado || "PENDENTE");
      setDataConclusao(participante.data_conclusao ? participante.data_conclusao.split("T")[0] : "");
      setObservacoes(participante.observacoes || "");
    } else {
      setColaboradorId("");
      setPresenca(true);
      setPercentualPresenca(100);
      setResultado("PENDENTE");
      setDataConclusao(turma?.data_final ? turma.data_final.split("T")[0] : new Date().toISOString().split("T")[0]);
      setObservacoes("");
    }
  }, [participante, turma, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (participante) {
      await onUpdate({
        id: participante.id,
        presenca,
        percentualPresenca: Number(percentualPresenca) || 100,
        resultado,
        dataConclusao: resultado === "APROVADO" ? dataConclusao || new Date().toISOString().split("T")[0] : undefined,
        validadeMeses: turma?.treinamento?.validade_meses,
        observacoes,
      });
    } else {
      if (!colaboradorId) return;
      await onAdd(colaboradorId);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            {participante ? "Registrar Presença e Resultado do Colaborador" : "Matricular Colaborador na Turma"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          {!participante ? (
            <div className="space-y-1.5">
              <Label htmlFor="colab">Selecione o Colaborador *</Label>
              <Select value={colaboradorId} onValueChange={setColaboradorId}>
                <SelectTrigger id="colab">
                  <SelectValue placeholder="Selecione o trabalhador..." />
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
          ) : (
            <div className="p-3 bg-muted/40 rounded border space-y-1">
              <div className="font-bold text-sm">
                {participante.colaborador?.profile?.nome || participante.colaborador?.recurso?.nome || participante.colaborador?.nome || "Sem Nome"}
              </div>
              <div className="text-xs text-muted-foreground">
                CPF: {participante.colaborador?.cpf || "—"} | Função: {participante.colaborador?.funcao?.nome || "—"}
              </div>
            </div>
          )}

          {participante && (
            <>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2 pt-4">
                  <Switch
                    id="pres"
                    checked={presenca}
                    onCheckedChange={setPresenca}
                  />
                  <Label htmlFor="pres" className="cursor-pointer font-semibold">
                    Presença Confirmada
                  </Label>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="perc">Percentual Presença (%) *</Label>
                  <Input
                    id="perc"
                    type="number"
                    min={0}
                    max={100}
                    value={percentualPresenca}
                    onChange={(e) => setPercentualPresenca(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="res">Resultado Final *</Label>
                  <Select value={resultado} onValueChange={(val: ResultadoParticipante) => setResultado(val)}>
                    <SelectTrigger id="res" className="font-semibold">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDENTE">PENDENTE</SelectItem>
                      <SelectItem value="APROVADO" className="text-emerald-700 font-bold">APROVADO</SelectItem>
                      <SelectItem value="REPROVADO" className="text-red-700 font-bold">REPROVADO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {resultado === "APROVADO" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="dataConc">Data da Conclusão *</Label>
                    <Input
                      id="dataConc"
                      type="date"
                      value={dataConclusao}
                      onChange={(e) => setDataConclusao(e.target.value)}
                      required={resultado === "APROVADO"}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obs">Observações do Aluno</Label>
                <Textarea
                  id="obs"
                  placeholder="Nota da avaliação prática, nota do teste teórico..."
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
            </>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || (!participante && !colaboradorId)}>
              {isLoading ? "Salvando..." : participante ? "Salvar Resultado" : "Matricular Aluno"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
