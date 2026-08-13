import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SgsstAprRisco, SgsstAprRiscoInput } from "@/hooks/sgsst/useSgsstApr";
import { SgsstRisco } from "@/hooks/sgsst/useSgsstRiscos";
import { calcularClassificacaoRisco } from "@/utils/sgsstRiscoMatrix";
import { AlertTriangle, ShieldCheck } from "lucide-react";

interface AprRiscoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  etapaId: string;
  riscoItem?: SgsstAprRisco | null;
  riscosCatalogo: SgsstRisco[];
  onSave: (data: SgsstAprRiscoInput) => Promise<void>;
  isLoading?: boolean;
}

export function AprRiscoFormDialog({
  open,
  onOpenChange,
  etapaId,
  riscoItem,
  riscosCatalogo,
  onSave,
  isLoading = false,
}: AprRiscoFormDialogProps) {
  const [riscoCatalogoId, setRiscoCatalogoId] = useState<string>("none");
  const [perigo, setPerigo] = useState("");
  const [risco, setRisco] = useState("");
  const [consequencia, setConsequencia] = useState("");
  const [probabilidade, setProbabilidade] = useState<number>(1);
  const [severidade, setSeveridade] = useState<number>(1);

  useEffect(() => {
    if (riscoItem) {
      setRiscoCatalogoId(riscoItem.risco_catalogo_id || "none");
      setPerigo(riscoItem.perigo || "");
      setRisco(riscoItem.risco || "");
      setConsequencia(riscoItem.consequencia || "");
      setProbabilidade(riscoItem.probabilidade || 1);
      setSeveridade(riscoItem.severidade || 1);
    } else {
      setRiscoCatalogoId("none");
      setPerigo("");
      setRisco("");
      setConsequencia("");
      setProbabilidade(1);
      setSeveridade(1);
    }
  }, [riscoItem, open]);

  const handleSelectRiscoCatalogo = (id: string) => {
    setRiscoCatalogoId(id);
    if (id !== "none") {
      const found = riscosCatalogo.find((r) => r.id === id);
      if (found) {
        if (!perigo) setPerigo(found.nome);
        if (!risco) setRisco(found.agente || found.nome);
        if (!consequencia && found.consequencia) setConsequencia(found.consequencia);
      }
    }
  };

  const { nivel, classificacao } = calcularClassificacaoRisco(probabilidade, severidade);

  const getClassificacaoBadgeColor = (c: string) => {
    switch (c) {
      case "BAIXO":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "MODERADO":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "ALTO":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "CRÍTICO":
        return "bg-red-100 text-red-800 border-red-300 font-bold";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perigo.trim() || !risco.trim()) return;

    await onSave({
      etapa_id: etapaId,
      risco_catalogo_id: riscoCatalogoId === "none" ? null : riscoCatalogoId,
      perigo: perigo.trim(),
      risco: risco.trim(),
      consequencia: consequencia.trim() || null,
      probabilidade,
      severidade,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {riscoItem ? "Editar Risco da Etapa" : "Adicionar Risco à Etapa"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="riscoCatalogo">Vincular Risco do Catálogo</Label>
            <Select value={riscoCatalogoId} onValueChange={handleSelectRiscoCatalogo}>
              <SelectTrigger id="riscoCatalogo">
                <SelectValue placeholder="Selecione do catálogo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Risco Específico da APR --</SelectItem>
                {riscosCatalogo.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    [{r.categoria}] {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="perigo">Perigo / Fator de Risco *</Label>
              <Input
                id="perigo"
                placeholder="Ex: Trabalho em altura sem cinto de segurança"
                value={perigo}
                onChange={(e) => setPerigo(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="risco">Risco Associado *</Label>
              <Input
                id="risco"
                placeholder="Ex: Queda de nível diferente / colisão com solo"
                value={risco}
                onChange={(e) => setRisco(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="consequencia">Consequências / Danos à Saúde</Label>
            <Input
              id="consequencia"
              placeholder="Ex: Traumatismo craniano, fraturas múltiplas, óbito"
              value={consequencia}
              onChange={(e) => setConsequencia(e.target.value)}
            />
          </div>

          {/* MATRIZ DE RISCO 5x5 */}
          <div className="bg-muted/40 p-3 rounded-md border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 text-primary">
                <ShieldCheck className="h-4 w-4" /> Matriz de Risco Ocupacional (P × S)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Nível N: <strong>{nivel}</strong></span>
                <Badge variant="outline" className={getClassificacaoBadgeColor(classificacao)}>
                  {classificacao}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="probabilidade" className="text-xs">Probabilidade (1 a 5)</Label>
                <Select
                  value={probabilidade.toString()}
                  onValueChange={(val) => setProbabilidade(parseInt(val))}
                >
                  <SelectTrigger id="probabilidade" className="text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Rara</SelectItem>
                    <SelectItem value="2">2 — Improvável</SelectItem>
                    <SelectItem value="3">3 — Possível</SelectItem>
                    <SelectItem value="4">4 — Provável</SelectItem>
                    <SelectItem value="5">5 — Quase certa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="severidade" className="text-xs">Severidade (1 a 5)</Label>
                <Select
                  value={severidade.toString()}
                  onValueChange={(val) => setSeveridade(parseInt(val))}
                >
                  <SelectTrigger id="severidade" className="text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Insignificante</SelectItem>
                    <SelectItem value="2">2 — Leve</SelectItem>
                    <SelectItem value="3">3 — Moderada</SelectItem>
                    <SelectItem value="4">4 — Grave</SelectItem>
                    <SelectItem value="5">5 — Catastrófica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !perigo.trim() || !risco.trim()}>
              {isLoading ? "Salvando..." : riscoItem ? "Atualizar Risco" : "Salvar Risco"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
