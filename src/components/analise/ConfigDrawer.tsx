import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { AlertTriangle, Info, CheckCircle2, Calculator, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ConfigDrawerProps {
  projetoId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const AREAS = [
  "EQUIP", "REDE_TELECOM", "REDE_ITS", "ITS", "O_M", 
  "PROJETO", "INFRA", "SOLAR", "LOCACAO"
];

export function ConfigDrawer({ projetoId, isOpen, onOpenChange }: ConfigDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("impostos");

  // --- IMPOSTOS STATE ---
  const [issqn, setIssqn] = useState(0);
  const [pis, setPis] = useState(0);
  const [cofins, setCofins] = useState(0);
  const [inss, setInss] = useState(0);
  const [dara, setDara] = useState(0);
  const [icms, setIcms] = useState(0);
  const [irpj, setIrpj] = useState(0);
  const [csll, setCsll] = useState(0);

  // --- MKP STATE ---
  const [obraCodigo, setObraCodigo] = useState("");
  const [area, setArea] = useState("");
  const [percCustoDireto, setPercCustoDireto] = useState(0);
  const [percGerencia, setPercGerencia] = useState(0);
  const [percRisco, setPercRisco] = useState(0);
  const [percTreinamento, setPercTreinamento] = useState(0);
  const [percInflacao, setPercInflacao] = useState(0);

  // Queries
  const { data: projeto } = useQuery({
    queryKey: ["projeto", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome, codigo, area_analise")
        .eq("id", projetoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId && isOpen,
  });

  const { data: impostoData, isLoading: isLoadingImpostos } = useQuery({
    queryKey: ["projeto_impostos", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_impostos")
        .select("*")
        .eq("projeto_id", projetoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId && isOpen,
  });

  const { data: mkpData, isLoading: isLoadingMkp } = useQuery({
    queryKey: ["mkp_parametros", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkp_parametros")
        .select("*")
        .eq("projeto_id", projetoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId && isOpen,
  });

  useEffect(() => {
    if (impostoData) {
      setIssqn(impostoData.perc_issqn * 100);
      setPis(impostoData.perc_pis * 100);
      setCofins(impostoData.perc_cofins * 100);
      setInss(impostoData.perc_inss * 100);
      setDara(impostoData.perc_dara * 100);
      setIcms(impostoData.perc_icms * 100);
      setIrpj((impostoData.perc_irpj || 0) * 100);
      setCsll((impostoData.perc_csll || 0) * 100);
    } else {
      setIssqn(0); setPis(0); setCofins(0); setInss(0); setDara(0); setIcms(0); setIrpj(0); setCsll(0);
    }
  }, [impostoData]);

  useEffect(() => {
    if (mkpData) {
      setObraCodigo(mkpData.obra_codigo || "");
      setArea(mkpData.area || "");
      setPercCustoDireto(mkpData.perc_custo_direto * 100);
      setPercGerencia(mkpData.perc_gerencia * 100);
      setPercRisco(mkpData.perc_risco * 100);
      setPercTreinamento(mkpData.perc_treinamento * 100);
      setPercInflacao(mkpData.perc_inflacao * 100);
    } else {
      setObraCodigo(""); setArea(""); setPercCustoDireto(0); setPercGerencia(0); setPercRisco(0); setPercTreinamento(0); setPercInflacao(0);
    }
  }, [mkpData]);

  const totalImpostos = (issqn + pis + cofins + inss + dara + icms + irpj + csll) / 100;
  const percTotalCustos = (percCustoDireto + percGerencia + percRisco + percTreinamento + percInflacao) / 100;
  const percMbEsperado = 1 - percTotalCustos - totalImpostos;
  const bdiVenda = 1 / (1 - totalImpostos);

  const saveImpostos = useMutation({
    mutationFn: async () => {
      const payload = {
        projeto_id: projetoId,
        perc_issqn: issqn / 100,
        perc_pis: pis / 100,
        perc_cofins: cofins / 100,
        perc_inss: inss / 100,
        perc_dara: dara / 100,
        perc_icms: icms / 100,
      };

      if (impostoData?.id) {
        const { error } = await supabase.from("projeto_impostos").update(payload).eq("id", impostoData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projeto_impostos").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto_impostos"] });
      queryClient.invalidateQueries({ queryKey: ["mkp_parametros"] });
      queryClient.invalidateQueries({ queryKey: ["analise_obra"] });
      toast({ title: "Sucesso", description: "Impostos salvos com sucesso." });
    },
  });

  const saveMkp = useMutation({
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

      if (mkpData?.id) {
        const { error } = await supabase.from("mkp_parametros").update(payload).eq("id", mkpData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mkp_parametros").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mkp_parametros"] });
      queryClient.invalidateQueries({ queryKey: ["analise_obra"] });
      toast({ title: "Sucesso", description: "Parâmetros MKP salvos com sucesso." });
    },
  });

  const formatPerc = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2 }).format(val);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configuração do Projeto</SheetTitle>
          <SheetDescription>
            {projeto?.codigo} - {projeto?.nome}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="impostos" className="gap-2">
              <Receipt className="h-4 w-4" /> Impostos
            </TabsTrigger>
            <TabsTrigger value="mkp" className="gap-2">
              <Calculator className="h-4 w-4" /> MKP
            </TabsTrigger>
          </TabsList>

          <TabsContent value="impostos" className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ISSQN (%)</Label>
                <Input type="number" step="0.01" value={issqn} onChange={e => setIssqn(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>PIS (%)</Label>
                <Input type="number" step="0.01" value={pis} onChange={e => setPis(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>COFINS (%)</Label>
                <Input type="number" step="0.01" value={cofins} onChange={e => setCofins(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>INSS (%)</Label>
                <Input type="number" step="0.01" value={inss} onChange={e => setInss(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>DARA (%)</Label>
                <Input type="number" step="0.01" value={dara} onChange={e => setDara(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>ICMS (%)</Label>
                <Input type="number" step="0.01" value={icms} onChange={e => setIcms(Number(e.target.value))} />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted border">
              <div className="flex justify-between items-center font-bold">
                <span>Total Impostos:</span>
                <span className="text-primary text-xl">{formatPerc(totalImpostos)}</span>
              </div>
            </div>

            <Button className="w-full" onClick={() => saveImpostos.mutate()} disabled={saveImpostos.isPending}>
              {saveImpostos.isPending ? "Salvando..." : "Salvar Impostos"}
            </Button>
          </TabsContent>

          <TabsContent value="mkp" className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código da Obra</Label>
                <Input value={obraCodigo} onChange={e => setObraCodigo(e.target.value)} placeholder="E000.00" />
              </div>
              <div className="space-y-2">
                <Label>Área</Label>
                <Select value={area} onValueChange={setArea}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {AREAS.map(a => <SelectItem key={a} value={a}>{a.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>% Custo Direto</Label>
                <Input type="number" step="0.01" value={percCustoDireto} onChange={e => setPercCustoDireto(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>% Gerência</Label>
                <Input type="number" step="0.01" value={percGerencia} onChange={e => setPercGerencia(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>% Risco</Label>
                <Input type="number" step="0.01" value={percRisco} onChange={e => setPercRisco(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>% Treinamento</Label>
                <Input type="number" step="0.01" value={percTreinamento} onChange={e => setPercTreinamento(Number(e.target.value))} />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted border space-y-2">
              <div className="flex justify-between text-sm">
                <span>Impostos (do projeto):</span>
                <span className="font-semibold">{formatPerc(totalImpostos)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>MB Alvo Estimada:</span>
                <span className={percMbEsperado < 0.1 ? "text-red-500" : "text-green-600"}>
                  {formatPerc(percMbEsperado)}
                </span>
              </div>
            </div>

            <Button className="w-full" onClick={() => saveMkp.mutate()} disabled={saveMkp.isPending || !area}>
              {saveMkp.isPending ? "Salvando..." : "Salvar MKP"}
            </Button>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
