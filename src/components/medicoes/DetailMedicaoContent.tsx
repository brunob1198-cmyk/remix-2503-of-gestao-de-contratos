import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { FileText, Camera, MapPin, Calendar, Loader2, ScrollText, AlertCircle, CheckCircle2, X, Play, RotateCcw, Settings2, Download, Archive } from "lucide-react";
import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { clearPDFChunks, clearExportState, getExportState, saveExportState, clearPhotoCache, clearPartialPDFs } from "@/lib/db";
import { 
  chunkArray,
  PDFExportLog,
  PDFQuality,
  exportMedicaoToPdf,
  getPdfSafeImageDataUrl,
} from "@/lib/pdfExportUtils";
import { exportMedicaoCompletePackage, PhotoToZip, ExtraFile } from "@/lib/photoZipUtils";

const PDF_EXPORT_MIN_WIDTH = 1120;





interface DetailMedicaoContentProps {
  detailMedicao: {
    id: string;
    site_id: string;
    site_codigo: string;
    site_nome: string;
    projeto_codigo: string;
    projeto_nome: string;
    uf: string;
    data_medicao: string;
    numero_medicao: string;
    total_valor: number;
    status: string;
    numero_po?: string;
    observacao_acompanhamento?: string;
    periodo_inicio?: string;
    periodo_fim?: string;
    lancamentoIds: string[];
    logo_empresa_url?: string;
    capa_url?: string | null;
  };
  detailLancamentos: any[];
  sites: any[];
  formatCurrency: (v: number) => string;
  formatDate: (d: string) => string;
}

interface DiarioFotoWithItem {
  id: string;
  url: string;
  classificacao: string;
  legenda: string | null;
  diario_producao_id: string | null;
  item_codigo?: string;
  item_descricao?: string;
  diario_data?: string;
  site_id?: string;
  site_nome?: string;
  municipio?: string;
}

