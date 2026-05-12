import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MkpParametrosModalProps {
  isOpen: boolean;
  onClose: () => void;
  id: string | null;
}

const AREAS = [
  "EQUIP", "REDE_TELECOM", "REDE_ITS", "ITS", "O_M", 
  "PROJETO", "INFRA", "SOLAR", "LOCACAO"
];

export function MkpParametrosModal({ isOpen, onClose, id }: MkpParametrosModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [projetoId, setProjetoId] = useState("");
  const [obraCodigo, setObraCodigo] = useState("");
  const [area, setArea] = useState("");
  
  const [percCustoDireto, setPercCustoDireto] = useState(0);
  const [percGerencia, setPercGerencia] = useState(0);
  const [percRisco, setPercRisco] = useState(0);
  const [percTreinamento, setPercTreinamento] = useState(0);
  const [percInflacao, setPercInflacao] = useState(0);

  const { data: projetos } = useQuery({
    queryKey: ["projetos_select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome, codigo")
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const { data: impostoData } = useQuery({
    queryKey: ["projeto_impostos", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_impostos")
        .select("perc_total_impostos")
        .eq("projeto_id", projetoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId,
  });

  const { data: editingData } = useQuery({
    queryKey: ["mkp_parametros", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkp_parametros")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && isOpen,
  });

  useEffect(() => {
    if (editingData) {
      setProjetoId(editingData.projeto_id || "");
      setObraCodigo(editingData.obra_codigo || "");
      setArea(editingData.area || "");
      setPercCustoDireto(editingData.perc_custo_direto * 100);
      setPercGerencia(editingData.perc_gerencia * 100);
      setPercRisco(editingData.perc_risco * 100);
      setPercTreinamento(editingData.perc_treinamento * 100);
      setPercInflacao(editingData.perc_inflacao * 100);
    } else {
      setProjetoId("");
      setObraCodigo("");
      setArea("");
      setPercCustoDireto(0);
      setPercGerencia(0);
      setPercRisco(0);
      setPercTreinamento(0);
      setPercInflacao(0);
    }
  }, [editingData, isOpen]);

  const percImpostos = impostoData?.perc_total_impostos || 0;
  const percTotalCustos = (percCustoDireto + percGerencia + percRisco + percTreinamento + percInflacao) / 100;
  const percMbEsperado = 1 - percTotalCustos - percImpostos;
  const bdiVenda = 1 / (1 - percImpostos);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        projeto_id: projetoId,
        obra_codigo: obraCodigo,
        area,
        perc_custo_direto: percCustoDireto / 100,
        perc_gerencia: percGerencia / 100,
        perc_risco: percRisco / 100,
        perc_treinamento: percTreinamento / 100,
        perc_inflacao: percInflacao / 100,
        perc_mb_esperado: percMbEsperado,
        bdi_venda: bdiVenda,
      };

      if (id) {
        const { error } = await supabase
          .from("mkp_parametros")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("mkp_parametros")
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mkp_parametros"] });
      toast({ title: "Sucesso", description: "Parâmetros salvos com sucesso." });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getMbColor = (val: number) => {
    if (val >= 0.20) return "text-green-600";
    if (val >= 0.10) return "text-yellow-600";
    return "text-red-600";
  };

  const formatPerc = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2 }).format(val);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{id ? "Editar" : "Novo"} Parâmetro MKP</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="col-span-2 space-y-2">
            <Label>Projeto</Label>
            <Select value={projetoId} onValueChange={setProjetoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent>
                {projetos?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo} - {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Código da Obra</Label>
            <Input 
              placeholder="Ex: E034.24" 
              value={obraCodigo} 
              onChange={(e) => setObraCodigo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Área</Label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a área" />
              </SelectTrigger>
              <SelectContent>
                {AREAS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>% Custo Direto</Label>
            <div className="relative">
              <Input 
                type="number" 
                step="0.01"
                value={percCustoDireto} 
                onChange={(e) => setPercCustoDireto(Number(e.target.value))}
              />
              <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>% Gerência Contrato</Label>
            <div className="relative">
              <Input 
                type="number" 
                step="0.01"
                value={percGerencia} 
                onChange={(e) => setPercGerencia(Number(e.target.value))}
              />
              <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>% Risco Orçamentário</Label>
            <div className="relative">
              <Input 
                type="number" 
                step="0.01"
                value={percRisco} 
                onChange={(e) => setPercRisco(Number(e.target.value))}
              />
              <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>% Treinamento</Label>
            <div className="relative">
              <Input 
                type="number" 
                step="0.01"
                value={percTreinamento} 
                onChange={(e) => setPercTreinamento(Number(e.target.value))}
              />
              <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>% Inflação Futura</Label>
            <div className="relative">
              <Input 
                type="number" 
                step="0.01"
                value={percInflacao} 
                onChange={(e) => setPercInflacao(Number(e.target.value))}
              />
              <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
            </div>
          </div>

          <div className="col-span-2 space-y-4 pt-4 border-t">
            <div className="flex justify-between text-sm font-medium">
              <span>Distribuição de Valores</span>
              <span className={getMbColor(percMbEsperado)}>
                MB Esperada: {formatPerc(percMbEsperado)}
              </span>
            </div>
            
            <div className="h-4 flex rounded-full overflow-hidden bg-muted">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div style={{ width: `${percCustoDireto}%` }} className="bg-blue-500 h-full" />
                  </TooltipTrigger>
                  <TooltipContent>Custo Direto: {percCustoDireto}%</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div style={{ width: `${percGerencia}%` }} className="bg-indigo-500 h-full" />
                  </TooltipTrigger>
                  <TooltipContent>Gerência: {percGerencia}%</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div style={{ width: `${percRisco}%` }} className="bg-amber-500 h-full" />
                  </TooltipTrigger>
                  <TooltipContent>Risco: {percRisco}%</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div style={{ width: `${percTreinamento + percInflacao}%` }} className="bg-orange-500 h-full" />
                  </TooltipTrigger>
                  <TooltipContent>Outros: {percTreinamento + percInflacao}%</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div style={{ width: `${percImpostos * 100}%` }} className="bg-red-500 h-full" />
                  </TooltipTrigger>
                  <TooltipContent>Impostos: {formatPerc(percImpostos)}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div style={{ width: `${percMbEsperado * 100}%` }} className="bg-green-500 h-full" />
                  </TooltipTrigger>
                  <TooltipContent>MB: {formatPerc(percMbEsperado)}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-muted-foreground">Impostos do Projeto:</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {projetoId ? (impostoData ? formatPerc(percImpostos) : "—") : "Selecione o projeto"}
                  </span>
                  {!impostoData && projetoId && (
                    <span className="text-destructive flex items-center gap-1 text-[10px]">
                      <AlertTriangle className="h-3 w-3" /> Impostos não configurados
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">BDI Venda:</span>
                <div className="font-semibold flex items-center gap-2">
                  {bdiVenda.toFixed(4)}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[200px]">
                        Fator: {bdiVenda.toFixed(4)} — significa que o POC é {((bdiVenda - 1) * 100).toFixed(2)}% maior que a Receita Líquida
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            {percMbEsperado < 0.10 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Margem muito baixa ({formatPerc(percMbEsperado)}). Revise os percentuais.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending || !projetoId || !area}
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
