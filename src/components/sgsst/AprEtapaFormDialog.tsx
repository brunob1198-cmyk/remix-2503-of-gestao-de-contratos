import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstAprEtapa, SgsstAprEtapaInput } from "@/hooks/sgsst/useSgsstApr";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ListOrdered } from "lucide-react";

interface AprEtapaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aprId: string;
  etapa?: SgsstAprEtapa | null;
  nextOrdem: number;
  onSave: (data: SgsstAprEtapaInput) => Promise<void>;
  isLoading?: boolean;
}

export function AprEtapaFormDialog({
  open,
  onOpenChange,
  aprId,
  etapa,
  nextOrdem,
  onSave,
  isLoading = false,
}: AprEtapaFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [ordem, setOrdem] = useState<number>(1);
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>("none");
  const [observacoes, setObservacoes] = useState("");

  // Load responsaveis
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis_etapa", empresaId],
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
    if (etapa) {
      setOrdem(etapa.ordem || 1);
      setDescricao(etapa.descricao || "");
      setResponsavelId(etapa.responsavel_id || "none");
      setObservacoes(etapa.observacoes || "");
    } else {
      setOrdem(nextOrdem);
      setDescricao("");
      setResponsavelId("none");
      setObservacoes("");
    }
  }, [etapa, nextOrdem, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) return;

    await onSave({
      apr_id: aprId,
      ordem,
      descricao: descricao.trim(),
      responsavel_id: responsavelId === "none" ? null : responsavelId,
      observacoes: observacoes.trim() || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-primary" />
            {etapa ? "Editar Etapa da Tarefa" : "Nova Etapa da Tarefa"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ordem">Ordem *</Label>
              <Input
                id="ordem"
                type="number"
                min={1}
                value={ordem}
                onChange={(e) => setOrdem(parseInt(e.target.value) || 1)}
                required
              />
            </div>

            <div className="space-y-1.5 col-span-3">
              <Label htmlFor="descricao">Descrição da Etapa *</Label>
              <Input
                id="descricao"
                placeholder="Ex: Sinalização, isolamento da área e inspeção dos cabos de aço"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="responsavel">Encarregado / Responsável da Etapa</Label>
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
            <Label htmlFor="observacoes">Instruções / Observações Específicas</Label>
            <Textarea
              id="observacoes"
              placeholder="Cuidados específicos durante a execução desta etapa..."
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !descricao.trim()}>
              {isLoading ? "Salvando..." : etapa ? "Atualizar Etapa" : "Salvar Etapa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
