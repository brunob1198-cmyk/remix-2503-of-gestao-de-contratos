import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SgsstPgrInventario, SgsstPgrInventarioInput, calcularClassificacaoRisco } from "@/hooks/sgsst/useSgsstPgr";
import { SgsstRisco } from "@/hooks/sgsst/useSgsstRiscos";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, ShieldCheck } from "lucide-react";

interface PgrInventarioFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pgrId: string;
  inventarioItem?: SgsstPgrInventario | null;
  riscosCatalogo: SgsstRisco[];
  onSave: (data: SgsstPgrInventarioInput) => Promise<void>;
  isLoading?: boolean;
}

export function PgrInventarioFormDialog({
  open,
  onOpenChange,
  pgrId,
  inventarioItem,
  riscosCatalogo,
  onSave,
  isLoading = false,
}: PgrInventarioFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [riscoCatalogoId, setRiscoCatalogoId] = useState<string>("none");
  const [areaId, setAreaId] = useState<string>("none");
  const [atividade, setAtividade] = useState("");
  const [perigo, setPerigo] = useState("");
  const [fonteGeradora, setFonteGeradora] = useState("");
  const [consequencia, setConsequencia] = useState("");
  const [trabalhadoresExpostos, setTrabalhadoresExpostos] = useState<number>(1);
  const [probabilidade, setProbabilidade] = useState<number>(1);
  const [severidade, setSeveridade] = useState<number>(1);
  const [medidasExistentes, setMedidasExistentes] = useState("");
  const [medidasNecessarias, setMedidasNecessarias] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>("none");
  const [prazo, setPrazo] = useState("");
  const [status, setStatus] = useState<"pendente" | "em_andamento" | "concluido" | "cancelado">("pendente");

  // Load areas (setores)
  const { data: areas = [] } = useQuery({
    queryKey: ["areas_inventario", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("id, nome")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Load responsaveis (profiles)
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis_inventario", empresaId],
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
    if (inventarioItem) {
      setRiscoCatalogoId(inventarioItem.risco_catalogo_id || "none");
      setAreaId(inventarioItem.area_id || "none");
      setAtividade(inventarioItem.atividade || "");
      setPerigo(inventarioItem.perigo || "");
      setFonteGeradora(inventarioItem.fonte_geradora || "");
      setConsequencia(inventarioItem.consequencia || "");
      setTrabalhadoresExpostos(inventarioItem.trabalhadores_expostos || 1);
      setProbabilidade(inventarioItem.probabilidade || 1);
      setSeveridade(inventarioItem.severidade || 1);
      setMedidasExistentes(inventarioItem.medidas_existentes || "");
      setMedidasNecessarias(inventarioItem.medidas_necessarias || "");
      setResponsavelId(inventarioItem.responsavel_id || "none");
      setPrazo(inventarioItem.prazo ? inventarioItem.prazo.split("T")[0] : "");
      setStatus(inventarioItem.status || "pendente");
    } else {
      setRiscoCatalogoId("none");
      setAreaId("none");
      setAtividade("");
      setPerigo("");
      setFonteGeradora("");
      setConsequencia("");
      setTrabalhadoresExpostos(1);
      setProbabilidade(1);
      setSeveridade(1);
      setMedidasExistentes("");
      setMedidasNecessarias("");
      setResponsavelId("none");
      setPrazo("");
      setStatus("pendente");
    }
  }, [inventarioItem, open]);

  // When selecting a risk from catalog, pre-fill values
  const handleSelectRiscoCatalogo = (id: string) => {
    setRiscoCatalogoId(id);
    if (id !== "none") {
      const found = riscosCatalogo.find((r) => r.id === id);
      if (found) {
        if (!perigo) setPerigo(found.nome);
        if (!fonteGeradora && found.fonte_geradora) setFonteGeradora(found.fonte_geradora);
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
    if (!atividade.trim() || !perigo.trim()) return;

    await onSave({
      pgr_id: pgrId,
      risco_catalogo_id: riscoCatalogoId === "none" ? null : riscoCatalogoId,
      area_id: areaId === "none" ? null : areaId,
      atividade: atividade.trim(),
      perigo: perigo.trim(),
      fonte_geradora: fonteGeradora.trim() || null,
      consequencia: consequencia.trim() || null,
      trabalhadores_expostos: trabalhadoresExpostos || 1,
      probabilidade,
      severidade,
      medidas_existentes: medidasExistentes.trim() || null,
      medidas_necessarias: medidasNecessarias.trim() || null,
      responsavel_id: responsavelId === "none" ? null : responsavelId,
      prazo: prazo || null,
      status,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {inventarioItem ? "Editar Risco no Inventário PGR" : "Incluir Risco no Inventário PGR"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="riscoCatalogo">Vincular Risco do Catálogo</Label>
              <Select value={riscoCatalogoId} onValueChange={handleSelectRiscoCatalogo}>
                <SelectTrigger id="riscoCatalogo">
                  <SelectValue placeholder="Selecione do catálogo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Risco Personalizado / Fora do Catálogo --</SelectItem>
                  {riscosCatalogo.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      [{r.categoria}] {r.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="area">Setor / Área de Exposição</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger id="area">
                  <SelectValue placeholder="Selecione o setor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Geral do Canteiro --</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="atividade">Atividade / Operação Avaliada *</Label>
              <Input
                id="atividade"
                placeholder="Ex: Escavação de vala com retroescavadeira"
                value={atividade}
                onChange={(e) => setAtividade(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expostos">Trabalhadores Expostos</Label>
              <Input
                id="expostos"
                type="number"
                min={1}
                value={trabalhadoresExpostos}
                onChange={(e) => setTrabalhadoresExpostos(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="perigo">Perigo / Fator de Risco *</Label>
            <Input
              id="perigo"
              placeholder="Ex: Risco de desmoronamento de terra em vala aberta"
              value={perigo}
              onChange={(e) => setPerigo(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fonte">Fonte Geradora / Agente</Label>
              <Input
                id="fonte"
                placeholder="Ex: Solo não escorado e vibração de veículo próximo"
                value={fonteGeradora}
                onChange={(e) => setFonteGeradora(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consequencia">Consequências / Lesões</Label>
              <Input
                id="consequencia"
                placeholder="Ex: Soterramento, fraturas, asfixia, óbito"
                value={consequencia}
                onChange={(e) => setConsequencia(e.target.value)}
              />
            </div>
          </div>

          {/* MATRIZ DE RISCO 5x5 */}
          <div className="bg-muted/40 p-3 rounded-md border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 text-primary">
                <ShieldCheck className="h-4 w-4" /> Matriz de Risco Ocupacional (Probabilidade × Severidade)
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
                    <SelectItem value="1">1 — Rara (Raríssima ocorrência)</SelectItem>
                    <SelectItem value="2">2 — Improvável (Ocorrência eventual)</SelectItem>
                    <SelectItem value="3">3 — Possível (Pode ocorrer algumas vezes)</SelectItem>
                    <SelectItem value="4">4 — Provável (Ocorre com frequência)</SelectItem>
                    <SelectItem value="5">5 — Quase certa (Ocorrência contínua/habitual)</SelectItem>
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
                    <SelectItem value="1">1 — Insignificante (Primeiros socorros leves)</SelectItem>
                    <SelectItem value="2">2 — Leve (Lesão sem afastamento / atendimento simples)</SelectItem>
                    <SelectItem value="3">3 — Moderada (Lesão com afastamento / sem sequelas)</SelectItem>
                    <SelectItem value="4">4 — Grave (Lesão grave / incapacidade permanente parcial)</SelectItem>
                    <SelectItem value="5">5 — Catastrófica (Incapacidade total permanente / óbito)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="existentes">Medidas de Controle Existentes</Label>
            <Textarea
              id="existentes"
              placeholder="Descreva as proteções e EPIs já implementados..."
              rows={2}
              value={medidasExistentes}
              onChange={(e) => setMedidasExistentes(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="necessarias">Medidas de Controle Necessárias / Plano de Ação</Label>
            <Textarea
              id="necessarias"
              placeholder="Descreva as adequações e ações corretivas a serem implementadas..."
              rows={2}
              value={medidasNecessarias}
              onChange={(e) => setMedidasNecessarias(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="responsavel">Responsável da Ação</Label>
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
              <Label htmlFor="status">Status do Risco</Label>
              <Select
                value={status}
                onValueChange={(val: "pendente" | "em_andamento" | "concluido" | "cancelado") => setStatus(val)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !atividade.trim() || !perigo.trim()}>
              {isLoading ? "Salvando..." : inventarioItem ? "Atualizar Risco" : "Salvar no Inventário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
