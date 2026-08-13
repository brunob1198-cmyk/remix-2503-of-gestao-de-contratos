import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstInspecaoNaoConformidade, CriticidadeNC, StatusNC } from "@/hooks/sgsst/useSgsstInspecoes";
import { SgsstRisco } from "@/hooks/sgsst/useSgsstRiscos";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle } from "lucide-react";

interface InspecaoNaoConformidadeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspecaoId: string;
  itemId?: string | null;
  naoConformidade?: SgsstInspecaoNaoConformidade | null;
  riscosCatalogo: SgsstRisco[];
  onSave: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export function InspecaoNaoConformidadeFormDialog({
  open,
  onOpenChange,
  inspecaoId,
  itemId,
  naoConformidade,
  riscosCatalogo,
  onSave,
  isLoading = false,
}: InspecaoNaoConformidadeFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [descricao, setDescricao] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [criticidade, setCriticidade] = useState<CriticidadeNC>("MEDIA");
  const [responsavelId, setResponsavelId] = useState<string>("none");
  const [prazo, setPrazo] = useState("");
  const [status, setStatus] = useState<StatusNC>("ABERTA");
  const [riscoCatalogoId, setRiscoCatalogoId] = useState<string>("none");
  const [observacao, setObservacao] = useState("");

  // Load responsaveis
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis_nc", empresaId],
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
    if (naoConformidade) {
      setDescricao(naoConformidade.descricao || "");
      setEvidencia(naoConformidade.evidencia || "");
      setCriticidade(naoConformidade.criticidade || "MEDIA");
      setResponsavelId(naoConformidade.responsavel_id || "none");
      setPrazo(naoConformidade.prazo ? naoConformidade.prazo.split("T")[0] : "");
      setStatus(naoConformidade.status || "ABERTA");
      setRiscoCatalogoId(naoConformidade.risco_catalogo_id || "none");
      setObservacao(naoConformidade.observacao || "");
    } else {
      setDescricao("");
      setEvidencia("");
      setCriticidade("MEDIA");
      setResponsavelId("none");
      setPrazo("");
      setStatus("ABERTA");
      setRiscoCatalogoId("none");
      setObservacao("");
    }
  }, [naoConformidade, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) return;

    await onSave({
      inspecao_id: inspecaoId,
      item_id: itemId || naoConformidade?.item_id || null,
      risco_catalogo_id: riscoCatalogoId === "none" ? null : riscoCatalogoId,
      descricao: descricao.trim(),
      evidencia: evidencia.trim() || null,
      criticidade,
      responsavel_id: responsavelId === "none" ? null : responsavelId,
      prazo: prazo || null,
      status,
      observacao: observacao.trim() || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            {naoConformidade ? "Editar Não Conformidade" : "Registrar Não Conformidade"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição do Apontamento / Desvio *</Label>
            <Textarea
              id="descricao"
              placeholder="Descreva a condição insegura ou o desvio identificado na inspeção..."
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="criticidade">Criticidade *</Label>
              <Select value={criticidade} onValueChange={(val: CriticidadeNC) => setCriticidade(val)}>
                <SelectTrigger id="criticidade">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                  <SelectItem value="MEDIA">Média</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="CRITICA">Crítica (Risco Iminente)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="risco">Risco do Catálogo Associado</Label>
              <Select value={riscoCatalogoId} onValueChange={setRiscoCatalogoId}>
                <SelectTrigger id="risco">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Nenhum Risco Direto --</SelectItem>
                  {riscosCatalogo.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      [{r.categoria}] {r.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="responsavel">Responsável pelo Tratamento</Label>
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
              <Label htmlFor="prazo">Prazo de Adequação</Label>
              <Input
                id="prazo"
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status da NC</Label>
              <Select value={status} onValueChange={(val: StatusNC) => setStatus(val)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABERTA">Aberta</SelectItem>
                  <SelectItem value="EM_TRATAMENTO">Em Tratamento</SelectItem>
                  <SelectItem value="CONCLUIDA">Concluída / Sanada</SelectItem>
                  <SelectItem value="CANCELADA">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evidencia">Evidências / Descrição da Constatação</Label>
            <Input
              id="evidencia"
              placeholder="Ex: Foto tirada no setor norte, guarda-corpo ausente na laje superior..."
              value={evidencia}
              onChange={(e) => setEvidencia(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacao">Observações / Plano de Ação</Label>
            <Textarea
              id="observacao"
              placeholder="Ações corretivas propostas para eliminar a não conformidade..."
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
              {isLoading ? "Salvando..." : naoConformidade ? "Atualizar NC" : "Registrar Não Conformidade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
