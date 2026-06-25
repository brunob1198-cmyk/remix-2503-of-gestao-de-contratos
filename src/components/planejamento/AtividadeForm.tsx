import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search } from "lucide-react";
import { FrenteObra, AtividadePlanejamento } from "@/hooks/usePlanejamento";
import { addDays, format, parseISO } from "date-fns";
import { useEscopos } from "@/hooks/useEscopos";
import { useItensLpu } from "@/hooks/useItensLpu";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  frentes: FrenteObra[];
  atividades: AtividadePlanejamento[];
  projetoId?: string;
  onCreate: (data: any) => void;
  isLoading?: boolean;
}

interface SelectedLpu {
  quantidade_total: string;
  producao_diaria_prevista: string;
  sob_demanda: boolean;
}

export function AtividadeForm({ frentes, projetoId, onCreate, isLoading }: Props) {
  const [open, setOpen] = useState(false);
  const [frenteId, setFrenteId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFimOverride, setDataFimOverride] = useState("");
  const [busca, setBusca] = useState("");

  const [selectedLpus, setSelectedLpus] = useState<Record<string, SelectedLpu>>({});
  const [principalLpuId, setPrincipalLpuId] = useState<string | null>(null);

  const selectedFrente = frentes.find((f) => f.id === frenteId);
  const frenteSiteId = (selectedFrente as any)?.site_id;

  // Escopo (quando existir) para pré-preencher quantidades
  const { itens: escopoItens } = useEscopos(frenteSiteId, frenteSiteId ? undefined : projetoId);
  // LPU completa do projeto — fonte principal de itens, mesmo sem escopo cadastrado
  const { itensLpu } = useItensLpu(projetoId);

  const escopoMap = useMemo(() => {
    const m: Record<string, { quantidade: number }> = {};
    escopoItens.forEach((e: any) => {
      if (e.item_lpu_id) m[e.item_lpu_id] = { quantidade: Number(e.quantidade) || 0 };
    });
    return m;
  }, [escopoItens]);

  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (itensLpu || []).filter((i: any) => {
      if (!q) return true;
      return (
        (i.codigo || "").toLowerCase().includes(q) ||
        (i.descricao || "").toLowerCase().includes(q)
      );
    });
  }, [itensLpu, busca]);

  const toggleLpu = (id: string) => {
    setSelectedLpus((prev) => {
      const isSelected = !!prev[id];
      if (isSelected) {
        if (principalLpuId === id) setPrincipalLpuId(null);
        const next = { ...prev };
        delete next[id];
        return next;
      }
      const escopoQtd = escopoMap[id]?.quantidade ?? 0;
      return {
        ...prev,
        [id]: {
          quantidade_total: escopoQtd ? String(escopoQtd) : "",
          producao_diaria_prevista: "1",
          sob_demanda: escopoQtd === 0,
        },
      };
    });
  };

  const updateField = (id: string, patch: Partial<SelectedLpu>) => {
    setSelectedLpus((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleSubmit = () => {
    if (!frenteId) return;

    // Fallback: usa as datas da frente quando o usuário não informou no form
    const inicioBase = dataInicio || (selectedFrente as any)?.data_inicio || "";
    const fimBaseFrente = (selectedFrente as any)?.data_fim || "";

    const atividadesGeradas = Object.keys(selectedLpus).map((lpuId) => {
      const sel = selectedLpus[lpuId];
      const lpu = (itensLpu || []).find((i: any) => i.id === lpuId);
      const nome = lpu ? `${lpu.codigo} - ${lpu.descricao}` : "Item LPU";
      const prodDiaria = Number(sel.producao_diaria_prevista) || 1;
      // Sob demanda: quantidade 0 (acionamento). Mantém a média diária prevista da venda.
      const qtdTotal = sel.sob_demanda ? 0 : Number(sel.quantidade_total) || 0;

      let endDStr: string | undefined;
      if (dataFimOverride) {
        endDStr = dataFimOverride;
      } else if (inicioBase && qtdTotal > 0) {
        const dur = Math.max(1, Math.ceil(qtdTotal / prodDiaria));
        endDStr = format(addDays(parseISO(inicioBase), dur - 1), "yyyy-MM-dd");
      } else if (inicioBase && fimBaseFrente) {
        // Sob demanda: usa o período da frente para projetar a média diária no Gantt
        endDStr = fimBaseFrente;
      }

      return {
        frente_id: frenteId,
        item_lpu_id: lpuId,
        nome,
        quantidade_total: qtdTotal,
        producao_diaria_prevista: prodDiaria,
        is_principal: lpuId === principalLpuId,
        data_inicio: inicioBase || undefined,
        data_fim_prevista: endDStr,
        predecessoras: [],
      };
    });

    onCreate(atividadesGeradas);

    setSelectedLpus({});
    setPrincipalLpuId(null);
    setDataInicio("");
    setDataFimOverride("");
    setBusca("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-1" /> Vincular Itens LPU
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
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
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
              <Input
                type="date"
                value={dataFimOverride}
                onChange={(e) => setDataFimOverride(e.target.value)}
                placeholder="Calcula aut. se vazio"
              />
            </div>
          </div>

          {itensLpu && itensLpu.length > 0 ? (
            <div className="border rounded-md p-3 mt-4">
              <Label className="mb-2 block font-semibold text-primary">
                Itens da LPU do projeto
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (quantidades pré-preenchidas pelo escopo quando disponível; marque "Sob demanda" para serviços por acionamento)
                </span>
              </Label>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código ou descrição"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <ScrollArea className="h-[320px] border rounded p-2">
                <div className="space-y-3">
                  {itensFiltrados.map((item: any) => {
                    const id = item.id as string;
                    const sel = selectedLpus[id];
                    const isSelected = !!sel;
                    const escopoQtd = escopoMap[id]?.quantidade;
                    return (
                      <div key={id} className="flex flex-col gap-1.5 pb-2 border-b last:border-0 last:pb-0">
                        <div className="flex items-start gap-2">
                          <Checkbox id={`lpu-${id}`} checked={isSelected} onCheckedChange={() => toggleLpu(id)} />
                          <div className="grid leading-tight">
                            <Label htmlFor={`lpu-${id}`} className="font-medium cursor-pointer text-sm">
                              {item.codigo} - {item.descricao}
                            </Label>
                            <span className="text-xs text-muted-foreground">
                              Unidade: {item.unidade || "-"}
                              {escopoQtd != null && (
                                <span className="ml-2">• Escopo: {escopoQtd} {item.unidade}</span>
                              )}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-4 pl-6 mt-1 flex-wrap shadow-sm bg-muted/30 p-2 rounded-md border">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`dem-${id}`}
                                checked={sel.sob_demanda}
                                onCheckedChange={(c) =>
                                  updateField(id, { sob_demanda: !!c, quantidade_total: c ? "" : sel.quantidade_total })
                                }
                              />
                              <Label htmlFor={`dem-${id}`} className="text-xs cursor-pointer font-semibold">
                                Sob demanda (sem escopo total)
                              </Label>
                            </div>
                            {!sel.sob_demanda && (
                              <div className="flex items-center gap-2">
                                <Label className="text-xs whitespace-nowrap font-semibold">Qtd. Prevista (Venda):</Label>
                                <Input
                                  type="number"
                                  className="h-8 w-24 text-sm"
                                  value={sel.quantidade_total}
                                  onChange={(e) => updateField(id, { quantidade_total: e.target.value })}
                                />
                                <span className="text-xs text-muted-foreground uppercase">{item.unidade}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Label className="text-xs whitespace-nowrap font-semibold">Média Diária (Venda):</Label>
                              <Input
                                type="number"
                                className="h-8 w-24 text-sm"
                                value={sel.producao_diaria_prevista}
                                onChange={(e) => updateField(id, { producao_diaria_prevista: e.target.value })}
                              />
                              <span className="text-xs text-muted-foreground uppercase">{item.unidade}/dia</span>
                            </div>
                            <div className="flex items-center gap-2 border-l border-muted-foreground/30 pl-4">
                              <Checkbox
                                id={`princ-${id}`}
                                checked={principalLpuId === id}
                                onCheckedChange={(checked) => setPrincipalLpuId(checked ? id : null)}
                              />
                              <Label htmlFor={`princ-${id}`} className="text-xs cursor-pointer text-purple-600 font-bold whitespace-nowrap">
                                Ativ. Principal
                              </Label>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {itensFiltrados.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-6">Nenhum item encontrado.</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="bg-muted p-4 text-sm text-center text-muted-foreground rounded-md">
              Nenhum item de LPU encontrado para este projeto. Cadastre a LPU em Cadastros &gt; LPU.
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={isLoading || !frenteId || Object.keys(selectedLpus).length === 0}
            className="w-full"
          >
            Criar Atividades / Itens
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
