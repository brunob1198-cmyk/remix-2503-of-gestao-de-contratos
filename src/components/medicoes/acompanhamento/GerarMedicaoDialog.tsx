import { useState, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Search, AlertTriangle, FileText, Camera, MapPin, Calendar, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { gerarMedicaoSchema } from "@/lib/schemas/medicao";
import { toast } from "sonner";
import { SmartImage } from "@/components/ui/SmartImage";

interface GeracaoItem {
  site_id: string;
  site_codigo: string;
  site_nome: string;
  item_lpu_id: string;
  item_codigo: string;
  item_descricao: string;
  unidade: string;
  preco_unitario: number;
  quantidade: number;
  quantidade_pendente: number;
  valor_total: number;
  selected: boolean;
}

interface GeracaoFoto {
  id: string;
  url: string;
  classificacao: string;
  legenda: string | null;
  item_codigo?: string;
  item_descricao?: string;
  diario_data?: string;
  site_id?: string;
  site_nome?: string;
  selected: boolean;
}

interface GerarMedicaoDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEnviar: (data: {
    items: any[];
    selectedItens: GeracaoItem[];
    capaFile: File | null;
    reportConfig?: {
      mostrar_lpu: boolean;
      mostrar_valores_site: boolean;
      modo_somente_fotos: boolean;
      fotos_por_pagina: number;
      legenda_padrao_fotos: string;
    };
  }) => Promise<void>;
  formatDate: (d: string) => string;
  formatCurrency: (v: number) => string;
}

