import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useEscopos } from "@/hooks/useEscopos";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Site {
  id: string;
  codigo: string;
  nome: string;
}

interface Recurso {
  id: string;
  nome: string;
  tipo: string;
}

interface Props {
  projetoId: string;
  sites?: Site[];
  recursos?: Recurso[];
  onCreate: (data: any) => void;
  isLoading?: boolean;
}

export function FrenteForm({ projetoId, sites = [], recursos = [], onCreate, isLoading }: Props) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [siteId, setSiteId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [selectedRecursos, setSelectedRecursos] = useState<string[]>([]);
  const [selectedLpus, setSelectedLpus] = useState<Record<string, { producao_diaria_prevista: string }>>({});

  const { itens: escopoItens } = useEscopos(siteId);

  const toggleRecurso = (id: string) => {
    setSelectedRecursos((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const toggleLpu = (id: string) => {
    setSelectedLpus((prev) => {
      const isSelected = !!prev[id];
      if (isSelected) {
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
    if (!nome.trim()) return;
    
    // Preparar atividades_geradas Baseado nas LPUs selecionadas
    const atividades_geradas = Object.keys(selectedLpus).map(lpuId => {
      const escopoItem = escopoItens.find(e => e.item_lpu_id === lpuId);
      return {
        item_lpu_id: lpuId,
        nome: escopoItem ? escopoItem.nome : "Atividade",
        quantidade_total: escopoItem ? escopoItem.quantidade : 1,
        producao_diaria_prevista: Number(selectedLpus[lpuId].producao_diaria_prevista) || 1,
      }
    });

    onCreate({
      projeto_id: projetoId,
      nome: nome.trim(),
      descricao: descricao || undefined,
      site_id: siteId || undefined,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
      recursos: selectedRecursos,
      atividades_geradas
    });

    setNome("");
    setDescricao("");
    setSiteId("");
    setDataInicio("");
    setDataFim("");
    setSelectedRecursos([]);
    setSelectedLpus({});
    setOpen(false);
  };

  const recursosPessoa = recursos.filter(r => r.tipo === 'pessoa');
  const recursosEquipamento = recursos.filter(r => r.tipo === 'equipamento');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Nova Frente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Frente de Obra</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Trecho A" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sites.length > 0 && (
              <div>
                <Label>Site / Centro de Custo</Label>
                <Select value={siteId} onValueChange={(v) => {
                  setSiteId(v === "none" ? "" : v);
                  setSelectedLpus({}); // Limpa as seleções se mudar o site
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vincular a um site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.codigo} - {s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div>
                <Label>Data Fim (Opcional)</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
          </div>
          
          {siteId && escopoItens.length > 0 && (
            <div className="border rounded-md p-3">
              <Label className="mb-2 block font-semibold text-primary">Vincular Escopo (LPU) à Frente</Label>
              <p className="text-xs text-muted-foreground mb-3">Selecione os itens do escopo e defina a meta de produção diária prevista. Atividades serão geradas no Gantt.</p>
              <ScrollArea className="h-40 border rounded p-2">
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
                            <span className="text-xs text-muted-foreground">Qtd Total Escopo: {item.quantidade} {item.unidade}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-2 pl-6 mt-1">
                            <Label className="text-xs whitespace-nowrap">Produção Diária Prevista:</Label>
                            <Input 
                              type="number" 
                              className="h-7 w-24 text-xs" 
                              value={selectedLpus[item.item_lpu_id].producao_diaria_prevista}
                              onChange={(e) => setLpuProdDiaria(item.item_lpu_id as string, e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">{item.unidade}/dia</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="border rounded-md p-3">
             <Label className="mb-2 block font-semibold text-primary">Vincular Recursos</Label>
             <p className="text-xs text-muted-foreground mb-3">Estes recursos serão integrados ao diário de obra em alocações prévias desta frente.</p>
             <div className="grid grid-cols-2 gap-4">
               <div>
                  <Label className="text-xs font-semibold mb-2 block">Pessoas / Equipe</Label>
                  <ScrollArea className="h-32 border rounded p-2">
                    <div className="space-y-2">
                      {recursosPessoa.map(r => (
                        <div key={r.id} className="flex items-center gap-2">
                           <Checkbox id={`rec-${r.id}`} checked={selectedRecursos.includes(r.id)} onCheckedChange={() => toggleRecurso(r.id)} />
                           <Label htmlFor={`rec-${r.id}`} className="text-xs cursor-pointer">{r.nome}</Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
               </div>
               <div>
                  <Label className="text-xs font-semibold mb-2 block">Equipamentos</Label>
                  <ScrollArea className="h-32 border rounded p-2">
                    <div className="space-y-2">
                      {recursosEquipamento.map(r => (
                        <div key={r.id} className="flex items-center gap-2">
                           <Checkbox id={`rec-${r.id}`} checked={selectedRecursos.includes(r.id)} onCheckedChange={() => toggleRecurso(r.id)} />
                           <Label htmlFor={`rec-${r.id}`} className="text-xs cursor-pointer">{r.nome}</Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
               </div>
             </div>
          </div>

          <Button onClick={handleSubmit} disabled={isLoading || !nome.trim()} className="w-full">
            Criar Frente de Obra
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
