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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImpostosModalProps {
  isOpen: boolean;
  onClose: () => void;
  id: string | null;
}

export function ImpostosModal({ isOpen, onClose, id }: ImpostosModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [projetoId, setProjetoId] = useState("");
  
  const [issqn, setIssqn] = useState(0);
  const [pis, setPis] = useState(0);
  const [cofins, setCofins] = useState(0);
  const [inss, setInss] = useState(0);
  const [dara, setDara] = useState(0);
  const [icms, setIcms] = useState(0);
  const [irpj, setIrpj] = useState(0);
  const [csll, setCsll] = useState(0);

  const { data: projetos } = useQuery({
    queryKey: ["projetos_select_impostos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome, codigo, area_analise")
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const selectedProjeto = projetos?.find(p => p.id === projetoId);

  const { data: editingData } = useQuery({
    queryKey: ["projeto_impostos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_impostos")
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
      setIssqn(editingData.perc_issqn * 100);
      setPis(editingData.perc_pis * 100);
      setCofins(editingData.perc_cofins * 100);
      setInss(editingData.perc_inss * 100);
      setDara(editingData.perc_dara * 100);
      setIcms(editingData.perc_icms * 100);
      setIrpj((editingData.perc_irpj || 0) * 100);
      setCsll((editingData.perc_csll || 0) * 100);
    } else {
      setProjetoId("");
      setIssqn(0);
      setPis(0);
      setCofins(0);
      setInss(0);
      setDara(0);
      setIcms(0);
      setIrpj(0);
      setCsll(0);
    }
  }, [editingData, isOpen]);

  const totalImpostos = (issqn + pis + cofins + inss + dara + icms + irpj + csll) / 100;
  const pocExemplo = 100000;
  const deducoes = pocExemplo * totalImpostos;
  const receitaLiquida = pocExemplo - deducoes;
  const bdiFator = 1 / (1 - totalImpostos);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        projeto_id: projetoId,
        perc_issqn: issqn / 100,
        perc_pis: pis / 100,
        perc_cofins: cofins / 100,
        perc_inss: inss / 100,
        perc_dara: dara / 100,
        perc_icms: icms / 100,
        perc_irpj: irpj / 100,
        perc_csll: csll / 100,
      };

      if (id) {
        const { error } = await supabase
          .from("projeto_impostos")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("projeto_impostos")
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto_impostos"] });
      toast({ title: "Sucesso", description: "Configuração de impostos salva." });
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

  const applyPreset = (type: 'limpar') => {
    if (type === 'limpar') {
      setIssqn(0); setPis(0); setCofins(0); setInss(0); setDara(0); setIcms(0); setIrpj(0); setCsll(0);
    }
  };

  const formatPerc = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2 }).format(val);
  
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {selectedProjeto ? (
              `${selectedProjeto.nome} — ${selectedProjeto.codigo} | Área: ${selectedProjeto.area_analise || "N/A"}`
            ) : (
              "Configurar Impostos do Projeto"
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!id && (
            <div className="space-y-2">
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
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-2">
              <Label>ISSQN</Label>
              <div className="relative">
                <Input type="number" step="0.01" value={issqn} onChange={(e) => setIssqn(Number(e.target.value))} />
                <span className="absolute right-3 top-2.5 text-muted-foreground text-xs">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">ISS sobre serviços</p>
            </div>
            <div className="space-y-2">
              <Label>PIS</Label>
              <div className="relative">
                <Input type="number" step="0.01" value={pis} onChange={(e) => setPis(Number(e.target.value))} />
                <span className="absolute right-3 top-2.5 text-muted-foreground text-xs">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Programa Integração</p>
            </div>
            <div className="space-y-2">
              <Label>COFINS</Label>
              <div className="relative">
                <Input type="number" step="0.01" value={cofins} onChange={(e) => setCofins(Number(e.target.value))} />
                <span className="absolute right-3 top-2.5 text-muted-foreground text-xs">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Contribuição Social</p>
            </div>
            <div className="space-y-2">
              <Label>INSS</Label>
              <div className="relative">
                <Input type="number" step="0.01" value={inss} onChange={(e) => setInss(Number(e.target.value))} />
                <span className="absolute right-3 top-2.5 text-muted-foreground text-xs">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Retenção Prev.</p>
            </div>
            <div className="space-y-2">
              <Label>DARA</Label>
              <div className="relative">
                <Input type="number" step="0.01" value={dara} onChange={(e) => setDara(Number(e.target.value))} />
                <span className="absolute right-3 top-2.5 text-muted-foreground text-xs">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Contrib. Estadual</p>
            </div>
            <div className="space-y-2">
              <Label>ICMS</Label>
              <div className="relative">
                <Input type="number" step="0.01" value={icms} onChange={(e) => setIcms(Number(e.target.value))} />
                <span className="absolute right-3 top-2.5 text-muted-foreground text-xs">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Imposto Circulação</p>
            </div>
            <div className="space-y-2">
              <Label>IRPJ</Label>
              <div className="relative">
                <Input type="number" step="0.01" value={irpj} onChange={(e) => setIrpj(Number(e.target.value))} />
                <span className="absolute right-3 top-2.5 text-muted-foreground text-xs">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Imposto de Renda</p>
            </div>
            <div className="space-y-2">
              <Label>CSLL</Label>
              <div className="relative">
                <Input type="number" step="0.01" value={csll} onChange={(e) => setCsll(Number(e.target.value))} />
                <span className="absolute right-3 top-2.5 text-muted-foreground text-xs">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Contrib. Social s/ Lucro</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => applyPreset('limpar')}>
              Limpar tudo
            </Button>
          </div>

          <div className="p-4 rounded-lg bg-muted border space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-lg">TOTAL IMPOSTOS:</span>
              <span className="font-bold text-xl text-primary">{formatPerc(totalImpostos)}</span>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Para POC de {formatCurrency(pocExemplo)}:</p>
              <div className="flex justify-between">
                <span>→ Deduções:</span>
                <span className="font-medium text-destructive">{formatCurrency(deducoes)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span>→ Receita Líquida:</span>
                <span className="font-bold text-green-600">{formatCurrency(receitaLiquida)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-2">
                <span>→ BDI fator:</span>
                <span>{bdiFator.toFixed(4)}</span>
              </div>
            </div>
          </div>

          {issqn > 0 && icms > 0 && (
            <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription>
                Atenção: ISSQN e ICMS preenchidos simultaneamente. Verifique se o regime do projeto realmente incide ambos os impostos.
              </AlertDescription>
            </Alert>
          )}

          {totalImpostos > 0.25 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Alíquota incomum ({formatPerc(totalImpostos)}). Verifique com o departamento Fiscal.
              </AlertDescription>
            </Alert>
          )}

          {totalImpostos === 0 && projetoId && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle>Sem impostos configurados</AlertTitle>
              <AlertDescription>
                Atenção: sem impostos configurados. Receita Líquida = POC bruto.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending || !projetoId}
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