export function DetailMedicaoContent({
  detailMedicao,
  detailLancamentos,
  sites,
  formatCurrency,
  formatDate,
}: DetailMedicaoContentProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportLogs, setExportLogs] = useState<PDFExportLog[]>([]);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [pdfQuality, setPdfQuality] = useState<PDFQuality>('medium');
  const [reducedSize, setReducedSize] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [hasCheckpoint, setHasCheckpoint] = useState<{ type: 'pdf' | 'zip', lastIndex: number, total: number } | null>(null);
  const [base64EmpresaLogo, setBase64EmpresaLogo] = useState<string | null>(null);
  const [base64ClienteLogo, setBase64ClienteLogo] = useState<string | null>(null);

  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success' | 'debug' = 'info') => {
    const newLog: PDFExportLog = {
      timestamp: new Date().toLocaleTimeString(),
      message: message,
      type: type as any
    };
    setExportLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep more logs for large exports
    console.log(`[Export] ${message}`);
  }, []);

  // Fetch existing export on mount or ID change
  const { data: existingExport, refetch: refetchExport } = useQuery({
    queryKey: ["medicao_last_export", detailMedicao.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicao_exports")
        .select("*")
        .eq("medicao_id", detailMedicao.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;

      // Get signed URL for the existing storage path
      const { data: signedData, error: sErr } = await supabase.storage
        .from("medicoes-pdf")
        .createSignedUrl(data.storage_path, 3600);
      
      if (sErr) throw sErr;
      return { ...data, signedUrl: signedData.signedUrl };
    },
    enabled: !!detailMedicao.id
  });

  // Set download URL if existing export found
  useEffect(() => {
    if (existingExport?.signedUrl) {
      setDownloadUrl(existingExport.signedUrl);
      setShowLogPanel(true);
      addLog("Exportação anterior encontrada e recuperada.", "success");
      setExportProgress(100);
    }
  }, [existingExport, addLog]);


  useEffect(() => {
    const checkCheckpoint = async () => {
      // Check for PDF checkpoint
      const pdfState = await getExportState(detailMedicao.id);
      if (pdfState && pdfState.state) {
        setHasCheckpoint({
          type: 'pdf',
          lastIndex: pdfState.state.lastIndex,
          total: pdfState.state.total
        });
        setShowLogPanel(true);
        addLog(`Checkpoint de PDF encontrado: parou na seção ${pdfState.state.lastIndex + 1} de ${pdfState.state.total}.`, 'info');
        return;
      }
      
      // Check for ZIP progress (indirectly by checking cache)
      // This is simplified: if we have any photos cached for this medicao, offer to resume
      // But actually, handleExportZip(true) will automatically use the cache.
    };
    void checkCheckpoint();
  }, [detailMedicao.id, addLog]);


  // Update logs when exporting state changes
  useEffect(() => {
    if (isExporting) {
      setShowLogPanel(true);
      
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "Exportação em andamento. Se você sair, o processo será interrompido.";
        return e.returnValue;
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [isExporting]);

  const site = sites.find(s => s.id === detailMedicao.site_id);
  const clienteLogoUrl = site?.clienteObj?.logo_url || site?.projeto?.clienteObj?.logo_url;

  const getLogoUrl = useCallback((url: string | null | undefined, bucket: string = 'empresa_logos') => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    const { data } = supabase.storage.from(bucket).getPublicUrl(url);
    return data?.publicUrl || null;
  }, []);

  const finalEmpresaLogoUrl = useMemo(() => 
    getLogoUrl(detailMedicao.logo_empresa_url, 'empresa_logos') || getLogoUrl(localStorage.getItem("custom_logo_url"), 'empresa_logos'),
  [detailMedicao.logo_empresa_url, getLogoUrl]);

  const finalClienteLogoUrl = useMemo(() => 
    getLogoUrl(clienteLogoUrl, 'clientes_logos'),
  [clienteLogoUrl, getLogoUrl]);

  // Pre-load logos into base64 to avoid CORS issues during PDF generation
  useEffect(() => {
    const loadLogos = async () => {
      if (finalEmpresaLogoUrl && !finalEmpresaLogoUrl.startsWith('data:')) {
        try {
          const b64 = await getPdfSafeImageDataUrl(finalEmpresaLogoUrl, { maxWidth: 400, quality: 0.9 });
          if (b64 && b64.startsWith('data:')) setBase64EmpresaLogo(b64);
        } catch (e) {
          console.warn("Failed to pre-load empresa logo to base64", e);
        }
      }
      if (finalClienteLogoUrl && !finalClienteLogoUrl.startsWith('data:')) {
        try {
          const b64 = await getPdfSafeImageDataUrl(finalClienteLogoUrl, { maxWidth: 400, quality: 0.9 });
          if (b64 && b64.startsWith('data:')) setBase64ClienteLogo(b64);
        } catch (e) {
          console.warn("Failed to pre-load cliente logo to base64", e);
        }
      }
    };
    void loadLogos();
  }, [finalEmpresaLogoUrl, finalClienteLogoUrl]);

  // Detect measurement type from lancamentos' observacao field
  const tipoMedicao = useMemo(() => {
    const obs = detailLancamentos.find(l => l.observacao)?.observacao || "";
    if (obs.includes("tipo:mista")) return "mista";
    if (obs.includes("tipo:agrupada")) return "agrupada";
    return "separada";
  }, [detailLancamentos]);

  const isMultiSite = tipoMedicao === "mista" || tipoMedicao === "agrupada";

  // For mista/agrupada, find all sites that had production in the period
  const allSiteIds = useMemo(() => {
    if (!isMultiSite || !detailMedicao.periodo_inicio || !detailMedicao.periodo_fim) {
      return [detailMedicao.site_id];
    }
    // Get all sites from the same project
    const projeto = site?.projeto_id;
    if (projeto) {
      return sites.filter(s => s.projeto_id === projeto).map(s => s.id);
    }
    return [detailMedicao.site_id];
  }, [isMultiSite, detailMedicao, sites, site]);

  // Fetch diary production per site in the period (for mista per-site tables)
  const { data: siteProduction = [] } = useQuery({
    queryKey: ["medicao_site_production", allSiteIds, detailMedicao.periodo_inicio, detailMedicao.periodo_fim],
    queryFn: async () => {
      if (!isMultiSite || !detailMedicao.periodo_inicio || !detailMedicao.periodo_fim) return [];
      
      const { data: diarios } = await supabase
        .from("diarios_obra")
        .select("id, data, site_id")
        .in("site_id", allSiteIds)
        .gte("data", detailMedicao.periodo_inicio!)
        .lte("data", detailMedicao.periodo_fim!);
      if (!diarios?.length) return [];

      const diarioIds = diarios.map(d => d.id);
      const diarioMap = new Map(diarios.map(d => [d.id, d]));

      const { data: prods } = await supabase
        .from("diario_producao")
        .select("*, item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario)")
        .in("diario_id", diarioIds);
      if (!prods) return [];

      return prods.map(p => {
        const diario = diarioMap.get(p.diario_id);
        return {
          site_id: diario?.site_id || "",
          item_lpu_id: p.item_lpu_id,
          quantidade: Number(p.quantidade),
          item_lpu: (p as any).item_lpu,
        };
      });
    },
    enabled: isMultiSite && !!detailMedicao.periodo_inicio && !!detailMedicao.periodo_fim,
  });

  // Group site production by site
  const productionBySite = useMemo(() => {
    const map = new Map<string, { item_codigo: string; item_descricao: string; quantidade: number; unidade: string; preco_unitario: number }[]>();
    siteProduction.forEach(p => {
      if (!map.has(p.site_id)) map.set(p.site_id, []);
      const items = map.get(p.site_id)!;
      const existing = items.find(i => i.item_codigo === p.item_lpu?.codigo);
      if (existing) {
        existing.quantidade += p.quantidade;
      } else if (p.item_lpu) {
        items.push({
          item_codigo: p.item_lpu.codigo,
          item_descricao: p.item_lpu.descricao,
          quantidade: p.quantidade,
          unidade: p.item_lpu.unidade,
          preco_unitario: Number(p.item_lpu.preco_unitario),
        });
      }
    });
    return map;
  }, [siteProduction]);

  const getSiteItemsTotal = useCallback(
    (items: { quantidade: number; preco_unitario: number }[]) =>
      items.reduce((sum, item) => sum + item.quantidade * item.preco_unitario, 0),
    [],
  );

  // Fetch diary observations per site (for mista)
  const { data: observacoesBySite = new Map<string, string[]>() } = useQuery({
    queryKey: ["medicao_site_obs", allSiteIds, detailMedicao.periodo_inicio, detailMedicao.periodo_fim],
    queryFn: async () => {
      if (!isMultiSite || !detailMedicao.periodo_inicio || !detailMedicao.periodo_fim) return new Map<string, string[]>();

      const { data: diarios } = await supabase
        .from("diarios_obra")
        .select("site_id, observacoes")
        .in("site_id", allSiteIds)
        .gte("data", detailMedicao.periodo_inicio!)
        .lte("data", detailMedicao.periodo_fim!)
        .not("observacoes", "is", null);

      const map = new Map<string, string[]>();
      (diarios || []).forEach(d => {
        if (d.observacoes?.trim()) {
          if (!map.has(d.site_id)) map.set(d.site_id, []);
          const list = map.get(d.site_id)!;
          if (!list.includes(d.observacoes.trim())) {
            list.push(d.observacoes.trim());
          }
        }
      });
      return map;
    },
    enabled: isMultiSite && !!detailMedicao.periodo_inicio && !!detailMedicao.periodo_fim,
  });

  // Fetch diary photos
  const { data: diarioFotos = [], isLoading: loadingFotos } = useQuery({
    queryKey: ["medicao_fotos", allSiteIds, detailMedicao.periodo_inicio, detailMedicao.periodo_fim],
    queryFn: async () => {
      if (!detailMedicao.periodo_inicio || !detailMedicao.periodo_fim) return [];

      const siteIdsToQuery = isMultiSite ? allSiteIds : [detailMedicao.site_id];

      const { data: diarios, error: dErr } = await supabase
        .from("diarios_obra")
        .select("id, data, site_id")
        .in("site_id", siteIdsToQuery)
        .gte("data", detailMedicao.periodo_inicio)
        .lte("data", detailMedicao.periodo_fim);
      if (dErr || !diarios?.length) return [];

      const diarioIds = diarios.map(d => d.id);
      const diarioMap = new Map(diarios.map(d => [d.id, d]));

      const fetchAllFotos = async () => {
        const all: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("diario_fotos")
            .select("*")
            .in("diario_id", diarioIds)
            .order("created_at", { ascending: true })
            .range(from, from + 999);
          if (error) throw error;
          if (!data?.length) break;
          all.push(...data);
          if (data.length < 1000) break;
          from += 1000;
        }
        return all;
      };
      let fotos: any[] = [];
      try {
        fotos = await fetchAllFotos();
      } catch {
        return [];
      }

      const producaoIds = (fotos || [])
        .map(f => (f as any).diario_producao_id)
        .filter(Boolean);

      let producaoMap = new Map<string, any>();
      if (producaoIds.length > 0) {
        const { data: producoes } = await supabase
          .from("diario_producao")
          .select("id, item_lpu:itens_lpu(codigo, descricao)")
          .in("id", producaoIds);
        if (producoes) {
          producaoMap = new Map(producoes.map(p => [p.id, p]));
        }
      }

      return (fotos || []).map(f => {
        const diario = diarioMap.get(f.diario_id);
        const producao = (f as any).diario_producao_id ? producaoMap.get((f as any).diario_producao_id) : null;
        const fotoSite = diario ? sites.find(s => s.id === diario.site_id) : null;
        
        // Normalize classification case to match UI logic
        let rawClass = (f.classificacao || "").trim();
        let normalizedClass = rawClass;
        if (rawClass.toLowerCase() === "vistoria") normalizedClass = "antes";
        if (rawClass.toLowerCase() === "execucao" || rawClass.toLowerCase() === "execução") normalizedClass = "execucao";

        return {
          id: f.id,
          url: f.url,
          classificacao: normalizedClass,
          legenda: f.legenda,
          diario_producao_id: (f as any).diario_producao_id,
          item_codigo: producao?.item_lpu?.codigo,
          item_descricao: producao?.item_lpu?.descricao,
          diario_data: diario?.data,
          site_id: diario?.site_id,
          site_nome: fotoSite ? `${fotoSite.codigo} - ${fotoSite.nome}` : undefined,
          municipio: fotoSite?.municipio || site?.municipio,
        } as DiarioFotoWithItem;
      });
    },
    enabled: !!detailMedicao.periodo_inicio && !!detailMedicao.periodo_fim,
  });

  const classLabel = (cls: string) => {
    switch (cls?.toLowerCase()) {
      case "execucao":
      case "execução":
        return "Execução";
      case "antes":
      case "vistoria":
        return "Vistoria";
      case "problema": return "Problema";
      default: return cls || "Outros";
    }
  };

  const classColor = (cls: string) => {
    switch (cls?.toLowerCase()) {
      case "execucao":
      case "execução":
        return "#2563eb";
      case "antes":
      case "vistoria":
        return "#16a34a";
      case "problema": return "#dc2626";
      default: return "#6b7280";
    }
  };

  const renderPhotoCard = useCallback(
    (foto: DiarioFotoWithItem, options?: { showItem?: boolean; showSiteName?: boolean }) => (
      <div 
        key={foto.id} 
        className="border rounded-lg overflow-hidden shadow-sm bg-card h-full flex flex-col" 
        data-pdf-element="photo" 
        style={{ minHeight: '320px', breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        <div className="aspect-[4/3] bg-muted/10 p-0.5 flex items-center justify-center overflow-hidden">
          <img
            src={`${foto.url}${foto.url.includes('?') ? '&' : '?'}width=800&quality=80&t=${Date.now()}`}
            alt={foto.item_descricao || foto.site_nome || "foto"}
            className="h-full w-full object-contain"
            loading="eager"
            decoding="sync"
            crossOrigin="anonymous"
          />
        </div>
        <div className="p-3 bg-muted/5 space-y-2 flex-1 flex flex-col">
          {options?.showItem !== false && (foto.item_codigo || foto.item_descricao) && (
            <p className="font-bold text-[11px] text-foreground leading-tight line-clamp-2 mb-1">
              {foto.item_codigo ? `${foto.item_codigo} — ` : ''}{foto.item_descricao}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground mt-auto pt-2 border-t border-muted/20">
            {options?.showSiteName && foto.site_nome && (
              <span className="font-medium text-primary/80 line-clamp-1" title={foto.site_nome}>
                {foto.site_nome}
              </span>
            )}
            {foto.diario_data && (
              <span className="flex items-center gap-1 shrink-0">
                <Calendar className="h-2.5 w-2.5" />
                {formatDate(foto.diario_data)}
              </span>
            )}
            <Badge 
              className="badge-execucao text-[8px] px-1.5 h-4 text-white font-bold border-none" 
              style={{ backgroundColor: classColor(foto.classificacao) }}
            >
              {classLabel(foto.classificacao)}
            </Badge>
          </div>

          {foto.legenda && (
            <p className="text-[10px] text-muted-foreground italic leading-tight line-clamp-2 mt-1.5 bg-muted/20 p-1.5 rounded">
              “{foto.legenda}”
            </p>
          )}
        </div>
      </div>
    ),
    [formatDate, classColor, classLabel],
  );

  const handleExportPdf = async (resume = false) => {
    if (isExporting) return;
    if (!printRef.current) return;
    
    const photoCount = diarioFotos.length;
    if (photoCount > 150 && !resume) {
      const isUltraLarge = photoCount > 1000;
      const message = isUltraLarge 
        ? `Atenção: Esta medição possui ${photoCount} fotos (VOLUME EXTREMO). \n\nO PDF será gerado em Modo de Ultra-Otimização para evitar que o navegador trave, o que reduzirá a qualidade das fotos. \n\nIMPORTANTE: Não feche a aba ou saia do site durante o processo. Se falhar, você poderá retomar de onde parou. \n\nDeseja prosseguir?`
        : `Atenção: Esta medição possui ${photoCount} fotos. Gerar um PDF com esse volume pode ser instável. \n\nPara grandes volumes, recomendamos a opção "Exportar Medição (ZIP)" que é muito mais rápida e segura. \n\nDeseja prosseguir com o PDF mesmo assim?`;
      
      const confirmLarge = window.confirm(message);
      if (!confirmLarge) return;
    }

    setIsExporting(true);
    setExportProgress(resume ? Math.round(((hasCheckpoint?.lastIndex || 0) / (hasCheckpoint?.total || 1)) * 95) : 5);
    if (!resume) setExportLogs([]);
    setDownloadUrl(null);
    addLog(resume ? "Retomando geração de PDF (modo chunking agressivo)..." : `Iniciando geração de PDF (${photoCount} fotos, modo seguro)...`, "info");

    try {
      const filename = `Medicao_${detailMedicao.numero_medicao || detailMedicao.id}.pdf`;
      
      await exportMedicaoToPdf(
        printRef.current,
        detailMedicao.id,
        (progress) => setExportProgress(progress),
        addLog,
        { 
          quality: pdfQuality, 
          filename, 
          resume,
          config: {
            marginMm: 12,
            baseFontSize: 12,
            sectionSpacingMm: 3,
            debugMode: debugMode
          },
          onPreviewGenerated: (url) => setPreviewUrl(url)
        }
      );

      addLog("Exportação PDF concluída com sucesso!", "success");
      setExportProgress(100);
      setIsExporting(false);
      setHasCheckpoint(null);
    } catch (e) {
      console.error("Erro na exportação local:", e);
      addLog(`Erro na geração: ${e instanceof Error ? e.message : String(e)}`, "error");
      setIsExporting(false);
    }
  };

  const handleExportZip = async (resume = false) => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress(0);
    if (!resume) setExportLogs([]);
    setShowLogPanel(true);
    setDownloadUrl(null);
    
    // Persistência de progresso: salvar estado inicial
    await saveExportState(detailMedicao.id, { type: 'zip', timestamp: Date.now(), status: 'started' });

    addLog(resume ? "Retomando exportação ZIP via stream..." : "Iniciando exportação completa via StreamSaver...", "info");
    if (reducedSize) addLog("Modo de tamanho reduzido ativado (thumbnails).", "info");
    addLog("O arquivo será gravado diretamente no seu disco para economizar memória.", "info");
    
    try {
      // 1. Prepare Photos and Logos
      addLog(`Encontradas ${diarioFotos.length} fotos para exportação.`, "info");
      
      if (diarioFotos.length === 0) {
        addLog("Aviso: Nenhuma foto encontrada para o período selecionado.", "error");
      }
      const photosToZip: PhotoToZip[] = diarioFotos.map((foto, index) => {
        const extension = (foto.url.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
        const dateStr = foto.diario_data ? formatDate(foto.diario_data).replace(/\//g, '-') : 'sem-data';
        const siteName = sanitize(foto.site_nome || "geral");
        const classification = sanitize(foto.classificacao || "outros");
        const itemDesc = sanitize(foto.item_descricao || "foto");
        
        // Nome de arquivo extremamente limpo
        const fileName = `foto_${index + 1}_${dateStr}_${itemDesc.substring(0, 20)}.${extension}`.toLowerCase();
        
        // Se o modo reduzido estiver ativo, usamos a transformação do Supabase Storage para economizar banda
        const finalUrl = reducedSize 
          ? `${foto.url}${foto.url.includes('?') ? '&' : '?'}width=1200&quality=75` 
          : foto.url;

        return {
          url: finalUrl,
          filename: fileName,
          folder: `fotos/${siteName}/${classification}`
        };
      });

      // Add Logos to Zip for local loading (already computed at component level)
      if (finalEmpresaLogoUrl) {
        photosToZip.push({
          url: finalEmpresaLogoUrl,
          filename: 'logo_empresa.png',
          folder: 'logos'
        });
      }
      if (finalClienteLogoUrl) {
        photosToZip.push({
          url: finalClienteLogoUrl,
          filename: 'logo_cliente.png',
          folder: 'logos'
        });
      }

      // 2. Prepare JSON Data and HTML Content
      const htmlContent = generateHtmlReport(true);
      const measurementData = {
        id: detailMedicao.id,
        numero: detailMedicao.numero_medicao,
        projeto: {
          codigo: detailMedicao.projeto_codigo,
          nome: detailMedicao.projeto_nome,
        },
        site: {
          codigo: detailMedicao.site_codigo,
          nome: detailMedicao.site_nome,
          uf: detailMedicao.uf,
        },
        data_medicao: detailMedicao.data_medicao,
        periodo: {
          inicio: detailMedicao.periodo_inicio,
          fim: detailMedicao.periodo_fim,
        },
        responsavel: "Gerado pelo Sistema",
        itens: detailLancamentos.map(l => ({
          codigo: l.item_lpu?.codigo,
          descricao: l.item_lpu?.descricao,
          unidade: l.item_lpu?.unidade,
          quantidade: l.quantidade,
          preco_unitario: l.item_lpu?.preco_unitario,
          total: Number(l.quantidade) * Number(l.item_lpu?.preco_unitario || 0),
          data: l.data
        })),
        valor_total: detailMedicao.total_valor,
        fotos_count: diarioFotos.length
      };

      const extraFiles: ExtraFile[] = [
        { filename: 'dados.json', content: JSON.stringify(measurementData, null, 2) },
        { filename: 'relatorio.html', content: htmlContent }
      ];

      const zipFilename = `Relatorio_Medicao_${detailMedicao.numero_medicao || detailMedicao.id}.zip`;
      
      await exportMedicaoCompletePackage(photosToZip, zipFilename, {
        concurrency: diarioFotos.length > 800 ? 1 : (diarioFotos.length > 300 ? 2 : 3),
        onProgress: (p, total) => setExportProgress(Math.round((p / total) * 100)),
        onLog: (msg, type) => addLog(msg, type),
        extraFiles,
        mainFolderName: '', // Removido o aninhamento para simplificar caminhos e evitar erros de extração
        medicaoId: detailMedicao.id,
        resume
      });

      addLog("Relatório ZIP gerado com sucesso! IMPORTANTE: Você precisa EXTRAIR TODOS OS ARQUIVOS do ZIP para uma pasta antes de abrir o 'relatorio.html', senão as fotos não carregarão.", "success");
      setExportProgress(100);
      setIsExporting(false);
      setHasCheckpoint(null);
      await clearExportState(detailMedicao.id);
    } catch (e) {
      console.error("Erro na exportação ZIP:", e);
      addLog(`Erro no ZIP: ${e instanceof Error ? e.message : String(e)}`, "error");
      setIsExporting(false);
    }
  };

  const totalValor = detailLancamentos.reduce((s, l) => s + Number(l.quantidade) * Number(l.item_lpu?.preco_unitario || 0), 0);

  // Get included sites list for agrupada/mista header
  const includedSites = useMemo(() => {
    if (!isMultiSite) return [];
    const siteIdsWithProduction = [...new Set(siteProduction.map(p => p.site_id))];
    return siteIdsWithProduction
      .map(sid => sites.find(s => s.id === sid))
      .filter(Boolean)
      .map(s => `${s.codigo} - ${s.nome}`)
      .sort();
  }, [isMultiSite, siteProduction, sites]);

  // Group photos by site AND classification (Vistoria/Execução) for mista
  const fotosBySiteAndClass = useMemo(() => {
    const map = new Map<string, Map<string, DiarioFotoWithItem[]>>();
    
    diarioFotos.forEach(f => {
      const siteKey = f.site_nome || "Sem site";
      if (!map.has(siteKey)) map.set(siteKey, new Map());
      
      const siteGroup = map.get(siteKey)!;
      const clsLower = f.classificacao?.toLowerCase();
      const classKey = (clsLower === "antes" || clsLower === "vistoria") ? "Vistoria" : 
                       (clsLower === "execucao" || clsLower === "execução") ? "Execução" : 
                       classLabel(f.classificacao);
      
      if (!siteGroup.has(classKey)) siteGroup.set(classKey, []);
      siteGroup.get(classKey)!.push(f);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([siteName, classMap]) => ({
        siteName,
        siteId: diarioFotos.find(f => (f.site_nome || "Sem site") === siteName)?.site_id || "",
        classes: Array.from(classMap.entries()).sort((a, b) => {
          if (a[0] === "Vistoria") return -1;
          if (b[0] === "Vistoria") return 1;
          return a[0].localeCompare(b[0]);
        })
      }));
  }, [diarioFotos]);

  // Group photos by item (for separada single-site)
  const fotosByItem = useMemo(() => {
    const map = new Map<string, DiarioFotoWithItem[]>();
    const gerais: DiarioFotoWithItem[] = [];
    diarioFotos.forEach(f => {
      if (f.diario_producao_id && f.item_codigo) {
        const key = `${f.item_codigo} - ${f.item_descricao}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(f);
      } else {
        gerais.push(f);
      }
    });
    return { byItem: map, gerais };
  }, [diarioFotos]);

  // Helper to sanitize strings for files/paths
  const sanitize = useCallback((s: string) => {
    return (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-z0-9\.\-]/gi, '_') 
      .replace(/_+/g, '_') 
      .replace(/^_+|_+$/g, '') 
      .toLowerCase(); 
  }, []);

  const generateHtmlReport = useCallback((forZip = false) => {
    const buildPhotoCardHtml = (foto: DiarioFotoWithItem, opts?: { showItem?: boolean; showSiteName?: boolean }) => {
      const idx = diarioFotos.findIndex(df => df.id === foto.id);
      const siteName = sanitize(foto.site_nome || "geral");
      const classification = sanitize(foto.classificacao || "outros");
      const dateStr = foto.diario_data ? formatDate(foto.diario_data).replace(/\//g, '-') : 'sem-data';
      const itemDesc = sanitize(foto.item_descricao || "foto");
      const extension = (foto.url.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(extension);
      
      const photoIndex = idx >= 0 ? idx : diarioFotos.length;
      const fileName = `foto_${photoIndex + 1}_${dateStr}_${itemDesc.substring(0, 20)}.${extension}`.toLowerCase();
      const relativeDir = `fotos/${siteName}/${classification}`;
      const localPath = `${relativeDir}/${fileName}`;
      const safePath = localPath.split('/').map(segment => encodeURIComponent(segment)).join('/');

      const clsLower = foto.classificacao?.toLowerCase();
      const color = (clsLower === "antes" || clsLower === "vistoria") ? "#16a34a" :
                    (clsLower === "execucao" || clsLower === "execução") ? "#2563eb" :
                    (clsLower === "problema") ? "#dc2626" : "#64748b";

      const showItem = opts?.showItem !== false;
      const showSiteName = !!opts?.showSiteName;

      return `
        <div class="photo-card">
          <div class="photo-img-wrap">
            ${isImage ? `
              <img 
                src="${safePath}" 
                data-original-src="${foto.url}"
                alt="${(foto.item_descricao || foto.site_nome || 'foto').replace(/"/g, '&quot;')}" 
                loading="lazy" 
                onerror="if(!this.dataset.triedUrl){ this.dataset.triedUrl=true; this.src=this.dataset.originalSrc; } else { this.parentElement.innerHTML='<div class=&quot;err-msg&quot;><b>Imagem não encontrada</b><br><br><i>Certifique-se de extrair o ZIP antes de abrir o relatório ou verifique sua conexão.</i></div>'; }">
            ` : `
              <div class="non-image-file">
                <span>📄 Arquivo ${extension.toUpperCase()}</span>
                <a href="${safePath}" target="_blank">Abrir arquivo</a>
              </div>
            `}
          </div>
          <div class="photo-info">
            ${showItem && foto.item_codigo ? `<p class="photo-title">${foto.item_codigo} — ${foto.item_descricao || ''}</p>` : ''}
            <div class="photo-meta">
              ${showSiteName && foto.site_nome ? `<span class="photo-site">📍 ${foto.site_nome}</span>` : ''}
              ${foto.diario_data ? `<span class="photo-date">📅 ${formatDate(foto.diario_data)}</span>` : ''}
              <span class="badge" style="background-color: ${color}">${classLabel(foto.classificacao)}</span>
            </div>
            ${foto.legenda ? `<p class="photo-legenda">“${foto.legenda}”</p>` : ''}
          </div>
        </div>
      `;
    };

    const buildSiteBlocksHtml = () => {
      if (!isMultiSite) return '';
      return fotosBySiteAndClass.map(({ siteName, siteId, classes }) => {
        const siteItems = productionBySite.get(siteId) || [];
        const siteTotal = getSiteItemsTotal(siteItems);
        const siteObs = (observacoesBySite instanceof Map ? observacoesBySite.get(siteId) : []) || [];

        const itemsTableHtml = siteItems.length > 0 ? `
          <div class="site-production">
            <p class="site-production-title">Produção do Site:</p>
            <table class="site-table">
              <thead>
                <tr><th>Item</th><th class="num">Qtd</th><th class="num">Valor</th></tr>
              </thead>
              <tbody>
                ${siteItems.map(si => `
                  <tr>
                    <td>${si.item_codigo} — ${si.item_descricao}</td>
                    <td class="num">${si.quantidade.toLocaleString("pt-BR")} ${si.unidade}</td>
                    <td class="num">${formatCurrency(si.quantidade * si.preco_unitario)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="site-total-bar">Total do site: <strong>${formatCurrency(siteTotal)}</strong></div>
          </div>
        ` : '';

        const obsHtml = siteObs.length > 0 ? `
          <div class="site-obs">
            <p class="site-obs-title">📋 Observações</p>
            ${siteObs.map(o => `<p class="site-obs-text">${o.replace(/\n/g, '<br>')}</p>`).join('')}
          </div>
        ` : '';

        const photosHtml = classes.map(([className, photos]) => `
          <div class="class-group">
            <h3 class="class-header">${className} (${photos.length})</h3>
            <div class="photo-grid">
              ${photos.map(f => buildPhotoCardHtml(f, { showItem: true, showSiteName: false })).join('')}
            </div>
          </div>
        `).join('');

        return `
          <section class="site-block">
            <div class="site-header">📍 ${siteName}</div>
            ${itemsTableHtml}
            ${obsHtml}
            ${photosHtml}
          </section>
        `;
      }).join('');
    };

    const buildPhotosByItemHtml = () => {
      if (isMultiSite) return '';
      const items = Array.from(fotosByItem.byItem.entries());
      const blocks = items.map(([key, photos]) => `
        <div class="item-group">
          <h3 class="item-group-header">${key} (${photos.length} fotos)</h3>
          <div class="photo-grid">
            ${photos.map(f => buildPhotoCardHtml(f, { showItem: false })).join('')}
          </div>
        </div>
      `).join('');
      const geraisBlock = fotosByItem.gerais.length > 0 ? `
        <div class="item-group">
          <h3 class="item-group-header">Fotos Gerais (${fotosByItem.gerais.length})</h3>
          <div class="photo-grid">
            ${fotosByItem.gerais.map(f => buildPhotoCardHtml(f, { showItem: false })).join('')}
          </div>
        </div>
      ` : '';
      return blocks + geraisBlock;
    };

    const itemsTableRows = detailLancamentos.map(l => {
      const preco = Number(l.item_lpu?.preco_unitario || 0);
      const qtd = Number(l.quantidade);
      return `
        <tr>
          <td>${l.item_lpu?.codigo || '-'} - ${l.item_lpu?.descricao || ''}</td>
          <td>${l.item_lpu?.unidade || '-'}</td>
          <td class="num">${qtd.toLocaleString("pt-BR")}</td>
          <td class="num">${formatCurrency(preco)}</td>
          <td class="num bold">${formatCurrency(qtd * preco)}</td>
        </tr>
      `;
    }).join('');

    const includedSitesHtml = (isMultiSite && includedSites.length > 0) ? `
      <div class="sites-included">
        <p class="sites-included-title">Sites incluídos na medição:</p>
        <p class="sites-included-list">${includedSites.join(" | ")}</p>
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Medição - ${detailMedicao.numero_medicao || detailMedicao.id}</title>
  <style>
    :root { --primary: #1e3a5f; --accent: #10b981; --muted: #64748b; --border: #e2e8f0; --bg-soft: #f8fafc; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; background: #e5e7eb; font-size: 12px; line-height: 1.5; }
    .page { background: white; width: 210mm; min-height: 297mm; padding: 18mm 16mm; margin: 16px auto; box-shadow: 0 0 12px rgba(0,0,0,0.12); }
    .doc-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid var(--primary); padding-bottom: 12px; margin-bottom: 18px; gap: 16px; }
    .doc-header-left { display: flex; gap: 16px; align-items: center; }
    .doc-header-right { text-align: right; display: flex; gap: 16px; align-items: flex-end; }
    .doc-header img { max-height: 60px; max-width: 180px; object-fit: contain; }
    .doc-title { font-size: 18px; font-weight: 700; margin: 0 0 4px 0; color: #0f172a; }
    .doc-subtitle { font-size: 12px; color: var(--muted); margin: 0; }
    .doc-num { font-size: 14px; font-weight: 700; margin: 0 0 4px 0; color: #0f172a; }
    .doc-date { font-size: 11px; color: var(--muted); margin: 0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 16px; font-size: 12px; }
    .info-item .label { color: var(--muted); margin-right: 4px; }
    .info-item .value { font-weight: 600; }
    .sites-included { background: var(--bg-soft); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 4px; padding: 10px 14px; margin-bottom: 14px; }
    .sites-included-title { font-weight: 600; margin: 0 0 4px 0; font-size: 12px; }
    .sites-included-list { margin: 0; color: var(--muted); font-size: 11px; }
    h2.sec { font-size: 13px; margin: 22px 0 10px; padding: 8px 14px; background: #f1f5f9; border-left: 4px solid var(--primary); color: var(--primary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; page-break-after: avoid; break-after: avoid; }
    table.main { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
    table.main th { text-align: left; padding: 9px 10px; background: var(--primary); color: #fff; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid var(--primary); }
    table.main td { padding: 7px 10px; border: 1px solid var(--border); color: #334155; vertical-align: middle; }
    table.main tbody tr:nth-child(even) { background: var(--bg-soft); }
    table.main tfoot td { background: #f1f5f9; font-weight: 700; color: var(--primary); border-top: 2px solid var(--primary); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .bold { font-weight: 700; }
    .obs-box { padding: 12px 16px; background: var(--bg-soft); border: 1px solid var(--border); border-top: 3px solid var(--accent); border-radius: 4px; white-space: pre-wrap; margin-bottom: 16px; font-size: 12px; }
    .site-block { margin-top: 24px; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; page-break-inside: auto; }
    .site-header { background: var(--primary); color: #fff; padding: 10px 16px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .site-production { padding: 12px 14px; border-bottom: 1px solid var(--border); background: #fafbfc; }
    .site-production-title { font-size: 11px; font-weight: 700; margin: 0 0 6px 0; color: var(--primary); }
    table.site-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    table.site-table th { text-align: left; padding: 6px 8px; background: #e2e8f0; color: #334155; font-weight: 600; border: 1px solid #cbd5e1; }
    table.site-table td { padding: 5px 8px; border: 1px solid var(--border); }
    .site-total-bar { margin-top: 8px; text-align: right; font-size: 11px; padding: 6px 10px; background: #fff; border: 1px solid var(--border); border-radius: 4px; display: inline-block; float: right; }
    .site-obs { padding: 10px 14px; background: #fffbeb; border-bottom: 1px solid var(--border); }
    .site-obs-title { font-size: 11px; font-weight: 700; margin: 0 0 4px 0; }
    .site-obs-text { font-size: 11px; margin: 0 0 4px 0; color: #475569; }
    .class-group { padding: 10px 14px 14px; }
    .class-header { font-size: 12px; font-weight: 700; color: #065f46; background: #d1fae5; border-left: 4px solid #059669; padding: 6px 12px; margin: 10px 0 8px; border-radius: 0 4px 4px 0; }
    .item-group { margin-top: 18px; }
    .item-group-header { font-size: 12px; font-weight: 700; color: var(--primary); background: #f1f5f9; border-left: 4px solid var(--primary); padding: 6px 12px; margin: 10px 0 8px; border-radius: 0 4px 4px 0; }
    .photo-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .photo-card { border: 1px solid var(--border); border-radius: 4px; overflow: hidden; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.05); page-break-inside: avoid; break-inside: avoid; display: flex; flex-direction: column; min-height: 220px; }
    .photo-img-wrap { width: 100%; aspect-ratio: 4/3; background: #f8fafc; display: flex; align-items: center; justify-content: center; overflow: hidden; border-bottom: 1px solid #f1f5f9; }
    .photo-img-wrap img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .photo-info { padding: 8px 10px; flex: 1; display: flex; flex-direction: column; background: #fdfdfd; }
    .photo-title { font-size: 10px; font-weight: 700; margin: 0 0 4px 0; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .photo-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: auto; padding-top: 4px; font-size: 9px; }
    .photo-site { color: var(--muted); }
    .photo-date { color: var(--muted); }
    .photo-legenda { font-size: 9px; font-style: italic; color: var(--muted); margin: 4px 0 0 0; line-height: 1.2; }
    .badge { padding: 2px 6px; border-radius: 99px; color: #fff; font-weight: 700; font-size: 8px; text-transform: uppercase; }
    .err-msg { padding: 12px; font-size: 10px; color: #991b1b; text-align: center; }
    .non-image-file { display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 11px; }
    .non-image-file a { color: var(--primary); text-decoration: none; font-weight: 600; border: 1px solid var(--primary); padding: 4px 8px; border-radius: 4px; }
    @media print { body { background: none; } .page { margin: 0; box-shadow: none; width: 100%; } }
  </style>
</head>
<body>
  <div class="page">
    <header class="doc-header">
      <div class="doc-header-left">
        ${forZip ? (finalEmpresaLogoUrl ? `<img src=\"logos/logo_empresa.png\" alt=\"Empresa\">` : '') : (base64EmpresaLogo || finalEmpresaLogoUrl ? `<img src=\"${base64EmpresaLogo || finalEmpresaLogoUrl}\" alt=\"Empresa\">` : '')}
        <div>
          <h1 class="doc-title">Relatório de Medição</h1>
          <p class="doc-subtitle">${detailMedicao.projeto_nome || ''}</p>
        </div>
      </div>
      <div class="doc-header-right">
        <div>
          <p class="doc-num">Nº ${detailMedicao.numero_medicao || detailMedicao.id}</p>
          <p class="doc-date">Data: ${detailMedicao.data_medicao ? formatDate(detailMedicao.data_medicao) : ''}</p>
        </div>
        ${forZip ? (finalClienteLogoUrl ? `<img src=\"logos/logo_cliente.png\" alt=\"Cliente\">` : '') : (base64ClienteLogo || finalClienteLogoUrl ? `<img src=\"${base64ClienteLogo || finalClienteLogoUrl}\" alt=\"Cliente\">` : '')}
      </div>
    </header>

    <div class="info-grid">
      <div class="info-item"><span class="label">Site:</span> <span class="value">${detailMedicao.site_codigo} - ${detailMedicao.site_nome}</span></div>
      <div class="info-item"><span class="label">UF:</span> <span class="value">${detailMedicao.uf}</span></div>
      <div class="info-item"><span class="label">Projeto:</span> <span class="value">${detailMedicao.projeto_codigo} - ${detailMedicao.projeto_nome}</span></div>
      <div class="info-item"><span class="label">Período:</span> <span class="value">${detailMedicao.periodo_inicio ? formatDate(detailMedicao.periodo_inicio) : ''} até ${detailMedicao.periodo_fim ? formatDate(detailMedicao.periodo_fim) : ''}</span></div>
    </div>

    ${includedSitesHtml}

    <h2 class="sec">📝 Resumo da Produção</h2>
    <table class="main">
      <thead>
        <tr>
          <th>Item / Descrição</th>
          <th>Unid.</th>
          <th class="num">Qtd.</th>
          <th class="num">Preço Unit.</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsTableRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" class="num bold">VALOR TOTAL DA MEDIÇÃO:</td>
          <td class="num bold">${formatCurrency(detailMedicao.total_valor)}</td>
        </tr>
      </tfoot>
    </table>

    ${detailMedicao.observacao_acompanhamento ? `
      <h2 class="sec">📋 Observações Gerais</h2>
      <div class="obs-box">${detailMedicao.observacao_acompanhamento}</div>
    ` : ''}
  </div>

  ${diarioFotos.length > 0 ? `
    <div class="page">
      <h2 class="sec">📷 Relatório Fotográfico (${diarioFotos.length} fotos)</h2>
      ${isMultiSite ? buildSiteBlocksHtml() : buildPhotosByItemHtml()}
    </div>
  ` : ''}
</body>
</html>`;
  }, [diarioFotos, detailMedicao, isMultiSite, fotosBySiteAndClass, productionBySite, getSiteItemsTotal, observacoesBySite, formatDate, formatCurrency, classLabel, sanitize, includedSites, fotosByItem, detailLancamentos, finalEmpresaLogoUrl, finalClienteLogoUrl]);
  return (
    <div className="space-y-4">
      {/* Progress and Logs UI */}
      {showLogPanel && (
        <Card className="border-primary/20 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-primary" />
              Progresso da Exportação
            </CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => setShowLogPanel(false)}
              disabled={isExporting}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span>{isExporting ? "Processando..." : "Concluído"}</span>
                <span className="font-bold">{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} className="h-2" />
            </div>
            
            <ScrollArea className="h-32 rounded-md border bg-muted/30 p-2">
              <div className="space-y-1.5">
                {exportLogs.map((log, i) => (
                  <div key={i} className="text-[10px] flex items-start gap-2 border-b border-muted/50 pb-1 last:border-0">
                    <span className="text-muted-foreground shrink-0">{log.timestamp}</span>
                    <span className={`flex items-center gap-1 ${
                      log.type === 'error' ? 'text-destructive' : 
                      log.type === 'success' ? 'text-green-600' : 'text-foreground'
                    }`}>
                      {log.type === 'error' && <AlertCircle className="h-2.5 w-2.5" />}
                      {log.type === 'success' && <CheckCircle2 className="h-2.5 w-2.5" />}
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            {downloadUrl && (
              <div className="pt-2 border-t border-primary/20 animate-in fade-in zoom-in duration-300">
                <Button 
                  asChild 
                  className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-11"
                >
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-5 w-5" />
                    BAIXAR PDF DA MEDIÇÃO
                  </a>
                </Button>
                <p className="text-[10px] text-center text-muted-foreground mt-2">
                  Se o download não iniciou automaticamente, clique no botão acima.
                </p>
              </div>
            )}
            
            {hasCheckpoint && !isExporting && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 mb-2">
                  <RotateCcw className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Exportação interrompida</span>
                </div>
                <p className="text-xs text-yellow-700 mb-3">
                  Deseja retomar a geração do PDF a partir da seção {hasCheckpoint.lastIndex + 1}?
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                    onClick={() => handleExportPdf(true)}
                  >
                    Retomar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => {
                      setHasCheckpoint(null);
                      void clearPDFChunks(detailMedicao.id);
                      void clearPartialPDFs(detailMedicao.id);
                      void clearExportState(detailMedicao.id);
                    }}
                  >
                    Recomeçar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isExporting}>
              <Settings2 className="h-4 w-4 mr-2" />
              Qualidade: {pdfQuality === 'high' ? 'Alta' : pdfQuality === 'medium' ? 'Média' : 'Econômica'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Configurações de Exportação</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs">Modo Depuração</span>
                <input 
                  type="checkbox" 
                  checked={debugMode} 
                  onChange={(e) => setDebugMode(e.target.checked)}
                  className="h-3 w-3"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Reduzir Tamanho (ZIP)</span>
                <input 
                  type="checkbox" 
                  checked={reducedSize} 
                  onChange={(e) => setReducedSize(e.target.checked)}
                  className="h-3 w-3"
                />
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Qualidade do PDF</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={pdfQuality} onValueChange={(v) => setPdfQuality(v as PDFQuality)}>
              <DropdownMenuRadioItem value="high">Alta (Arquivos maiores)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="medium">Média (Recomendado)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="eco">Econômica (Rápido)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          onClick={() => handleExportZip()} 
          variant="outline" 
          size="sm" 
          disabled={isExporting} 
          className="bg-green-600 text-white hover:bg-green-700 hover:text-white font-bold"
        >
          {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Archive className="h-4 w-4 mr-2" />}
          {isExporting ? "Gerando Relatório..." : "Gerar Relatório (ZIP/PDF)"}
        </Button>

        <Button 
          onClick={() => {
            const htmlContent = generateHtmlReport();
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Relatorio_Online_${detailMedicao.numero_medicao || detailMedicao.id}.html`;
            a.click();
            URL.revokeObjectURL(url);
            addLog("Relatório HTML Online (leve) gerado. As imagens serão carregadas via internet ao abrir o arquivo.", "success");
          }} 
          variant="outline" 
          size="sm" 
          disabled={isExporting} 
          className="border-blue-600 text-blue-600 hover:bg-blue-50"
        >
          <ScrollText className="h-4 w-4 mr-2" />
          HTML Online
        </Button>

        <Button 
          onClick={() => handleExportPdf(false)} 
          variant="ghost" 
          size="sm" 
          disabled={isExporting} 
          className="text-muted-foreground hover:text-primary"
        >
          {isExporting ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <FileText className="h-3 w-3 mr-2" />}
          {isExporting ? "Processando..." : "PDF Direto (Legado)"}
        </Button>
      </div>


      {/* Printable content */}
      <div ref={printRef} className="print-container">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            .print-container { padding: 0 !important; margin: 0 !important; width: 100% !important; background: white !important; }
            .pdf-header-logo { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; background-color: transparent !important; }
            .bg-muted\\/20, .bg-muted\\/40, .bg-muted\\/10, .bg-card, .bg-primary, .bg-green-600 { 
              print-color-adjust: exact !important; 
              -webkit-print-color-adjust: exact !important; 
            }
            .badge-execucao, .badge { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
            table th { background-color: #1e3a8a !important; color: white !important; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
            .site-header { background-color: #1e3a8a !important; color: white !important; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          }
          .print-container {
            max-width: 1120px;
            margin: 0 auto;
            background: white;
            padding: 20px;
          }
          .pdf-keep-together { page-break-inside: avoid; break-inside: avoid; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .photo-grid-row { 
            display: grid !important; 
            grid-template-columns: repeat(3, 1fr) !important; 
            gap: 16px !important; 
            width: 100% !important;
            margin-bottom: 16px !important;
          }
        `}} />
        <div
          className="pdf-keep-together"
          data-pdf-section="medicao-resumo"
          style={{ pageBreakInside: "avoid", breakInside: "avoid", printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
        >
          {/* Header */}
          <div className="header pdf-header-logo" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #2563eb", paddingBottom: 12, marginBottom: 16, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
            <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
              {(() => {
                const logoToUse = base64EmpresaLogo || finalEmpresaLogoUrl;
                const hasValidEmpresaLogo = !!logoToUse;
                
                return hasValidEmpresaLogo ? (
                <img 
                  src={logoToUse!} 
                  alt="Logo Empresa" 
                  style={{ maxHeight: 60, maxWidth: 180, objectFit: "contain" }} 
                  crossOrigin="anonymous"
                  data-retry-count="0"
                  onLoad={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'block';
                  }}
                  onError={(e) => { 
                    const target = e.currentTarget;
                    const maxRetries = 3;
                    const currentRetry = parseInt(target.dataset.retryCount || "0");
                    
                    if (currentRetry < maxRetries && !logoToUse!.startsWith('data:')) {
                      const nextRetry = currentRetry + 1;
                      target.dataset.retryCount = nextRetry.toString();
                      
                      if (nextRetry === 1) {
                        target.removeAttribute('crossorigin');
                      }
                      
                      const baseSrc = logoToUse!.split('?')[0];
                      const sep = baseSrc.includes('?') ? '&' : '?';
                      
                      setTimeout(() => {
                        target.src = `${baseSrc}${sep}t=${Date.now()}&retry=${nextRetry}`;
                      }, 500);
                      return;
                    }

                    if (target.dataset.errorHandled) return;
                    target.dataset.errorHandled = "true";
                    
                    target.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.style.cssText = 'width:140px;height:50px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;font-weight:bold;border:1px dashed #cbd5e1;border-radius:4px;';
                    fallback.innerText = 'LOGO INDISPONÍVEL';
                    target.parentNode?.insertBefore(fallback, target);
                    addLog(`Falha definitiva ao carregar logo da empresa.`, "error");
                  }} 
                />
              ) : (
                <div style={{ width: '140px', height: '50px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', border: '1px dashed #cbd5e1', borderRadius: '4px' }}>
                  LOGO DA EMPRESA
                </div>
              );
              })()}
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px 0", color: "#0f172a", lineHeight: '1.6' }}>Relatório de Medição</h1>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: '1.6', paddingBottom: '4px' }}>
                  {detailMedicao.projeto_codigo} — {detailMedicao.projeto_nome}
                </p>
              </div>
            </div>
            <div style={{ textAlign: "right", display: "flex", gap: "15px", alignItems: "flex-end" }}>
              <div>
                {detailMedicao.numero_medicao && (
                   <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 6px 0", color: "#0f172a", lineHeight: '1.6' }}>Medição Nº {detailMedicao.numero_medicao}</p>
                )}
                <p style={{ fontSize: 11, color: "#64748b", margin: 0, lineHeight: '1.6' }}>Emissão: {formatDate(detailMedicao.data_medicao)}</p>
              </div>
              {(() => {
                const logoToUse = base64ClienteLogo || finalClienteLogoUrl;
                if (!logoToUse) return null;
                
                return (
                <img 
                  src={logoToUse} 
                  alt="Logo Cliente" 
                  style={{ maxHeight: 54, maxWidth: 180, objectFit: "contain", marginLeft: "15px" }} 
                  crossOrigin="anonymous" 
                  data-retry-count="0"
                  onError={(e) => { 
                    const target = e.currentTarget;
                    const maxRetries = 3;
                    const currentRetry = parseInt(target.dataset.retryCount || "0");
                    
                    if (currentRetry < maxRetries && !logoToUse.startsWith('data:')) {
                      const nextRetry = currentRetry + 1;
                      target.dataset.retryCount = nextRetry.toString();
                      const sep = logoToUse.includes('?') ? '&' : '?';
                      
                      addLog(`Tentativa ${nextRetry}/${maxRetries} de carregar logo do cliente...`, "info");
                      
                      if (nextRetry >= 2) {
                        target.removeAttribute('crossorigin');
                      }
                      
                      setTimeout(() => {
                        target.src = `${logoToUse}${sep}retry=${nextRetry}`;
                      }, 800);
                      return;
                    }

                    if (target.dataset.errorHandled) return;
                    target.dataset.errorHandled = "true";
                    target.style.display = 'none'; 
                    addLog(`Falha definitiva ao carregar logo do cliente após ${maxRetries} tentativas.`, "error");
                  }}
                />
              );
              })()}
            </div>
          </div>

          {/* Sites header for agrupada/mista */}
          {isMultiSite && includedSites.length > 0 && (
            <div className="p-3 rounded-md bg-muted/40 border text-sm mb-4">
              <p className="font-semibold mb-1">Sites incluídos na medição:</p>
              <p className="text-muted-foreground">{includedSites.join(" | ")}</p>
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            {!isMultiSite && (
              <>
                <div className="flex items-center gap-1.5 py-0.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Site:</span> {detailMedicao.site_codigo} — {detailMedicao.site_nome}
                </div>
                <div className="flex items-center gap-1.5 py-0.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Município/UF:</span> {site?.municipio || "—"}/{detailMedicao.uf || "—"}
                </div>
              </>
            )}
            <div className="flex items-center gap-1.5 py-1">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground" style={{ lineHeight: '1.6' }}>Período:</span>{" "}
              <span style={{ display: 'inline-block', lineHeight: '1.6' }}>
                {detailMedicao.periodo_inicio && detailMedicao.periodo_fim
                  ? `${formatDate(detailMedicao.periodo_inicio)} a ${formatDate(detailMedicao.periodo_fim)}`
                  : formatDate(detailMedicao.data_medicao)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Valor Total:</span>{" "}
              <span className="font-semibold">{formatCurrency(totalValor)}</span>
            </div>
            {detailMedicao.numero_po && (
              <div><span className="text-muted-foreground">Nº PO:</span> {detailMedicao.numero_po}</div>
            )}
          </div>

          {/* Observations */}
          {detailMedicao.observacao_acompanhamento && (
            <div className="mb-4">
              <h2 className="pdf-section-heading" style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, lineHeight: '1.6' }}>Observações</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line" style={{ lineHeight: '1.6', paddingBottom: '4px' }}>{detailMedicao.observacao_acompanhamento}</p>
            </div>
          )}
        </div>

        <div
          className="pdf-keep-together"
          data-pdf-section="itens-medicao"
          style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
        >
          <Separator className="my-3" />

          {/* Consolidated Items table */}
          <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Itens da Medição</h2>
          <Table style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
            <TableHeader>
              <TableRow>
                <TableHead>Item LPU</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Qtd Total</TableHead>
                <TableHead className="text-right">Preço Unit.</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailLancamentos.map(l => (
                <TableRow key={l.id}>
                  <TableCell>{l.item_lpu?.codigo} - {l.item_lpu?.descricao}</TableCell>
                  <TableCell>{l.item_lpu?.unidade}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(l.quantidade).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(Number(l.item_lpu?.preco_unitario || 0))}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(Number(l.quantidade) * Number(l.item_lpu?.preco_unitario || 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-bold">Total:</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totalValor)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* Photo Report */}
        {(diarioFotos.length > 0 || loadingFotos) && (
          <>
            <div
              className="pdf-keep-together"
              data-pdf-section="relatorio-fotografico-cabecalho"
              style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
            >
              <Separator className="my-4" />
              <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, paddingBottom: 4, display: 'flex', alignItems: 'center', gap: '8px', minHeight: '24px' }} className="pdf-section-heading">
                <Camera className="h-4 w-4" />
                <span style={{ lineHeight: '1.6' }}>Relatório Fotográfico ({diarioFotos.length} fotos)</span>
                {(tipoMedicao === "mista" || tipoMedicao === "separada") && isMultiSite && (
                  <Badge variant="outline" className="text-xs ml-2">Agrupado por site</Badge>
                )}
              </h2>
            </div>

            {loadingFotos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tipoMedicao === "mista" ? (
              /* MISTA: Photos grouped by site with per-site production table */
              <div className="space-y-6">
                {fotosBySiteAndClass.map(({ siteName, siteId, classes }) => {
                  const siteItems = productionBySite.get(siteId) || [];
                  const siteTotal = getSiteItemsTotal(siteItems);

                  const siteSummary = (
                    <div
                      className="pdf-keep-together"
                      style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                    >
                      <div className="px-4 py-3 font-semibold text-sm flex items-center gap-2 text-white" style={{ backgroundColor: "hsl(var(--primary))", lineHeight: '1.4', minHeight: '32px' }}>
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span style={{ lineHeight: '1.4', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{siteName}</span>
                      </div>

                      {siteItems.length > 0 && (
                        <div className="p-3 border-b bg-muted/20">
                          <p className="text-xs font-semibold mb-2 py-1" style={{ lineHeight: '1.6' }}>Produção do Site:</p>
                          <Table style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Item</TableHead>
                                <TableHead className="text-xs text-right">Qtd</TableHead>
                                <TableHead className="text-xs text-right">Valor</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {siteItems.map(si => (
                                <TableRow key={si.item_codigo}>
                                  <TableCell className="text-xs py-1.5" style={{ lineHeight: '1.3' }}>{si.item_codigo} — {si.item_descricao}</TableCell>
                                  <TableCell className="text-xs text-right py-1.5">{si.quantidade.toLocaleString("pt-BR")} {si.unidade}</TableCell>
                                  <TableCell className="text-xs text-right py-1.5">{formatCurrency(si.quantidade * si.preco_unitario)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>

                          <div className="mt-3 flex justify-end">
                            <div className="rounded-md border bg-background px-3 py-1.5 text-xs font-semibold text-foreground" style={{ lineHeight: '1.4' }}>
                              Total do site: {formatCurrency(siteTotal)}
                            </div>
                          </div>
                        </div>
                      )}

                      {(observacoesBySite instanceof Map ? observacoesBySite.get(siteId) : [])?.length > 0 && (
                        <div className="p-3 border-t bg-muted/10" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                          <p className="text-xs font-semibold mb-1 flex items-center gap-1 py-0.5" style={{ lineHeight: '1.4' }}>📋 Observações</p>
                          {(observacoesBySite instanceof Map ? observacoesBySite.get(siteId) : [])!.map((obs, idx) => (
                            <p key={idx} className="text-xs text-muted-foreground whitespace-pre-line mb-1" style={{ lineHeight: '1.4' }}>{obs}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  );

                  return (
                    <div
                      key={siteName}
                      className="border rounded-lg overflow-hidden bg-card"
                    >
                      {/* Header for the site */}
                      <div data-pdf-section="site-medicao-intro">
                        {siteSummary}
                      </div>

                      {/* Photo groups by classification */}
                      <div className="divide-y">
                        {classes.map(([className, fotos]) => {
                          const photoGroups = chunkArray(fotos, 3);
                          return (
                            <div key={className} className="p-3 space-y-4">
                              <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-l-4 border-primary pl-3 mb-3">
                                {className}
                              </h3>
                              {photoGroups.map((group, pi) => (
                                <div
                                  key={`${className}-${pi}`}
                                  data-pdf-section="site-medicao-foto-row"
                                  className="photo-grid-row"
                                  style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                                >
                                  {group.map((foto) => renderPhotoCard(foto))}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* SEPARADA / AGRUPADA: Photos grouped by item */
              <div className="space-y-8">
                {Array.from(fotosByItem.byItem.entries()).map(([itemLabel, itemFotos]) => {
                  const itemGroups = chunkArray(itemFotos, 3);

                  return (
                    <div key={itemLabel} className="space-y-4">
                      {itemGroups.map((group, pi) => (
                        <div
                          key={`${itemLabel}-${pi}`}
                          data-pdf-section={pi === 0 ? "grupo-fotos-item" : "grupo-fotos-item-row"}
                          className="space-y-4"
                          style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                        >
                          {pi === 0 && (
                            <h3 className="pdf-section-heading text-base font-bold text-primary border-b pb-2 mb-4">
                              {itemLabel}
                            </h3>
                          )}
                          <div className="photo-grid-row" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            {group.map((foto) => renderPhotoCard(foto))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {fotosByItem.gerais.length > 0 && (
                  <div className="space-y-6">
                    {chunkArray(fotosByItem.gerais, 3).map((group, pi) => (
                      <div
                        key={`gerais-${pi}`}
                        data-pdf-section={pi === 0 ? "grupo-fotos-gerais" : "grupo-fotos-gerais-row"}
                        className="space-y-4"
                        style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                      >
                        {pi === 0 && (
                          <h3 className="pdf-section-heading text-base font-bold text-muted-foreground border-b pb-2 mb-4">
                            Fotos Gerais
                          </h3>
                        )}
                        <div className="photo-grid-row" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          {group.map((foto) => renderPhotoCard(foto, { showItem: false, showSiteName: true }))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* PDF Preview Modal/Overlay */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
              <div>
                <CardTitle className="text-lg">Pré-visualização do Relatório</CardTitle>
                <p className="text-xs text-muted-foreground">Verifique o Auto-fit e a paginação antes de baixar.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewUrl(null)}>
                  <X className="h-4 w-4 mr-1" /> Fechar
                </Button>
                <Button size="sm" asChild>
                  <a href={previewUrl} download={`Medicao_${detailMedicao.numero_medicao || 'Relatorio'}.pdf`}>
                    <Download className="h-4 w-4 mr-1" /> Baixar Agora
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden bg-muted/30">
              <iframe 
                src={previewUrl} 
                className="w-full h-full border-none" 
                title="PDF Preview"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logs Panel */}
      {showLogPanel && (
        <Card className="mt-8 border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm font-medium">Log de Processamento</CardTitle>
            </div>
            {isExporting ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground animate-pulse">
                  Processando... {exportProgress}%
                </span>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowLogPanel(false)} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Progress value={exportProgress} className="mb-4 h-2" />
            
            <ScrollArea className="h-48 rounded-md border bg-background p-2">
              <div className="space-y-1">
                {exportLogs.map((log, i) => (
                  <div key={i} className={`text-[10px] font-mono leading-tight flex gap-2 ${
                    log.type === 'error' ? 'text-red-500' : 
                    log.type === 'success' ? 'text-green-600' : 
                    log.type === 'debug' ? 'text-blue-500 italic' :
                    'text-muted-foreground'
                  }`}>
                    <span className="shrink-0 opacity-50">[{log.timestamp}]</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
