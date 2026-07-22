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
import { resolveFileUrl } from "@/utils/fileUrlResolver";
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
  
  // Data from hooks
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("*, clienteObj:clientes(*), contratoObj:contratos(*), areaObj:areas(*)")
        .order("codigo");
      if (error) throw error;
      return data;
    },
    enabled: isOpen
  });

  const { data: sites = [] } = useQuery({
    queryKey: ["sites", undefined],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("*, projeto:projetos(*, clienteObj:clientes(*))")
        .order("codigo");
      if (error) throw error;
      return data;
    },
    enabled: isOpen
  });

  const { data: allItensLpu = [] } = useQuery({
    queryKey: ["itens_lpu", undefined],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens_lpu")
        .select("*, projeto:projetos(*)")
        .order("codigo");
      if (error) throw error;
      return data;
    },
    enabled: isOpen
  });

  const { data: lancamentos = [] } = useQuery({
    queryKey: ["lancamentos_medicao", undefined],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_medicao")
        .select("*, site:sites(*, projeto:projetos(*)), item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario)");
      if (error) throw error;
      return data;
    },
    enabled: isOpen
  });

  const { data: producoes = [] } = useQuery({
    queryKey: ["lancamentos_producao", undefined],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_producao")
        .select("*, site:sites(*, projeto:projetos(*)), item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario)");
      if (error) throw error;
      return data;
    },
    enabled: isOpen
  });

  const [gerarProjetoId, setGerarProjetoId] = useState<string>("");
  const [gerarSiteId, setGerarSiteId] = useState<string>("");
  const [gerarPeriodoInicio, setGerarPeriodoInicio] = useState<string>("");
  const [gerarPeriodoFim, setGerarPeriodoFim] = useState<string>("");
  const [gerarNumeroMedicao, setGerarNumeroMedicao] = useState<string>("");
  const [geracaoItens, setGeracaoItens] = useState<GeracaoItem[]>([]);
  const [gerarTipoMedicao, setGerarTipoMedicao] = useState<"separada" | "agrupada" | "mista">("separada");
  const [geracaoFotos, setGeracaoFotos] = useState<GeracaoFoto[]>([]);
  const [geracaoFotosTotal, setGeracaoFotosTotal] = useState<number>(0);
  const [showPreview, setShowPreview] = useState(false);
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

  const { data: templates = [] } = useQuery({
    queryKey: ["report_templates", gerarProjetoId],
    queryFn: async () => {
      if (!gerarProjetoId) return [];
      const { data, error } = await supabase
        .from("report_templates")
        .select("*")
        .eq("projeto_id", gerarProjetoId);
      if (error) throw error;
      return data;
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
    queryKey: ["diario_producao_all_dialog", gerarPeriodoInicio, gerarPeriodoFim, gerarProjetoId, gerarSiteId, sites.length],
    queryFn: async () => {
      console.log("Iniciando busca de produções dos diários:", { gerarPeriodoInicio, gerarPeriodoFim, gerarProjetoId, gerarSiteId });
      
      let siteIdsToFetch: string[] = [];
      if (gerarSiteId) {
        siteIdsToFetch = [gerarSiteId];
      } else if (gerarProjetoId) {
        // Garantir que temos os sites antes de filtrar
        const projectSites = sites.filter(s => s.projeto_id === gerarProjetoId);
        if (projectSites.length === 0 && sites.length > 0) {
           console.warn(`Nenhum site encontrado para o projeto ${gerarProjetoId} entre os ${sites.length} sites carregados.`);
        }
        siteIdsToFetch = projectSites.map(s => s.id);
        console.log(`Projeto ${gerarProjetoId} tem ${siteIdsToFetch.length} sites.`);
      } else {
        siteIdsToFetch = sites.map(s => s.id);
      }

      if (siteIdsToFetch.length === 0) {
        console.warn("Nenhum site encontrado para os filtros selecionados.");
        return [];
      }

      // Buscar Diários
      let allDiarios: any[] = [];
      const siteBatchSize = 100;
      for (let i = 0; i < siteIdsToFetch.length; i += siteBatchSize) {
        const batch = siteIdsToFetch.slice(i, i + siteBatchSize);
        let query = supabase
          .from("diarios_obra")
          .select("id, site_id, data")
          .in("site_id", batch)
          .gte("data", gerarPeriodoInicio)
          .lte("data", gerarPeriodoFim);

        const { data, error } = await query;
        if (error) {
          console.error("Erro ao buscar diários:", error);
          throw error;
        }
        if (data) allDiarios = [...allDiarios, ...data];
      }

      if (allDiarios.length === 0) {
        console.log("Nenhum diário de obra encontrado no período para os sites selecionados.");
        return [];
      }

      console.log(`Encontrados ${allDiarios.length} diários. Buscando itens de produção em lotes...`);
      
      const diarioIds = allDiarios.map(d => d.id);
      const diarioMap = new Map(allDiarios.map(d => [d.id, d]));
      
      let allProds: any[] = [];
      const prodBatchSize = 100; // Lotes de IDs de diários
      for (let i = 0; i < diarioIds.length; i += prodBatchSize) {
        const batch = diarioIds.slice(i, i + prodBatchSize);
        const { data, error } = await supabase
          .from("diario_producao")
          .select("*, item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario)")
          .in("diario_id", batch);
        
        if (error) {
          console.error("Erro ao buscar produções:", error);
          throw error;
        }
        if (data) allProds = [...allProds, ...data];
      }

      console.log(`Total de registros de produção encontrados: ${allProds.length}`);

      return allProds.map(p => {
        const diario = diarioMap.get(p.diario_id);
        return {
          site_id: diario?.site_id || "",
          item_lpu_id: p.item_lpu_id,
          data_producao: diario?.data || "",
          quantidade: Number(p.quantidade),
          valor_total: Number(p.valor_total || 0),
          item_lpu: (p as any).item_lpu,
          source: "diario" as const,
        };
      });
    },
    enabled: isOpen && !!gerarPeriodoInicio && !!gerarPeriodoFim,
    staleTime: 0, // Garante que a busca seja sempre fresca
  });

  const handleGerarPreview = async () => {
    const validation = gerarMedicaoSchema.safeParse({
      periodoInicio: gerarPeriodoInicio,
      periodoFim: gerarPeriodoFim,
      numeroMedicao: gerarNumeroMedicao,
      tipoMedicao: gerarTipoMedicao,
      projetoId: gerarProjetoId || undefined,
      siteId: gerarSiteId || undefined,
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    const allProducao = [
      ...producoes.map(p => ({
        site_id: p.site_id,
        item_lpu_id: p.item_lpu_id,
        data_producao: p.data_producao,
        quantidade: Number(p.quantidade),
        item_lpu: p.item_lpu,
        valor_total: Number(p.quantidade) * Number(p.item_lpu?.preco_unitario || 0),
      })),
      ...diarioProducoes.map(dp => ({
        site_id: dp.site_id,
        item_lpu_id: dp.item_lpu_id,
        data_producao: dp.data_producao,
        quantidade: dp.quantidade,
        item_lpu: dp.item_lpu,
        valor_total: dp.valor_total,
      })),
    ];

    let filteredProducao = allProducao.filter(
      p => p.data_producao >= gerarPeriodoInicio && p.data_producao <= gerarPeriodoFim
    );

    if (gerarProjetoId) {
      const projectSiteIds = sites.filter(s => s.projeto_id === gerarProjetoId).map(s => s.id);
      filteredProducao = filteredProducao.filter(p => projectSiteIds.includes(p.site_id));
    }
    if (gerarSiteId) {
      filteredProducao = filteredProducao.filter(p => p.site_id === gerarSiteId);
    }

    const pendingBySiteItem = new Map<string, number>();
    lancamentos.forEach(l => {
      if ((l as any).quantidade_pendente && Number((l as any).quantidade_pendente) > 0) {
        const key = `${l.site_id}_${l.item_lpu_id}`;
        pendingBySiteItem.set(key, (pendingBySiteItem.get(key) || 0) + Number((l as any).quantidade_pendente));
      }
    });

    const grouped = new Map<string, GeracaoItem>();
    filteredProducao.forEach(p => {
      const key = `${p.site_id}_${p.item_lpu_id}`;
      const site = sites.find(s => s.id === p.site_id);
      const item = allItensLpu.find(i => i.id === p.item_lpu_id) || p.item_lpu;
      if (!site || !item) return;

      if (!grouped.has(key)) {
        const pendente = pendingBySiteItem.get(key) || 0;
        grouped.set(key, {
          site_id: p.site_id,
          site_codigo: site.codigo,
          site_nome: site.nome,
          item_lpu_id: p.item_lpu_id,
          item_codigo: item.codigo,
          item_descricao: item.descricao,
          unidade: item.unidade,
          preco_unitario: Number(item.preco_unitario),
          quantidade: 0,
          quantidade_pendente: pendente,
          valor_total: pendente * Number(item.preco_unitario),
          selected: true,
        });
      }
      const g = grouped.get(key)!;
      g.quantidade += p.quantidade;
      g.valor_total += p.valor_total;
    });

    pendingBySiteItem.forEach((pendente, key) => {
      if (!grouped.has(key) && pendente > 0) {
        const [siteIdVal, itemLpuId] = key.split("_");
        const site = sites.find(s => s.id === siteIdVal);
        const item = allItensLpu.find(i => i.id === itemLpuId);
        if (site && item) {
          let include = true;
          if (gerarProjetoId && site.projeto_id !== gerarProjetoId) include = false;
          if (gerarSiteId && site.id !== gerarSiteId) include = false;
          if (include) {
            grouped.set(key, {
              site_id: siteIdVal,
              site_codigo: site.codigo,
              site_nome: site.nome,
              item_lpu_id: itemLpuId,
              item_codigo: item.codigo,
              item_descricao: item.descricao,
              unidade: item.unidade,
              preco_unitario: Number(item.preco_unitario),
              quantidade: 0,
              quantidade_pendente: pendente,
              valor_total: pendente * Number(item.preco_unitario),
              selected: true,
            });
          }
        }
      }
    });

    setGeracaoItens(Array.from(grouped.values()));

    setLoadingGeracaoFotos(true);
    try {
      const siteIds = gerarSiteId
        ? [gerarSiteId]
        : gerarProjetoId
          ? sites.filter(s => s.projeto_id === gerarProjetoId).map(s => s.id)
          : [...new Set(Array.from(grouped.values()).map(g => g.site_id))];

      if (siteIds.length > 0) {
        const { data: diarios } = await supabase
          .from("diarios_obra")
          .select("id, data, site_id")
          .in("site_id", siteIds)
          .gte("data", gerarPeriodoInicio)
          .lte("data", gerarPeriodoFim);

        if (diarios && diarios.length > 0) {
          const diarioIds = diarios.map(d => d.id);
          const diarioMap = new Map(diarios.map(d => [d.id, d]));

          const fetchGeracaoFotosPreview = async (ids: string[]) => {
            // ETAPA 1 — Contar sem carregar
            const { count } = await supabase
              .from("diario_fotos")
              .select("id", { count: "exact", head: true })
              .in("diario_id", ids);
            
            setGeracaoFotosTotal(count || 0);

            // ETAPA 2 — Carregar para preview apenas as primeiras 50
            const { data, error } = await supabase
              .from("diario_fotos")
              .select("*")
              .in("diario_id", ids)
              .limit(50);
              
            if (error) throw error;
            return data || [];
          };

          const fotos = await fetchGeracaoFotosPreview(diarioIds);
          const producaoIds = (fotos || []).map(f => (f as any).diario_producao_id).filter(Boolean);
          let producaoMap = new Map<string, any>();
          if (producaoIds.length > 0) {
            const { data: prods } = await supabase
              .from("diario_producao")
              .select("id, item_lpu:itens_lpu(codigo, descricao)")
              .in("id", producaoIds);
            if (prods) producaoMap = new Map(prods.map(p => [p.id, p]));
          }

          setGeracaoFotos((fotos || []).map(f => {
            const diario = diarioMap.get(f.diario_id);
            const producao = (f as any).diario_producao_id ? producaoMap.get((f as any).diario_producao_id) : null;
            const fotoSite = diario ? sites.find(s => s.id === diario.site_id) : null;
            return {
              id: f.id,
              url: f.url,
              classificacao: f.classificacao,
              legenda: f.legenda,
              item_codigo: producao?.item_lpu?.codigo,
              item_descricao: producao?.item_lpu?.descricao,
              diario_data: diario?.data,
              site_id: diario?.site_id,
              site_nome: fotoSite ? `${fotoSite.codigo} - ${fotoSite.nome}` : undefined,
              selected: true,
            };
          }));
        } else {
          setGeracaoFotos([]);
          setGeracaoFotosTotal(0);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar fotos:", err);
      setGeracaoFotos([]);
      setGeracaoFotosTotal(0);
    }
    setLoadingGeracaoFotos(false);

    const warnings: string[] = [];
    const siteIdsInGeracao = [...new Set(Array.from(grouped.values()).map(g => g.site_id))];
    
    for (const sid of siteIdsInGeracao) {
      const siteName = sites.find(s => s.id === sid);
      const existingForSite = lancamentos.filter(
        l => l.site_id === sid && 
             (l.status === "aprovado" || l.status === "enviada") && 
             l.periodo_inicio && l.periodo_fim
      );
      
      for (const existing of existingForSite) {
        const exStart = existing.periodo_inicio!;
        const exEnd = existing.periodo_fim!;
        if (gerarPeriodoInicio <= exEnd && gerarPeriodoFim >= exStart) {
          const siteLabel = siteName ? `${siteName.codigo} - ${siteName.nome}` : sid;
          const statusLabel = existing.status === "aprovado" ? "aprovada" : "enviada";
          warnings.push(
            `Site ${siteLabel}: período sobrepõe medição ${existing.numero_medicao || "s/n"} (${statusLabel}) de ${formatDate(exStart)} a ${formatDate(exEnd)}`
          );
          break;
        }
      }
    }
    
    setDuplicateWarnings(warnings);
    setShowPreview(true);
  };

  const handleEnviarMedicao = async () => {
    const selectedItens = geracaoItens.filter(i => i.selected);
    if (selectedItens.length === 0) return;

    const reportConfig = {
      mostrar_lpu: mostrarLpu,
      mostrar_valores_site: mostrarValoresSite,
      modo_somente_fotos: modoSomenteFotos,
      fotos_por_pagina: fotosPorPagina,
      legenda_padrao_fotos: legendaPadraoFotos,
    };

    const today = new Date().toISOString().split("T")[0];
    const customLogo = empresaLogoUrl || localStorage.getItem("custom_logo_url") || "";

    let items: any[];

    if (gerarTipoMedicao === "agrupada" || gerarTipoMedicao === "mista") {
      const anchorSiteId = selectedItens[0]?.site_id;
      const grouped = new Map<string, { item_lpu_id: string; quantidade: number }>();
      selectedItens.forEach(item => {
        const key = item.item_lpu_id;
        if (!grouped.has(key)) {
          grouped.set(key, {
            item_lpu_id: item.item_lpu_id,
            quantidade: item.quantidade + item.quantidade_pendente,
          });
        } else {
          const g = grouped.get(key)!;
          g.quantidade += item.quantidade + item.quantidade_pendente;
        }
      });

      items = Array.from(grouped.values()).map(g => ({
        site_id: anchorSiteId,
        item_lpu_id: g.item_lpu_id,
        data_medicao: today,
        quantidade: g.quantidade,
        numero_medicao: gerarNumeroMedicao || undefined,
        status: "enviada",
        periodo_inicio: gerarPeriodoInicio,
        periodo_fim: gerarPeriodoFim,
        logo_empresa_url: customLogo,
        observacao: gerarTipoMedicao === "mista" ? "tipo:mista" : "tipo:agrupada",
      }));
    } else {
      items = selectedItens.map(item => ({
        site_id: item.site_id,
        item_lpu_id: item.item_lpu_id,
        data_medicao: today,
        quantidade: item.quantidade + item.quantidade_pendente,
        numero_medicao: gerarNumeroMedicao || undefined,
        status: "enviada",
        periodo_inicio: gerarPeriodoInicio,
        periodo_fim: gerarPeriodoFim,
        logo_empresa_url: customLogo,
        observacao: "tipo:separada",
      }));
    }

    await onEnviar({
      items,
      selectedItens,
      capaFile,
      reportConfig: {
        mostrar_lpu: mostrarLpu,
        mostrar_valores_site: mostrarValoresSite,
        modo_somente_fotos: modoSomenteFotos,
        fotos_por_pagina: fotosPorPagina,
        legenda_padrao_fotos: legendaPadraoFotos
      }
    });

    // Reset local state
    setShowPreview(false);
    setGeracaoItens([]);
    setGeracaoFotos([]);
    setGeracaoFotosTotal(0);
    setGerarNumeroMedicao("");
    setGerarPeriodoInicio("");
    setGerarPeriodoFim("");
    setGerarProjetoId("");
    setGerarSiteId("");
    setGerarTipoMedicao("separada");
    setDuplicateWarnings([]);
    setCapaFile(null);
  };

  const geracaoTotal = geracaoItens.filter(i => i.selected).reduce((s, i) => s + (i.quantidade + i.quantidade_pendente) * i.preco_unitario, 0);

  const filterSites = useMemo(() => 
    gerarProjetoId ? sites.filter(s => s.projeto_id === gerarProjetoId) : sites,
    [gerarProjetoId, sites]
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Medição do Período</DialogTitle>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Projeto</Label>
                <Select value={gerarProjetoId || "all"} onValueChange={(v) => { setGerarProjetoId(v === "all" ? "" : v); setGerarSiteId(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder={projetos.length === 0 ? "Carregando projetos..." : "Todos os projetos"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os projetos</SelectItem>
                    {projetos.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Site</Label>
                <Select value={gerarSiteId || "all"} onValueChange={(v) => setGerarSiteId(v === "all" ? "" : v)} disabled={gerarProjetoId && filterSites.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={gerarProjetoId && filterSites.length === 0 ? "Carregando sites..." : "Todos os sites"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os sites</SelectItem>
                    {filterSites.map(s => <SelectItem key={s.id} value={s.id}>{s.codigo} - {s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Período de Início</Label>
                <Input type="date" value={gerarPeriodoInicio} onChange={(e) => setGerarPeriodoInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Período de Fim</Label>
                <Input type="date" value={gerarPeriodoFim} onChange={(e) => setGerarPeriodoFim(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nº da Medição (Opcional)</Label>
              <Input value={gerarNumeroMedicao} onChange={(e) => setGerarNumeroMedicao(e.target.value)} placeholder="Ex: 001/2024" />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Medição</Label>
              <RadioGroup value={gerarTipoMedicao} onValueChange={(v: any) => setGerarTipoMedicao(v)} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="separada" id="sep" />
                  <Label htmlFor="sep">Separada por Site</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="agrupada" id="agr" />
                  <Label htmlFor="agr">Agrupada por Projeto</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mista" id="mst" />
                  <Label htmlFor="mst">Mista (Consolidado)</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground mt-1">
                {gerarTipoMedicao === "separada" && "Gera uma medição individual para cada site que teve produção."}
                {gerarTipoMedicao === "agrupada" && "Gera uma única medição consolidando todos os sites do projeto selecionado."}
                {gerarTipoMedicao === "mista" && "Consolida itens iguais de diferentes sites em uma única linha."}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Label>Capa da Medição (Opcional)</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" type="button" onClick={() => capaInputRef.current?.click()} disabled={uploadingCapa}>
                  <Upload className="h-4 w-4 mr-2" />
                  {capaFile ? "Trocar Arquivo" : "Selecionar PDF/Imagem"}
                </Button>
                <input type="file" ref={capaInputRef} className="hidden" accept=".pdf,image/*" onChange={(e) => setCapaFile(e.target.files?.[0] || null)} />
                {capaFile && (
                  <div className="flex items-center gap-2 text-sm bg-muted p-1 px-2 rounded-md">
                    <span className="truncate max-w-[200px]">{capaFile.name}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setCapaFile(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 border rounded-md p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Configurações do Relatório
                </h3>
                {templates.length > 0 && (
                  <Select onValueChange={(v) => {
                    const t = templates.find(temp => temp.id === v);
                    if (t) applyTemplate(t);
                  }}>
                    <SelectTrigger className="h-8 w-[200px]">
                      <SelectValue placeholder="Aplicar Template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="show-lpu" checked={mostrarLpu} onCheckedChange={(c) => setMostrarLpu(!!c)} />
                  <Label htmlFor="show-lpu" className="text-xs">Mostrar código/descrição LPU</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="show-site-vals" checked={mostrarValoresSite} onCheckedChange={(c) => setMostrarValoresSite(!!c)} />
                  <Label htmlFor="show-site-vals" className="text-xs">Mostrar valores por site</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="only-photos" checked={modoSomenteFotos} onCheckedChange={(c) => setModoSomenteFotos(!!c)} />
                  <Label htmlFor="only-photos" className="text-xs">Modo somente fotos (Anexo)</Label>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold">Fotos por Página</Label>
                  <Select value={fotosPorPagina.toString()} onValueChange={(v) => setFotosPorPagina(parseInt(v))}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 fotos</SelectItem>
                      <SelectItem value="4">4 fotos</SelectItem>
                      <SelectItem value="6">6 fotos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground font-bold">Legenda Padrão das Fotos</Label>
                <Input 
                  value={legendaPadraoFotos} 
                  onChange={(e) => setLegendaPadraoFotos(e.target.value)} 
                  placeholder="Deixe vazio para usar a legenda original"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleGerarPreview} disabled={!gerarPeriodoInicio || !gerarPeriodoFim || isLoadingDiarios || isFetchingDiarios}>
                {(loadingGeracaoFotos || isLoadingDiarios || isFetchingDiarios) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Ver Itens Produzidos
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Período Selecionado:</p>
                <p className="font-semibold">{formatDate(gerarPeriodoInicio)} a {formatDate(gerarPeriodoFim)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>Alterar Filtros</Button>
            </div>

            {duplicateWarnings.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3 space-y-1">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-400 font-semibold mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  Atenção: Sobreposição de Períodos
                </div>
                {duplicateWarnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-700 dark:text-yellow-500">• {w}</p>
                ))}
              </div>
            )}

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"><Checkbox checked={geracaoItens.every(i => i.selected)} onCheckedChange={(checked) => setGeracaoItens(prev => prev.map(i => ({ ...i, selected: !!checked })))} /></TableHead>
                    <TableHead>Site / Item</TableHead>
                    <TableHead className="text-right">Produção</TableHead>
                    <TableHead className="text-right">Pendência</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {geracaoItens.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma produção ou pendência encontrada no período.</TableCell></TableRow>
                  ) : (
                    geracaoItens.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell><Checkbox checked={item.selected} onCheckedChange={(checked) => { const next = [...geracaoItens]; next[idx].selected = !!checked; setGeracaoItens(next); }} /></TableCell>
                        <TableCell>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold">{item.site_codigo} - {item.site_nome}</p>
                          <p className="font-medium">{item.item_codigo}</p>
                          <p className="text-xs text-muted-foreground">{item.item_descricao}</p>
                        </TableCell>
                        <TableCell className="text-right">{item.quantidade} {item.unidade}</TableCell>
                        <TableCell className="text-right text-orange-600 font-medium">{item.quantidade_pendente > 0 ? `+${item.quantidade_pendente}` : "-"}</TableCell>
                        <TableCell className="text-right font-bold">{(item.quantidade + item.quantidade_pendente).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{formatCurrency((item.quantidade + item.quantidade_pendente) * item.preco_unitario)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={5} className="text-right uppercase">Total da Medição:</TableCell>
                    <TableCell className="text-right text-lg">{formatCurrency(geracaoTotal)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">
                    Relatório Fotográfico (mostrando {geracaoFotos.length} de {geracaoFotosTotal} fotos)
                  </h3>
                  {loadingGeracaoFotos && <Loader2 className="h-3 w-3 animate-spin" />}
                </div>
                {geracaoFotos.length > 0 && (
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] h-7"
                      onClick={() => setGeracaoFotos(prev => prev.map(f => ({ ...f, selected: true })))}
                    >
                      Selecionar Todas
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] h-7"
                      onClick={() => setGeracaoFotos(prev => prev.map(f => ({ ...f, selected: false })))}
                    >
                      Desmarcar Todas
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {geracaoFotos.map((foto, idx) => (
                  <div key={foto.id} className="relative group rounded-md overflow-hidden border aspect-square bg-muted">
                    <SmartImage src={foto.url} context="diario_fotos" className="w-full h-full object-cover" alt="" />
                    <div className="absolute top-1 right-1">
                      <Checkbox checked={foto.selected} onCheckedChange={(checked) => { const next = [...geracaoFotos]; next[idx].selected = !!checked; setGeracaoFotos(next); }} className="bg-white/80" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {foto.item_codigo || foto.classificacao}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>Voltar</Button>
              <Button onClick={handleEnviarMedicao} disabled={geracaoItens.filter(i => i.selected).length === 0}>
                Enviar Medição para Aprovação
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
