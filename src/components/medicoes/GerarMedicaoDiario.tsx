import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useSites } from "@/hooks/useSites";
import { useProjetos } from "@/hooks/useProjetos";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { HardHat, Search, ClipboardList, Loader2 } from "lucide-react";

interface ProducaoAgregada {
  item_lpu_id: string;
  item_codigo: string;
  item_descricao: string;
  item_unidade: string;
  preco_unitario: number;
  quantidade_total: number;
  valor_total: number;
  site_id: string;
  selected: boolean;
}

interface GerarMedicaoDiarioProps {
  onGenerate: (items: { site_id: string; item_lpu_id: string; data_medicao: string; quantidade: number; numero_medicao?: string; status?: string }[]) => void;
  isLoading?: boolean;
}

export function GerarMedicaoDiario({ onGenerate, isLoading }: GerarMedicaoDiarioProps) {
  const { toast } = useToast();
  const { projetos } = useProjetos();
  const { sites } = useSites();

  const [projetoId, setProjetoId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [numeroMedicao, setNumeroMedicao] = useState("");
  const [dataMedicao, setDataMedicao] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  const [producoes, setProducoes] = useState<ProducaoAgregada[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const filteredSites = projetoId
    ? sites.filter((s) => s.projeto_id === projetoId)
    : sites;

  const handleBuscar = async () => {
    if (!siteId) {
      toast({ title: "Selecione um site", variant: "destructive" });
      return;
    }
    if (!dataInicio || !dataFim) {
      toast({ title: "Informe o período", variant: "destructive" });
      return;
    }

    setSearching(true);
    setSearched(false);

    try {
      // Fetch diários do período
      const { data: diarios, error: dErr } = await supabase
        .from("diarios_obra")
        .select("id")
        .eq("site_id", siteId)
        .gte("data", dataInicio)
        .lte("data", dataFim);

      if (dErr) throw dErr;
      if (!diarios || diarios.length === 0) {
        setProducoes([]);
        setSearched(true);
        return;
      }

      const diarioIds = diarios.map((d) => d.id);

      // Fetch produção dos diários
      const { data: prods, error: pErr } = await supabase
        .from("diario_producao")
        .select("*, item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario)")
        .in("diario_id", diarioIds);

      if (pErr) throw pErr;

      // Agregar por item_lpu_id
      const mapa = new Map<string, ProducaoAgregada>();
      for (const p of prods || []) {
        const item = (p as any).item_lpu;
        if (!item) continue;
        const key = item.id;
        const existing = mapa.get(key);
        const qty = Number(p.quantidade);
        if (existing) {
          existing.quantidade_total += qty;
          existing.valor_total += qty * Number(item.preco_unitario);
        } else {
          mapa.set(key, {
            item_lpu_id: item.id,
            item_codigo: item.codigo,
            item_descricao: item.descricao,
            item_unidade: item.unidade,
            preco_unitario: Number(item.preco_unitario),
            quantidade_total: qty,
            valor_total: qty * Number(item.preco_unitario),
            site_id: siteId,
            selected: true,
          });
        }
      }

      setProducoes(Array.from(mapa.values()));
      setSearched(true);
    } catch (e: any) {
      toast({ title: "Erro ao buscar produção", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const toggleItem = (itemId: string) => {
    setProducoes((prev) =>
      prev.map((p) => (p.item_lpu_id === itemId ? { ...p, selected: !p.selected } : p))
    );
  };

  const toggleAll = (checked: boolean) => {
    setProducoes((prev) => prev.map((p) => ({ ...p, selected: checked })));
  };

  const selectedItems = producoes.filter((p) => p.selected);
  const totalValor = selectedItems.reduce((s, p) => s + p.valor_total, 0);

  const handleGerar = () => {
    if (selectedItems.length === 0) return;
    const items = selectedItems.map((p) => ({
      site_id: p.site_id,
      item_lpu_id: p.item_lpu_id,
      data_medicao: dataMedicao,
      quantidade: p.quantidade_total,
      numero_medicao: numeroMedicao || undefined,
      status: "pendente",
    }));
    onGenerate(items);
    setProducoes([]);
    setSearched(false);
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardHat className="h-5 w-5" />
          Gerar Medição a partir do Diário de Obra
        </CardTitle>
        <CardDescription>
          Busque a produção apontada no Diário de Obra para um período e gere os lançamentos de medição automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Projeto</Label>
            <Select value={projetoId} onValueChange={(v) => { setProjetoId(v); setSiteId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os projetos" />
              </SelectTrigger>
              <SelectContent>
                {projetos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo} - {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Site *</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o site" />
              </SelectTrigger>
              <SelectContent>
                {filteredSites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.codigo} - {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data Início *</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Data Fim *</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Data da Medição</Label>
            <Input type="date" value={dataMedicao} onChange={(e) => setDataMedicao(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Número da Medição</Label>
            <Input value={numeroMedicao} onChange={(e) => setNumeroMedicao(e.target.value)} placeholder="Ex: MED-001" />
          </div>
          <div className="flex items-end">
            <Button onClick={handleBuscar} disabled={searching || !siteId || !dataInicio || !dataFim} className="w-full">
              {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              {searching ? "Buscando..." : "Buscar Produção"}
            </Button>
          </div>
        </div>

        {/* Resultado */}
        {searched && producoes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nenhuma produção encontrada no Diário de Obra para o período selecionado.</p>
          </div>
        )}

        {producoes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedItems.length === producoes.length}
                  onCheckedChange={(checked) => toggleAll(!!checked)}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedItems.length} de {producoes.length} itens selecionados
                </span>
              </div>
              <Badge variant="secondary" className="text-sm">
                Total: {formatCurrency(totalValor)}
              </Badge>
            </div>

            <div className="max-h-80 overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Unid.</TableHead>
                    <TableHead className="text-right">Qtd Total</TableHead>
                    <TableHead className="text-right">Preço Unit.</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {producoes.map((p) => (
                    <TableRow key={p.item_lpu_id} className={!p.selected ? "opacity-50" : ""}>
                      <TableCell>
                        <Checkbox checked={p.selected} onCheckedChange={() => toggleItem(p.item_lpu_id)} />
                      </TableCell>
                      <TableCell className="font-medium">{p.item_codigo}</TableCell>
                      <TableCell>{p.item_descricao}</TableCell>
                      <TableCell>{p.item_unidade}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.quantidade_total}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.preco_unitario)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatCurrency(p.valor_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={handleGerar} disabled={isLoading || selectedItems.length === 0} className="w-full">
              {isLoading ? "Gerando..." : `Gerar ${selectedItems.length} lançamento(s) de medição`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