export function GerarMedicaoDialog({
  isOpen,
  onOpenChange,
  onEnviar,
  formatDate,
  formatCurrency
}: GerarMedicaoDialogProps) {
  const queryClient = useQueryClient();
  const { empresaLogoUrl } = useAuth();
  
  const { data: projetos = [] } = useQuery({ queryKey: ["projetos"], queryFn: async () => { const { data } = await supabase.from("projetos").select("*, clienteObj:clientes(*), contratoObj:contratos(*), areaObj:areas(*)").order("codigo"); return data || []; }, enabled: isOpen });
  const { data: sites = [] } = useQuery({ queryKey: ["sites", undefined], queryFn: async () => { const { data } = await supabase.from("sites").select("*, projeto:projetos(*, clienteObj:clientes(*))").order("codigo"); return data || []; }, enabled: isOpen });
  const { data: allItensLpu = [] } = useQuery({ queryKey: ["itens_lpu", undefined], queryFn: async () => { const { data } = await supabase.from("itens_lpu").select("*, projeto:projetos(*)").order("codigo"); return data || []; }, enabled: isOpen });
  const { data: lancamentos = [] } = useQuery({ queryKey: ["lancamentos_medicao", undefined], queryFn: async () => { const { data } = await supabase.from("lancamentos_medicao").select("*, site:sites(*, projeto:projetos(*)), item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario)"); return data || []; }, enabled: isOpen });
  const { data: producoes = [] } = useQuery({ queryKey: ["lancamentos_producao", undefined], queryFn: async () => { const { data } = await supabase.from("lancamentos_producao").select("*, site:sites(*, projeto:projetos(*)), item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario)"); return data || []; }, enabled: isOpen });

  const [gerarProjetoId, setGerarProjetoId] = useState<string>("");
  const [gerarSiteId, setGerarSiteId] = useState<string>("");
  const [gerarPeriodoInicio, setGerarPeriodoInicio] = useState<string>("");
  const [gerarPeriodoFim, setGerarPeriodoFim] = useState<string>("");
  const [gerarNumeroMedicao, setGerarNumeroMedicao] = useState<string>("");
  const [geracaoItens, setGeracaoItens] = useState<GeracaoItem[]>([]);
  const [gerarTipoMedicao, setGerarTipoMedicao] = useState<"separada" | "agrupada" | "mista">("separada");
  const [geracaoFotos, setGeracaoFotos] = useState<GeracaoFoto[]>([]);
  const [geracaoFotosTotal, setGeracaoFotosTotal] = useState<number>(0);
  const [step, setStep] = useState<"filtros" | "config" | "preview">("filtros");
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  const [loadingGeracaoFotos, setLoadingGeracaoFotos] = useState(false);
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [uploadingCapa, setUploadingCapa] = useState(false);
  const capaInputRef = useRef<HTMLInputElement>(null);

  const [mostrarLpu, setMostrarLpu] = useState(true);
  const [mostrarValoresSite, setMostrarValoresSite] = useState(true);
  const [modoSomenteFotos, setModoSomenteFotos] = useState(false);
  const [fotosPorPagina, setFotosPorPagina] = useState(4);
  const [legendaPadraoFotos, setLegendaPadraoFotos] = useState("");
  const [editLegendas, setEditLegendas] = useState<Record<string, string>>({});
  const [salvarComoPadrao, setSalvarComoPadrao] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["report_templates", gerarProjetoId],
    queryFn: async () => {
      if (!gerarProjetoId) return [];
      const { data } = await supabase.from("report_templates").select("*").eq("projeto_id", gerarProjetoId);
      return data || [];
    },
    enabled: !!gerarProjetoId && isOpen
  });

  const applyTemplate = (template: any) => {
    setMostrarLpu(template.mostrar_lpu);
    setMostrarValoresSite(template.mostrar_valores_site);
    setModoSomenteFotos(template.modo_somente_fotos);
    setFotosPorPagina(template.fotos_por_pagina);
    setLegendaPadraoFotos(template.legenda_padrao_fotos || "");
    if (template.tipo_medicao) setGerarTipoMedicao(template.tipo_medicao);
  };

  const { data: diarioProducoes = [], isLoading: isLoadingDiarios, isFetching: isFetchingDiarios } = useQuery({
    queryKey: ["diario_producao_all_dialog", gerarPeriodoInicio, gerarPeriodoFim, gerarProjetoId, gerarSiteId],
    queryFn: async () => {
      let siteIdsToFetch: string[] = gerarSiteId ? [gerarSiteId] : (gerarProjetoId ? sites.filter(s => s.projeto_id === gerarProjetoId).map(s => s.id) : sites.map(s => s.id));
      if (siteIdsToFetch.length === 0) return [];
      
      const { data: allDiarios } = await supabase.from("diarios_obra").select("id, site_id, data").in("site_id", siteIdsToFetch).gte("data", gerarPeriodoInicio).lte("data", gerarPeriodoFim);
      if (!allDiarios || allDiarios.length === 0) return [];
      
      const { data: allProds } = await supabase.from("diario_producao").select("*, item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario)").in("diario_id", allDiarios.map(d => d.id));
      const diarioMap = new Map(allDiarios.map(d => [d.id, d]));
      
      return (allProds || []).map(p => ({
        site_id: diarioMap.get(p.diario_id)?.site_id || "",
        item_lpu_id: p.item_lpu_id,
        data_producao: diarioMap.get(p.diario_id)?.data || "",
        quantidade: Number(p.quantidade),
        valor_total: Number(p.valor_total || 0),
        item_lpu: (p as any).item_lpu,
        source: "diario" as const,
      }));
    },
    enabled: isOpen && !!gerarPeriodoInicio && !!gerarPeriodoFim,
    staleTime: 0,
  });

  const handleGerarPreview = async () => {
    const validation = gerarMedicaoSchema.safeParse({ periodoInicio: gerarPeriodoInicio, periodoFim: gerarPeriodoFim, numeroMedicao: gerarNumeroMedicao, tipoMedicao: gerarTipoMedicao, projetoId: gerarProjetoId || undefined, siteId: gerarSiteId || undefined });
    if (!validation.success) { toast.error(validation.error.issues[0].message); return; }

    const allProducao = [...producoes.map(p => ({ site_id: p.site_id, item_lpu_id: p.item_lpu_id, data_producao: p.data_producao, quantidade: Number(p.quantidade), item_lpu: p.item_lpu, valor_total: Number(p.quantidade) * Number(p.item_lpu?.preco_unitario || 0) })), ...diarioProducoes.map(dp => ({ site_id: dp.site_id, item_lpu_id: dp.item_lpu_id, data_producao: dp.data_producao, quantidade: dp.quantidade, item_lpu: dp.item_lpu, valor_total: dp.valor_total }))];
    let filteredProducao = allProducao.filter(p => p.data_producao >= gerarPeriodoInicio && p.data_producao <= gerarPeriodoFim);
    if (gerarProjetoId) filteredProducao = filteredProducao.filter(p => sites.filter(s => s.projeto_id === gerarProjetoId).map(s => s.id).includes(p.site_id));
    if (gerarSiteId) filteredProducao = filteredProducao.filter(p => p.site_id === gerarSiteId);

    const pendingBySiteItem = new Map<string, number>();
    lancamentos.forEach(l => { if ((l as any).quantidade_pendente && Number((l as any).quantidade_pendente) > 0) { const key = `${l.site_id}_${l.item_lpu_id}`; pendingBySiteItem.set(key, (pendingBySiteItem.get(key) || 0) + Number((l as any).quantidade_pendente)); } });

    const grouped = new Map<string, GeracaoItem>();
    filteredProducao.forEach(p => {
      const key = `${p.site_id}_${p.item_lpu_id}`;
      const site = sites.find(s => s.id === p.site_id);
      const item = allItensLpu.find(i => i.id === p.item_lpu_id) || p.item_lpu;
      if (!site || !item) return;
      if (!grouped.has(key)) {
        const pendente = pendingBySiteItem.get(key) || 0;
        grouped.set(key, { site_id: p.site_id, site_codigo: site.codigo, site_nome: site.nome, item_lpu_id: p.item_lpu_id, item_codigo: item.codigo, item_descricao: item.descricao, unidade: item.unidade, preco_unitario: Number(item.preco_unitario), quantidade: 0, quantidade_pendente: pendente, valor_total: pendente * Number(item.preco_unitario), selected: true });
      }
      const g = grouped.get(key)!;
      g.quantidade += p.quantidade;
      g.valor_total += p.valor_total;
    });

    const itemsArray = Array.from(grouped.values());
    setGeracaoItens(itemsArray);

    setLoadingGeracaoFotos(true);
    try {
      const siteIds = gerarSiteId ? [gerarSiteId] : (gerarProjetoId ? sites.filter(s => s.projeto_id === gerarProjetoId).map(s => s.id) : [...new Set(itemsArray.map(g => g.site_id))]);
      if (siteIds.length > 0) {
        const { data: diarios } = await supabase.from("diarios_obra").select("id, data, site_id").in("site_id", siteIds).gte("data", gerarPeriodoInicio).lte("data", gerarPeriodoFim);
        if (diarios && diarios.length > 0) {
          const diarioMap = new Map(diarios.map(d => [d.id, d]));
          const { count, data: fotos } = await supabase.from("diario_fotos").select("*", { count: 'exact' }).in("diario_id", diarios.map(d => d.id)).limit(50);
          setGeracaoFotosTotal(count || 0);
          setGeracaoFotos((fotos || []).map(f => ({ id: f.id, url: f.url, classificacao: f.classificacao, legenda: f.legenda, diario_data: diarioMap.get(f.diario_id)?.data, site_id: diarioMap.get(f.diario_id)?.site_id, selected: true })));
        }
      }
    } catch (err) { console.error(err); }

    const warnings: string[] = [];
    const siteIdsInGeracao = [...new Set(itemsArray.map(g => g.site_id))];
    for (const sid of siteIdsInGeracao) {
      const existingForSite = lancamentos.filter(l => l.site_id === sid && (l.status === "aprovado" || l.status === "enviada") && l.periodo_inicio && l.periodo_fim);
      for (const existing of existingForSite) {
        if (gerarPeriodoInicio <= existing.periodo_fim! && gerarPeriodoFim >= existing.periodo_inicio!) {
          warnings.push(`Sobreposição no site ${sid}`);
          break;
        }
      }
    }
    setDuplicateWarnings(warnings);
    setLoadingGeracaoFotos(false);
    setStep("config");
  };

  const handleConfirmarMedicao = async () => {
    if (salvarComoPadrao && gerarProjetoId) {
      await supabase.from("report_templates").update({ is_default: false }).eq("projeto_id", gerarProjetoId);
      await supabase.from("report_templates").upsert({ projeto_id: gerarProjetoId, nome: `Template ${gerarProjetoId}`, tipo_medicao: gerarTipoMedicao, mostrar_lpu: mostrarLpu, mostrar_valores_site: mostrarValoresSite, modo_somente_fotos: modoSomenteFotos, fotos_por_pagina: fotosPorPagina, legenda_padrao_fotos: legendaPadraoFotos, is_default: true });
    }
    const selectedItems = geracaoItens.filter(i => i.selected);
    const items = selectedItems.map(i => ({ site_id: i.site_id, item_lpu_id: i.item_lpu_id, data_medicao: new Date().toISOString().split("T")[0], quantidade: i.quantidade + i.quantidade_pendente, numero_medicao: gerarNumeroMedicao, status: "enviada", periodo_inicio: gerarPeriodoInicio, periodo_fim: gerarPeriodoFim, observacao: `tipo:${gerarTipoMedicao}`, mostrar_lpu: mostrarLpu, mostrar_valores_site: mostrarValoresSite, modo_somente_fotos: modoSomenteFotos, fotos_por_pagina: fotosPorPagina, legenda_padrao_fotos: legendaPadraoFotos }));
    
    await onEnviar({ items, selectedItens: selectedItems, capaFile, reportConfig: { mostrar_lpu: mostrarLpu, mostrar_valores_site: mostrarValoresSite, modo_somente_fotos: modoSomenteFotos, fotos_por_pagina: fotosPorPagina, legenda_padrao_fotos: legendaPadraoFotos } });
    if (Object.keys(editLegendas).length > 0) await supabase.from("medicao_report_photo_captions").upsert(Object.entries(editLegendas).map(([foto_id, legenda]) => ({ numero_medicao: gerarNumeroMedicao, foto_id, legenda })));
    setStep("filtros"); setGeracaoItens([]); setGeracaoFotos([]); setGerarNumeroMedicao(""); setGerarPeriodoInicio(""); setGerarPeriodoFim(""); setGerarProjetoId(""); setGerarSiteId(""); setEditLegendas({});
  };

  const selectedItens = geracaoItens.filter(i => i.selected);
  const geracaoTotal = selectedItens.reduce((s, i) => s + i.valor_total, 0);

  useMemo(() => {
    if (step === "config" && templates.length > 0) {
      const defaultTemplate = templates.find(t => t.is_default);
      if (defaultTemplate) applyTemplate(defaultTemplate);
    }
  }, [step, templates]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setStep("filtros"); setGeracaoItens([]); setGeracaoFotos([]); setEditLegendas({}); } onOpenChange(open); }}>
      <DialogContent className={step !== "filtros" ? "max-w-5xl max-h-[90vh] overflow-y-auto" : "max-w-md"}>
        <DialogHeader><DialogTitle>{step === "filtros" ? "Gerar Medição" : step === "config" ? "Configurar Relatório" : "Preview"}</DialogTitle></DialogHeader>
        {step === "filtros" ? (
          <div className="space-y-4 py-4">
             <div className="grid grid-cols-1 gap-4">
               <div className="space-y-2"><Label>Projeto</Label><Select value={gerarProjetoId || "all"} onValueChange={(v) => { setGerarProjetoId(v === "all" ? "" : v); setGerarSiteId(""); }}><SelectTrigger><SelectValue placeholder="Todos os projetos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os projetos</SelectItem>{projetos.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>)}</SelectContent></Select></div>
               <div className="space-y-2"><Label>Site</Label><Select value={gerarSiteId || "all"} onValueChange={(v) => setGerarSiteId(v === "all" ? "" : v)}><SelectTrigger><SelectValue placeholder="Todos os sites" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os sites</SelectItem>{sites.filter(s => !gerarProjetoId || s.projeto_id === gerarProjetoId).map(s => <SelectItem key={s.id} value={s.id}>{s.codigo} - {s.nome}</SelectItem>)}</SelectContent></Select></div>
               <div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label>Início</Label><Input type="date" value={gerarPeriodoInicio} onChange={(e) => setGerarPeriodoInicio(e.target.value)} /></div><div className="space-y-2"><Label>Fim</Label><Input type="date" value={gerarPeriodoFim} onChange={(e) => setGerarPeriodoFim(e.target.value)} /></div></div>
               <div className="space-y-2"><Label>Nº Medição</Label><Input value={gerarNumeroMedicao} onChange={(e) => setGerarNumeroMedicao(e.target.value)} /></div>
               <div className="space-y-2"><Label>Tipo</Label><RadioGroup value={gerarTipoMedicao} onValueChange={(v: any) => setGerarTipoMedicao(v)} className="flex gap-4"><div className="flex items-center space-x-2"><RadioGroupItem value="separada" id="sep" /><Label htmlFor="sep">Separada</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="agrupada" id="agr" /><Label htmlFor="agr">Agrupada</Label></div></RadioGroup></div>
             </div>
          </div>
        ) : step === "config" ? (
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Conteúdo</h3>
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center space-x-2"><Checkbox id="lpu" checked={modoSomenteFotos ? false : mostrarLpu} onCheckedChange={(c) => setMostrarLpu(!!c)} disabled={modoSomenteFotos} /><Label htmlFor="lpu">Exibir LPU</Label></div>
                  <div className="flex items-center space-x-2"><Checkbox id="vals" checked={modoSomenteFotos ? false : mostrarValoresSite} onCheckedChange={(c) => setMostrarValoresSite(!!c)} disabled={modoSomenteFotos} /><Label htmlFor="vals">Exibir Valores</Label></div>
                  <div className="flex items-center space-x-2"><Checkbox id="only" checked={modoSomenteFotos} onCheckedChange={(c) => setModoSomenteFotos(!!c)} /><Label htmlFor="only" className="font-medium text-primary">Somente fotos</Label></div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Camera className="h-4 w-4" /> Layout</h3>
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-2"><Label>Fotos por página</Label><RadioGroup value={fotosPorPagina.toString()} onValueChange={(v) => setFotosPorPagina(parseInt(v))} className="flex gap-4">{[2, 4, 6].map(n => <div key={n} className="flex items-center space-x-2"><RadioGroupItem value={n.toString()} id={`f-${n}`} /><Label htmlFor={`f-${n}`}>{n}</Label></div>)}</RadioGroup></div>
                  <div className="space-y-2"><Label>Legenda padrão</Label><Input value={legendaPadraoFotos} onChange={(e) => setLegendaPadraoFotos(e.target.value)} /></div>
                </div>
              </div>
            </div>
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Camera className="h-4 w-4" /> Editar Legendas</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[300px] overflow-y-auto p-1">
                {geracaoFotos.map(foto => (
                  <div key={foto.id} className="space-y-2 p-2 border rounded bg-card">
                    <div className="aspect-video relative rounded overflow-hidden bg-muted"><SmartImage src={foto.url} alt="P" className="object-cover w-full h-full" /></div>
                    <Input className="h-7 text-xs" value={editLegendas[foto.id] ?? foto.legenda ?? ""} onChange={(e) => setEditLegendas(prev => ({ ...prev, [foto.id]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="border rounded-md max-h-[300px] overflow-y-auto">
              <Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>{geracaoItens.map((item, idx) => <TableRow key={idx}><TableCell><div className="text-xs font-medium">{item.item_codigo}</div><div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{item.item_descricao}</div></TableCell><TableCell className="text-right text-xs">{item.quantidade + item.quantidade_pendente}</TableCell><TableCell className="text-right text-xs font-bold">{formatCurrency(item.valor_total)}</TableCell></TableRow>)}</TableBody></Table>
            </div>
            <div className="text-right font-bold text-lg text-primary">Total: {formatCurrency(geracaoTotal)}</div>
          </div>
        )}
        <DialogFooter className="flex flex-col sm:flex-row gap-2 border-t pt-4">
          {step === "filtros" ? (
            <div className="flex w-full justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={handleGerarPreview} disabled={!gerarProjetoId || !gerarPeriodoInicio || !gerarPeriodoFim || !gerarNumeroMedicao || isLoadingDiarios || isFetchingDiarios}>Ver Itens</Button></div>
          ) : step === "config" ? (
            <div className="flex w-full justify-between items-center"><div className="flex items-center space-x-2"><Checkbox id="save" checked={salvarComoPadrao} onCheckedChange={(c) => setSalvarComoPadrao(!!c)} /><Label htmlFor="save" className="text-sm">Salvar padrão</Label></div><div className="flex gap-2"><Button variant="outline" onClick={() => setStep("filtros")}>Voltar</Button><Button onClick={() => setStep("preview")}>Resumo</Button></div></div>
          ) : (
            <div className="flex w-full justify-end gap-2"><Button variant="outline" onClick={() => setStep("config")}>Voltar</Button><Button onClick={handleConfirmarMedicao}>Confirmar</Button></div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}