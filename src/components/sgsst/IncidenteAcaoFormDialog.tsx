import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstIncidenteAcao, TipoAcao, PrioridadeAcao, StatusAcao } from "@/hooks/sgsst/useSgsstIncidentes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckSquare } from "lucide-react";

interface IncidenteAcaoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incidenteId: string;
  acao?: SgsstIncidenteAcao | null;
  onSave: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export function IncidenteAcaoFormDialog({
  open,
  onOpenChange,
  incidenteId,
  acao,
  onSave,
  isLoading = false,
}: IncidenteAcaoFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TipoAcao>("Corretiva");
  const [responsavelId, setResponsavelId] = useState("none");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState<PrioridadeAcao>("MEDIA");
  const [status, setStatus] = useState<StatusAcao>("ABERTA");
  const [observacao, setObservacao] = useState("");

  // Load responsaveis
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis_acao_inc", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cargo")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (acao) {
      setDescricao(acao.descricao || "");
      setTipo(acao.tipo || "Corretiva");
      setResponsavelId(acao.responsavel_id || "none");
      setPrazo(acao.prazo ? acao.prazo.split("T")[0] : "");
      setPrioridade(acao.prioridade || "MEDIA");
      setStatus(acao.status || "ABERTA");
      setObservacao(acao.observacao || "");
    } else {
      setDescricao("");
      setTipo("Corretiva");
      setResponsavelId("none");
      setPrazo("");
      setPrioridade("MEDIA");
      setStatus("ABERTA");
      setObservacao("");
    }
  }, [acao, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) return;

    await onSave({
      incidente_id: incidenteId,
      descricao: descricao.trim(),
      tipo,
      responsavel_id: responsavelId === "none" ? null : responsavelId,
      prazo: prazo || null,
      prioridade,
      status,
      observacao: observacao.trim() || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            {acao ? "Editar Plano de Ação" : "Registrar Plano de Ação"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição da Ação *</Label>
            <Textarea
              id="descricao"
              placeholder="Descreva a medida preventiva ou corretiva a ser implementada..."
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo de Ação *</Label>
              <Select value={tipo} onValueChange={(val: TipoAcao) => setTipo(val)}>
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Corretiva">Ação Corretiva</SelectItem>
                  <SelectItem value="Preventiva">Ação Preventiva</SelectItem>
                  <SelectItem value="Contenção">Ação de Contenção Imediata</SelectItem>
                  <SelectItem value="Melhoria">Melhoria de Processo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prioridade">Prioridade *</Label>
              <Select value={prioridade} onValueChange={(val: PrioridadeAcao) => setPrioridade(val)}>
                <SelectTrigger id="prioridade">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                  <SelectItem value="MEDIA">Média</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="CRITICA">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="responsavel">Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger id="responsavel">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Não Definido --</SelectItem>
                  {responsaveis.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome || "Sem Nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prazo">Prazo Limite</Label>
              <Input
                id="prazo"
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(val: StatusAcao) => setStatus(val)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABERTA">Aberta</SelectItem>
                  <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                  <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                  <SelectItem value="CANCELADA">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacao">Observações / Recursos Necessários</Label>
            <Textarea
              id="observacao"
              placeholder="Instruções de implementação, verificação de eficácia..."
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !descricao.trim()}>
              {isLoading ? "Salvando..." : acao ? "Atualizar Ação" : "Registrar Ação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
