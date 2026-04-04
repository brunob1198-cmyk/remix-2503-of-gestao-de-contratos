import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { FrenteObra, AtividadePlanejamento } from "@/hooks/usePlanejamento";
import { addDays, format, parseISO } from "date-fns";
import { useEscopos } from "@/hooks/useEscopos";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  frentes: FrenteObra[];
  atividades: AtividadePlanejamento[];
  onCreate: (data: any) => void;
  isLoading?: boolean;
}

export function AtividadeForm({ frentes, atividades, onCreate, isLoading }: Props) {
  const [open, setOpen] = useState(false);
  const [frenteId, setFrenteId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFimOverride, setDataFimOverride] = useState("");
  
  const [selectedLpus, setSelectedLpus] = useState<Record<string, { producao_diaria_prevista: string }>>({});
  const [principalLpuId, setPrincipalLpuId] = useState<string | null>(null);

  const selectedFrente = frentes.find(f => f.id === frenteId);
  const frenteSiteId = (selectedFrente as any)?.site_id;
  
  const { itens: escopoItens } = useEscopos(frenteSiteId);

  const toggleLpu = (id: string) => {
    setSelectedLpus((prev) => {
      const isSelected = !!prev[id];
      if (isSelected) {
        if (principalLpuId === id) setPrincipalLpuId(null);
        const next = { ...prev };
        delete next[id];
        return next;
      } else {
        return { ...prev, [id]: { producao_diaria_prevista: "1" } };
      }
    });
  };

  const setLpuProdDiaria = (id: string, value: string) => {
    setSelectedLpus((prev) => ({
      ...prev,
      [id]: { producao_diaria_prevista: value },
    }));
  };

  const handleSubmit = () => {
    if (!frenteId) return;
    
    const atividadesGeradas = Object.keys(selectedLpus).map(lpuId => {
      const escopoItem = escopoItens.find(e => e.item_lpu_id === lpuId);
      
      let endDStr = undefined;
      if (dataInicio && dataFimOverride) {
        endDStr = dataFimOverride;
      } else if (dataInicio) {
        const prodDiaria = Number(selectedLpus[lpuId].producao_diaria_prevista) || 1;
        const dur = Math.ceil(escopoItem ? escopoItem.quantidade / prodDiaria : 1);
        endDStr = format(addDays(parseISO(dataInicio), dur), "yyyy-MM-dd");
      }

      return {
        frente_id: frenteId,
        item_lpu_id: lpuId,
        nome: escopoItem ? escopoItem.nome : "Item Escopo",
        quantidade_total: escopoItem ? escopoItem.quantidade : 1,
        producao_diaria_prevista: Number(selectedLpus[lpuId].producao_diaria_prevista) || 1,
        is_principal: lpuId === principalLpuId,
        data_inicio: dataInicio || undefined,
        data_fim_prevista: endDStr,
        predecessoras: []
      };
    });

    onCreate(atividadesGeradas);
    
    setSelectedLpus({});
    setPrincipalLpuId(null);
    setDataInicio("");
    setDataFimOverride("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-1" /> Vincular Escopo (LPU)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vincular Itens do LPU à Frente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Frente *</Label>
            <Select value={frenteId} onValueChange={setFrenteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a frente" />
              </SelectTrigger>
              <SelectContent>
                {frentes.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Início (Geral)</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Data Fim Forçada (Opcional)</Label>
              <Input type="date" value={dataFimOverride} onChange={(e) => setDataFimOverride(e.target.value)} placeholder="Calcula aut. se vazio" />
            </div>
          </div>

          {frenteSiteId && escopoItens.length > 0 ? (
            <div className="border rounded-md p-3 mt-4">
              <Label className="mb-2 block font-semibold text-primary">Selecione os itens do Escopo para adicionar</Label>
              <ScrollArea className="h-[300px] border rounded p-2">
                <div className="space-y-3">
                  {escopoItens.map((item) => {
                    if (!item.item_lpu_id) return null;
                    const isSelected = !!selectedLpus[item.item_lpu_id];
                    return (
                      <div key={item.item_lpu_id} className="flex flex-col gap-1.5 pb-2 border-b last:border-0 last:pb-0">
                        <div className="flex items-start gap-2">
                          <Checkbox 
                            id={`lpu-${item.item_lpu_id}`} 
                            checked={isSelected}
                            onCheckedChange={() => toggleLpu(item.item_lpu_id as string)}
                          />
                          <div className="grid leading-tight">
                            <Label htmlFor={`lpu-${item.item_lpu_id}`} className="font-medium cursor-pointer text-sm">
                              {item.nome}
                            </Label>
                            <span className="text-xs text-muted-foreground">Qtd LPU: {item.quantidade} {item.unidade}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-4 pl-6 mt-1 flex-wrap shadow-sm bg-muted/30 p-2 rounded-md border mt-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs whitespace-nowrap font-semibold">Cota de Produção Diária:</Label>
                              <Input 
                                type="number" 
                                className="h-8 w-24 text-sm" 
                                value={selectedLpus[item.item_lpu_id].producao_diaria_prevista}
                                onChange={(e) => setLpuProdDiaria(item.item_lpu_id as string, e.target.value)}
                              />
                              <span className="text-xs text-muted-foreground font-semibold uppercase">{item.unidade}/dia</span>
                            </div>
                            <div className="flex items-center gap-2 border-l border-muted-foreground/30 pl-4">
                              <Checkbox 
                                id={`princ-${item.item_lpu_id}`} 
                                checked={principalLpuId === item.item_lpu_id}
                                onCheckedChange={(checked) => setPrincipalLpuId(checked ? item.item_lpu_id as string : null)}
                              />
                              <Label htmlFor={`princ-${item.item_lpu_id}`} className="text-xs cursor-pointer text-purple-600 font-bold whitespace-nowrap">Marcar como Ativ. Principal</Label>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="bg-muted p-4 text-sm text-center text-muted-foreground rounded-md">
              Por favor, selecione uma frente vinculada a um site que contenha LPU carregada.
            </div>
          )}

          <Button onClick={handleSubmit} disabled={isLoading || !frenteId || Object.keys(selectedLpus).length === 0} className="w-full">
            Criar Atividades / Itens
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
