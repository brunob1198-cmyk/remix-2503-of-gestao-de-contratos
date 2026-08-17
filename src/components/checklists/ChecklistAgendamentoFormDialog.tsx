import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useChecklistModelos } from "@/hooks/checklists/useChecklists";
import { useChecklistAgendamentos } from "@/hooks/checklists/useChecklistsEvolution";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PeriodicidadeAgendamento } from "@/types/checklistsEvolution";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ChecklistAgendamentoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChecklistAgendamentoFormDialog({ open, onOpenChange }: ChecklistAgendamentoFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { modelos } = useChecklistModelos();
  const { createAgendamento } = useChecklistAgendamentos();

  const [modeloId, setModeloId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [dataInicial, setDataInicial] = useState(new Date().toISOString().split("T")[0]);
  const [dataFinal, setDataFinal] = useState("");
  const [horario, setHorario] = useState("08:00");
  const [periodicidade, setPeriodicidade] = useState<PeriodicidadeAgendamento>("SEMANAL");
  const [prazoDias, setPrazoDias] = useState(1);
  const [exigirGeolocalizacao, setExigirGeolocalizacao] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  // Load Select Options
  const { data: usuarios = [] } = useQuery({
    queryKey: ["users_agendamento", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles" as any).select("id, nome, email").eq("empresa_id", empresaId!);
      return data || [];
    },
  });

  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_agendamento", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("projetos" as any).select("id, codigo, nome").eq("empresa_id", empresaId!);
      return data || [];
    },
  });

  useEffect(() => {
    if (open) {
      setModeloId("");
      setResponsavelId("");
      setProjetoId("");
      setDataInicial(new Date().toISOString().split("T")[0]);
      setDataFinal("");
      setHorario("08:00");
      setPeriodicidade("SEMANAL");
      setPrazoDias(1);
      setExigirGeolocalizacao(false);
      setObservacoes("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!modeloId) {
      toast.error("Selecione um modelo de checklist.");
      return;
    }

    try {
      await createAgendamento.mutateAsync({
        checklist_modelo_id: modeloId,
        responsavel_id: responsavelId || undefined,
        projeto_id: projetoId || undefined,
        data_inicial: dataInicial,
        data_final: dataFinal || undefined,
        horario,
        periodicidade,
        prazo_dias: Number(prazoDias),
        exigir_geolocalizacao: exigirGeolocalizacao,
        observacoes,
      });

      onOpenChange(false);
    } catch (err) {
      // Handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Calendar className="h-5 w-5 text-primary" />
            Novo Agendamento Recorrente de Checklist
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Modelo de Checklist *</Label>
              <Select value={modeloId} onValueChange={setModeloId}>
                <SelectTrigger className="text-xs bg-white">
                  <SelectValue placeholder="Selecione o modelo de checklist..." />
                </SelectTrigger>
                <SelectContent>
                  {modelos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      [{m.codigo || "CHK"}] {m.nome} — {m.categoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Responsável Atribuído</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger className="text-xs bg-white">
                  <SelectValue placeholder="Selecione o responsável..." />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Projeto / Obra Alocado</Label>
              <Select value={projetoId} onValueChange={setProjetoId}>
                <SelectTrigger className="text-xs bg-white">
                  <SelectValue placeholder="Selecione o projeto..." />
                </SelectTrigger>
                <SelectContent>
                  {projetos.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.codigo}] {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Periodicidade Recorrente *</Label>
              <Select value={periodicidade} onValueChange={(val: any) => setPeriodicidade(val)}>
                <SelectTrigger className="text-xs bg-white">
                  <SelectValue placeholder="Selecione a periodicidade..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNICA">Única (Execução Pontual)</SelectItem>
                  <SelectItem value="DIARIA">Diária</SelectItem>
                  <SelectItem value="SEMANAL">Semanal</SelectItem>
                  <SelectItem value="QUINZENAL">Quinzenal</SelectItem>
                  <SelectItem value="MENSAL">Mensal</SelectItem>
                  <SelectItem value="TRIMESTRAL">Trimestral</SelectItem>
                  <SelectItem value="SEMESTRAL">Semestral</SelectItem>
                  <SelectItem value="ANUAL">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Prazo para Conclusão (dias)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={prazoDias}
                onChange={(e) => setPrazoDias(Number(e.target.value))}
                className="bg-white text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Data Inicial de Início *</Label>
              <Input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                className="bg-white text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Data Término (Opcional)</Label>
              <Input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className="bg-white text-xs"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="chk_geo_ag"
              checked={exigirGeolocalizacao}
              onCheckedChange={(c) => setExigirGeolocalizacao(!!c)}
            />
            <Label htmlFor="chk_geo_ag" className="text-xs font-medium cursor-pointer">
              Exigir registro de geolocalização obrigatório na aplicação agendada
            </Label>
          </div>

          <div className="space-y-1 pt-1">
            <Label className="text-xs font-semibold">Observações e Recomendações de Campo</Label>
            <Textarea
              rows={2}
              placeholder="Ex: Verificar EPIs de altura antes do turno matutino..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="bg-white text-xs"
            />
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createAgendamento.isPending}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2"
            >
              {createAgendamento.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
              {createAgendamento.isPending ? "Criando..." : "Salvar Agendamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
