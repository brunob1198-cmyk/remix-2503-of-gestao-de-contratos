import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { FileText, Camera, MapPin, Calendar, Loader2, ScrollText, AlertCircle, CheckCircle2, X, Play, RotateCcw, Settings2 } from "lucide-react";
import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { clearPDFChunks, clearExportState } from "@/lib/db";
import { 
  ensureImagesLoaded, 
  getPdfSafeImageDataUrl,
  withTimeout,
  chunkArray,
  PDFExportLog,
  PDFQuality,
  autoFitText,
  checkTextOverflow
} from "@/lib/pdfExportUtils";

import { getPdfOptions } from "@/lib/pdfTemplates";

const PDF_EXPORT_MIN_WIDTH = 1120;

const waitForNextPaint = async (ms = 100) => {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
};

const isLogoImage = (img: HTMLImageElement) => img.alt.toLowerCase().includes("logo");

const createPdfExportContainerSkeleton = () => {
  const container = document.createElement("div");
  const contentWidth = PDF_EXPORT_MIN_WIDTH;

  container.setAttribute("data-pdf-export", "medicao-detalhe");
  Object.assign(container.style, {
    position: "absolute",
    left: "-9999px",
    top: "0",
    width: `${contentWidth}px`,
    padding: "40px",
    background: "#ffffff",
    overflow: "visible",
    pointerEvents: "none",
    boxSizing: "border-box",
    zIndex: "-1000",
    opacity: "1",
    visibility: "visible",
  });

  const style = document.createElement("style");
  style.innerHTML = `
    * { 
      transition: none !important; 
      animation: none !important; 
      text-rendering: optimizeLegibility !important;
      -webkit-font-smoothing: antialiased !important;
      box-sizing: border-box !important;
    }
    body { background: white !important; }
    .pdf-section-heading, h1, h2, h3, p, span, td, th {
      letter-spacing: 0.01em !important;
      line-height: 1.5 !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    .badge-execucao {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      vertical-align: middle !important;
      line-height: 1 !important;
      height: 18px !important;
      text-align: center !important;
      padding: 0 8px !important;
      border-radius: 4px !important;
      font-size: 7px !important;
      font-weight: bold !important;
    }
    .grid { display: grid !important; }
    .grid-cols-3 { grid-template-columns: repeat(3, 1fr) !important; }
    .gap-3 { gap: 12px !important; }
    img {
      max-width: 100% !important;
      height: auto !important;
      display: block !important;
    }
    /* Prevent page break inside cards */
    [data-pdf-element="photo"] {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
  `;

  container.appendChild(style);

  const content = document.createElement("div");
  content.style.width = "100%";
  content.style.overflow = "visible";
  container.appendChild(content);

  document.body.appendChild(container);
  return { container, content, contentWidth };
};


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
  const [canResume, setCanResume] = useState(false);
  const [pdfQuality, setPdfQuality] = useState<PDFQuality>('medium');
  const [debugMode, setDebugMode] = useState(false);


  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const newLog: PDFExportLog = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setExportLogs(prev => [newLog, ...prev].slice(0, 50));
    console.log(`[PDF Export] ${message}`);
  }, []);

  useEffect(() => {
    void clearPDFChunks(detailMedicao.id);
    void clearExportState(detailMedicao.id);
    setCanResume(false);
  }, [detailMedicao.id]);

  // Update logs when exporting state changes
  useEffect(() => {
    if (isExporting) {
      setShowLogPanel(true);
    }
  }, [isExporting]);

  const site = sites.find(s => s.id === detailMedicao.site_id);
  const clienteLogoUrl = site?.clienteObj?.logo_url || site?.projeto?.clienteObj?.logo_url;

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
      <div key={foto.id} className="border rounded-lg overflow-hidden shadow-sm bg-card h-full flex flex-col" data-pdf-element="photo" style={{ minHeight: '280px' }}>
        <div className="aspect-[4/3] bg-muted/15 p-1 flex items-center justify-center overflow-hidden">
          <img
            src={`${foto.url}${foto.url.includes('?') ? '&' : '?'}width=400&quality=60&t=${Date.now()}`}
            alt={foto.item_descricao || foto.site_nome || "foto"}
            className="h-full w-full object-contain"
            loading="eager"
            decoding="sync"
            crossOrigin="anonymous"
          />
        </div>
        <div className="p-2 bg-muted/20 space-y-1 flex-1">
          {options?.showItem !== false && foto.item_codigo && (
            <p className="font-semibold text-[9px] text-foreground leading-[1.3] line-clamp-2 mb-1 py-0.5">
              {foto.item_codigo} — {foto.item_descricao}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 text-[8px] text-muted-foreground mt-auto pt-1">
            {options?.showSiteName && foto.site_nome && (
              <span className="max-w-[140px] leading-tight" title={foto.site_nome}>
                {foto.site_nome}
              </span>
            )}
            {foto.diario_data && (
              <span className="flex items-center gap-0.5 shrink-0">
                <Calendar className="h-2 w-2" />
                {formatDate(foto.diario_data)}
              </span>
            )}
            <Badge 
              className="badge-execucao text-[7px] text-white font-bold" 
              style={{ backgroundColor: classColor(foto.classificacao), border: 'none' }}
            >
              {classLabel(foto.classificacao)}
            </Badge>
          </div>

          {foto.legenda && (
            <p className="text-[8px] text-muted-foreground italic leading-tight line-clamp-2">“{foto.legenda}”</p>
          )}
        </div>
      </div>
    ),
    [formatDate],
  );

  const handleExportPdf = async () => {
    if (!printRef.current || isExporting) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportLogs([]);
    await clearPDFChunks(detailMedicao.id);
    await clearExportState(detailMedicao.id);
    setCanResume(false);
    addLog("Iniciando exportação em streaming agressivo para grandes volumes...", "info");
    
    let exportContext: { container: HTMLDivElement, content: HTMLDivElement, contentWidth: number } | null = null;

    try {
      exportContext = createPdfExportContainerSkeleton();
      const { container, content, contentWidth } = exportContext;

      const exportSettings = {
        high: { scale: 2.0, imgQuality: 0.9, canvasQuality: 0.95, maxWidth: 1200, maxHeight: 900 },
        medium: { scale: 1.5, imgQuality: 0.8, canvasQuality: 0.85, maxWidth: 800, maxHeight: 600 },
        eco: { scale: 1.2, imgQuality: 0.65, canvasQuality: 0.7, maxWidth: 640, maxHeight: 480 }
      }[pdfQuality];

      const filename = `Medicao_${detailMedicao.numero_medicao || detailMedicao.site_codigo}.pdf`;
      const baseOptions = getPdfOptions(filename);
      const [marginTop, marginLeft, marginBottom, marginRight] = baseOptions.margin as [number, number, number, number];
      
      const pageWidth = 210; 
      const pageHeight = 297; 
      const usableWidth = pageWidth - marginLeft - marginRight;
      const pageBottom = pageHeight - marginBottom;
      const sectionGap = 3;
      let currentY = marginTop;
      let hasPdfContent = false;

      // We'll create small PDF chunks and merge them to avoid giant memory usage
      const chunks: Uint8Array[] = [];
      let currentPdf: jsPDF | null = null;
      let currentPdfPages = 0;

      const createNewPdf = () => {
        return new jsPDF({
          orientation: (baseOptions.jsPDF?.orientation ?? "portrait") as "portrait" | "landscape",
          unit: "mm",
          format: (baseOptions.jsPDF?.format ?? "a4") as string | number[],
          compress: true,
        });
      };

      const finalizeChunk = async () => {
        if (currentPdf) {
          const pdfData = currentPdf.output("arraybuffer");
          chunks.push(new Uint8Array(pdfData));
          currentPdf = null;
          currentPdfPages = 0;
          // Force memory release hint if possible
          if (window.gc) try { window.gc(); } catch(e) {}
        }
      };

      const addCanvasToPdf = async (canvas: HTMLCanvasElement, forceNewPage = false) => {
        if (!currentPdf) {
          currentPdf = createNewPdf();
          currentY = marginTop;
          hasPdfContent = false;
        }

        const heightMm = (canvas.height * usableWidth) / canvas.width;

        if (forceNewPage || (hasPdfContent && currentY + heightMm > pageBottom)) {
          currentPdf.addPage();
          currentY = marginTop;
          hasPdfContent = false;
        }

        const imageData = canvas.toDataURL("image/jpeg", exportSettings.canvasQuality);
        currentPdf.addImage(imageData, "JPEG", marginLeft, currentY, usableWidth, heightMm, undefined, "FAST");
        
        currentY += heightMm + sectionGap;
        hasPdfContent = true;
        currentPdfPages++;

        // If chunk is getting large (8 captures) finalize it to keep memory low
        if (currentPdfPages >= 8) {
          await finalizeChunk();
        }

        // Memory cleanup
        canvas.width = 0;
        canvas.height = 0;
      };

      const captureAndClear = async (element: HTMLElement, forceNewPage = false) => {
        content.appendChild(element);
        autoFitText(element);
        
        if (debugMode) {
          const overflows = checkTextOverflow(element, true);
          if (overflows.length > 0) {
            addLog(`Debug: ${overflows.length} cortes de texto detectados.`, "error");
          }
        }
        
        const imgs = Array.from(element.querySelectorAll("img"));
        for (const img of imgs) {
          const src = img.getAttribute("src");
          if (src && !src.startsWith("data:")) {
            try {
              const safeSrc = await withTimeout(
                getPdfSafeImageDataUrl(src, { 
                  maxWidth: exportSettings.maxWidth, 
                  maxHeight: exportSettings.maxHeight, 
                  quality: exportSettings.imgQuality 
                }),
                15000,
                "Timeout imagem"
              );
              img.src = safeSrc;
            } catch (e) {
              console.warn("Failed to load image for PDF", e);
            }
          }
        }

        await ensureImagesLoaded(element);
        await waitForNextPaint(100);

        const canvas = await html2canvas(element, {
          scale: exportSettings.scale,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: contentWidth,
          logging: false,
        });

        await addCanvasToPdf(canvas, forceNewPage);
        content.innerHTML = ""; 
      };


      setExportProgress(5);
      addLog("Gerando seções iniciais...", "info");

      const resumoEl = printRef.current.querySelector('[data-pdf-section="medicao-resumo"]')?.cloneNode(true) as HTMLElement;
      if (resumoEl) await captureAndClear(resumoEl);

      const itensEl = printRef.current.querySelector('[data-pdf-section="itens-medicao"]')?.cloneNode(true) as HTMLElement;
      if (itensEl) await captureAndClear(itensEl);

      setExportProgress(15);
      addLog(`Processando ${diarioFotos.length} fotos em streaming agressivo...`, "info");

      const photoHeaderEl = printRef.current.querySelector('[data-pdf-section="relatorio-fotografico-cabecalho"]')?.cloneNode(true) as HTMLElement;
      if (photoHeaderEl) await captureAndClear(photoHeaderEl);

      const photoCardHtml = (f: DiarioFotoWithItem, opts?: { showSiteName?: boolean }) => `
        <div style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; background:#fff; display:flex; flex-direction:column; min-height:280px;">
          <div style="aspect-ratio:4/3; background:#f3f4f6; padding:4px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
            <img src="${f.url}" style="max-height:100%; max-width:100%; width:auto; height:auto; object-fit:contain; display:block;" />
          </div>
          <div style="padding:8px; background:#f9fafb; flex:1; display:flex; flex-direction:column; gap:4px;">
            ${f.item_codigo ? `<p style="font-size:9px; font-weight:600; color:#111827; line-height:1.3; margin:0 0 2px 0; word-break:break-word; overflow-wrap:anywhere;">${f.item_codigo} — ${f.item_descricao || ''}</p>` : ''}
            <div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:8px; color:#6b7280; margin-top:auto; padding-top:2px;">
              ${opts?.showSiteName && f.site_nome ? `<span style="max-width:140px; line-height:1.2; word-break:break-word; overflow-wrap:anywhere;">${f.site_nome}</span>` : ''}
              ${f.diario_data ? `<span style="white-space:nowrap;">${f.diario_data}</span>` : ''}
              <span style="background:${classColor(f.classificacao)}; color:#fff; font-weight:700; font-size:8px; line-height:1; padding:3px 7px; border-radius:4px; display:inline-block; vertical-align:middle;">${classLabel(f.classificacao)}</span>
            </div>
            ${f.legenda ? `<p style="font-size:8px; color:#6b7280; font-style:italic; line-height:1.2; margin:0; word-break:break-word; overflow-wrap:anywhere;">“${f.legenda}”</p>` : ''}
          </div>
        </div>
      `;

      if (tipoMedicao === "mista") {
        for (let i = 0; i < fotosBySiteAndClass.length; i++) {
          const { siteName, siteId, classes } = fotosBySiteAndClass[i];
          addLog(`Processando site: ${siteName}`, "info");

          // Build site header with production table (LPU) and observations
          const siteItems = productionBySite.get(siteId) || [];
          const siteTotal = getSiteItemsTotal(siteItems);
          const siteObs = (observacoesBySite instanceof Map ? observacoesBySite.get(siteId) : []) || [];

          const siteHeader = document.createElement("div");
          siteHeader.style.cssText = "border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; background:#fff; margin-bottom:12px;";

          const itemsRowsHtml = siteItems.map(si => `
            <tr>
              <td style="font-size:10px; padding:6px 8px; border-bottom:1px solid #f1f5f9; line-height:1.4; word-break:break-word;">${si.item_codigo} — ${si.item_descricao}</td>
              <td style="font-size:10px; padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:right; white-space:nowrap;">${si.quantidade.toLocaleString("pt-BR")} ${si.unidade}</td>
              <td style="font-size:10px; padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:right; white-space:nowrap;">${formatCurrency(si.quantidade * si.preco_unitario)}</td>
            </tr>
          `).join("");

          siteHeader.innerHTML = `
            <div style="padding:10px 16px; font-weight:600; font-size:13px; color:#fff; background-color:#1e3a5f; line-height:1.4; display:flex; align-items:center; gap:8px;">
              <span style="word-break:break-word; overflow-wrap:anywhere;">📍 ${siteName}</span>
            </div>
            ${siteItems.length > 0 ? `
              <div style="padding:12px; border-bottom:1px solid #e5e7eb; background:#f8fafc;">
                <p style="font-size:11px; font-weight:600; margin:0 0 8px 0; line-height:1.4;">Produção do Site:</p>
                <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="font-size:10px; text-align:left; padding:6px 8px; font-weight:600; width:60%;">Item</th>
                      <th style="font-size:10px; text-align:right; padding:6px 8px; font-weight:600; width:20%;">Qtd</th>
                      <th style="font-size:10px; text-align:right; padding:6px 8px; font-weight:600; width:20%;">Valor</th>
                    </tr>
                  </thead>
                  <tbody>${itemsRowsHtml}</tbody>
                </table>
                <div style="margin-top:10px; display:flex; justify-content:flex-end;">
                  <div style="border:1px solid #e5e7eb; background:#fff; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:600; line-height:1.4;">
                    Total do site: ${formatCurrency(siteTotal)}
                  </div>
                </div>
              </div>
            ` : ''}
            ${siteObs.length > 0 ? `
              <div style="padding:10px 12px; border-top:1px solid #e5e7eb; background:#fafafa;">
                <p style="font-size:11px; font-weight:600; margin:0 0 4px 0;">📋 Observações</p>
                ${siteObs.map(obs => `<p style="font-size:10px; color:#6b7280; white-space:pre-line; margin:0 0 4px 0; line-height:1.4; word-break:break-word;">${obs.replace(/</g, '&lt;')}</p>`).join("")}
              </div>
            ` : ''}
          `;
          await captureAndClear(siteHeader, true);

          for (const [className, fotos] of classes) {
            const classHeader = document.createElement("div");
            classHeader.style.cssText = "padding:6px 0 8px 8px; margin:8px 0 4px 0; border-left:3px solid #1e3a5f;";
            classHeader.innerHTML = `<h3 style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#475569; margin:0;">${className}</h3>`;
            await captureAndClear(classHeader);

            const batches = chunkArray(fotos, 3);
            for (let j = 0; j < batches.length; j++) {
              const batch = batches[j];
              const grid = document.createElement("div");
              grid.style.cssText = "display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:12px;";

              batch.forEach(f => {
                const cardWrapper = document.createElement("div");
                cardWrapper.innerHTML = photoCardHtml(f);
                grid.appendChild(cardWrapper.firstElementChild!);
              });

              await captureAndClear(grid);
              setExportProgress(15 + Math.floor(((i + (j / batches.length)) / fotosBySiteAndClass.length) * 70));
              await waitForNextPaint(120);
            }
          }
        }
      } else {
        const itemEntries = Array.from(fotosByItem.byItem.entries());
        for (let i = 0; i < itemEntries.length; i++) {
          const [itemLabel, itemFotos] = itemEntries[i];
          const itemHeader = document.createElement("h3");
          itemHeader.className = "text-sm font-semibold text-primary mb-4 mt-6";
          itemHeader.innerText = itemLabel;
          await captureAndClear(itemHeader);

          const batches = chunkArray(itemFotos, 3);
          for (let j = 0; j < batches.length; j++) {
            const batch = batches[j];
            const grid = document.createElement("div");
            grid.className = "grid grid-cols-3 gap-3 mb-4";
            
            batch.forEach(f => {
              const cardWrapper = document.createElement("div");
              cardWrapper.innerHTML = `
                <div class="border rounded-lg overflow-hidden shadow-sm bg-card h-full flex flex-col" style="min-height: 280px">
                  <div class="aspect-[4/3] bg-muted/15 p-1 flex items-center justify-center overflow-hidden">
                    <img src="${f.url}" class="h-full w-full object-contain" />
                  </div>
                  <div class="p-2 bg-muted/20 space-y-1 flex-1">
                    ${f.item_codigo ? `<p class="font-semibold text-[9px] text-foreground leading-[1.3] line-clamp-2 mb-1 py-0.5">${f.item_codigo} — ${f.item_descricao}</p>` : ''}
                    <div class="flex flex-wrap items-center gap-1.5 text-[8px] text-muted-foreground mt-auto pt-1">
                      <span class="badge-execucao text-[7px] text-white font-bold" style="background-color: ${classColor(f.classificacao)}; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; height: 16px; padding: 0 6px;">${classLabel(f.classificacao)}</span>
                    </div>
                  </div>
                </div>
              `;
              grid.appendChild(cardWrapper.firstElementChild!);
            });
            await captureAndClear(grid);
            setExportProgress(15 + Math.floor(((i + (j / batches.length)) / itemEntries.length) * 70));
            await waitForNextPaint(120);
          }
        }
      }

      setExportProgress(85);
      addLog("Compilando documento final...", "info");
      const finalPdf = await PDFDocument.create();
      
      const capaUrl = detailLancamentos[0]?.capa_url || detailMedicao.capa_url;
      if (capaUrl) {
        try {
          const capaResponse = await fetch(capaUrl);
          const capaBytes = await capaResponse.arrayBuffer();
          const capaPdf = await PDFDocument.load(capaBytes, { ignoreEncryption: true });
          const copiedPages = await finalPdf.copyPages(capaPdf, capaPdf.getPageIndices());
          copiedPages.forEach(page => finalPdf.addPage(page));
        } catch (e) {
          addLog("Capa ignorada.", "error");
        }
      }

      await finalizeChunk();
      addLog(`Combinando ${chunks.length} partes...`, "info");
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkPdf = await PDFDocument.load(chunks[i]);
        const chunkPages = await finalPdf.copyPages(chunkPdf, chunkPdf.getPageIndices());
        chunkPages.forEach(page => finalPdf.addPage(page));
        // Help GC
        chunks[i] = new Uint8Array(0);
        if (i % 5 === 0) await waitForNextPaint(60);
      }

      addLog("Finalizando arquivo...", "info");
      const finalBytes = await finalPdf.save({ useObjectStreams: true, addDefaultPage: false });
      const blob = new Blob([finalBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      
      addLog("PDF gerado com sucesso!", "success");
      setExportProgress(100);
      setTimeout(() => setShowLogPanel(false), 5000);
    } catch (e) {
      addLog(`Erro: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      if (exportContext) exportContext.container.remove();
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
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button 
          variant={debugMode ? "default" : "outline"} 
          size="sm" 
          onClick={() => setDebugMode(!debugMode)}
          className={debugMode ? "bg-orange-500 hover:bg-orange-600" : ""}
          disabled={isExporting}
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Debug: {debugMode ? "ON" : "OFF"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isExporting}>
              <Settings2 className="h-4 w-4 mr-2" />
              Qualidade: {pdfQuality === 'high' ? 'Alta' : pdfQuality === 'medium' ? 'Média' : 'Econômica'}

            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Qualidade do PDF</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={pdfQuality} onValueChange={(v) => setPdfQuality(v as PDFQuality)}>
              <DropdownMenuRadioItem value="high">Alta (Arquivos maiores)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="medium">Média (Recomendado)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="eco">Econômica (Rápido)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {canResume && (
          <Button 
            onClick={() => handleExportPdf()} 
            variant="outline" 
            size="sm" 
            disabled={isExporting}
            className="text-orange-600 border-orange-200 hover:bg-orange-50"
          >
            <Play className="h-4 w-4 mr-2" />
            Retomar Exportação
          </Button>
        )}
        <Button onClick={() => handleExportPdf()} variant="outline" size="sm" disabled={isExporting} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
          {isExporting ? "Gerando PDF..." : (canResume ? "Reiniciar Exportação" : "Exportar PDF")}
        </Button>

      </div>

      {/* Printable content */}
      <div ref={printRef}>
        <div
          className="pdf-keep-together"
          data-pdf-section="medicao-resumo"
          style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
        >
          {/* Header */}
          <div className="header pdf-header-logo" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #2563eb", paddingBottom: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
              {(() => {
                const empresaLogoSrc = detailMedicao.logo_empresa_url || localStorage.getItem("custom_logo_url") || "";
                const hasValidEmpresaLogo = empresaLogoSrc && empresaLogoSrc !== "/logo.png";
                return hasValidEmpresaLogo ? (
                <img 
                  src={empresaLogoSrc} 
                  alt="Logo Empresa" 
                  style={{ maxHeight: 54, maxWidth: 180, objectFit: "contain" }} 
                  crossOrigin="anonymous"
                  data-retry-count="0"
                  onError={(e) => { 
                    const target = e.currentTarget;
                    const maxRetries = 3;
                    const currentRetry = parseInt(target.dataset.retryCount || "0");
                    
                    if (currentRetry < maxRetries) {
                      const nextRetry = currentRetry + 1;
                      target.dataset.retryCount = nextRetry.toString();
                      const sep = empresaLogoSrc.includes('?') ? '&' : '?';
                      
                      addLog(`Tentativa ${nextRetry}/${maxRetries} de carregar logo da empresa...`, "info");
                      
                      // On second retry, drop crossOrigin to bypass CORS preflight failures
                      if (nextRetry >= 2) {
                        target.removeAttribute('crossorigin');
                      }
                      
                      setTimeout(() => {
                        target.src = `${empresaLogoSrc}${sep}retry=${nextRetry}`;
                      }, 800);
                      return;
                    }

                    if (target.dataset.errorHandled) return;
                    target.dataset.errorHandled = "true";
                    target.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.style.cssText = 'width:140px;height:50px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;font-weight:bold;border:1px dashed #cbd5e1;border-radius:4px;';
                    fallback.innerText = 'LOGO INDISPONÍVEL';
                    target.parentNode?.insertBefore(fallback, target);
                    addLog(`Falha definitiva ao carregar logo da empresa após ${maxRetries} tentativas.`, "error");
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
              {clienteLogoUrl && (
                <img 
                  src={clienteLogoUrl} 
                  alt="Logo Cliente" 
                  style={{ maxHeight: 54, maxWidth: 180, objectFit: "contain", marginLeft: "15px" }} 
                  crossOrigin="anonymous" 
                  data-retry-count="0"
                  onError={(e) => { 
                    const target = e.currentTarget;
                    const maxRetries = 3;
                    const currentRetry = parseInt(target.dataset.retryCount || "0");
                    
                    if (currentRetry < maxRetries) {
                      const nextRetry = currentRetry + 1;
                      target.dataset.retryCount = nextRetry.toString();
                      const sep = clienteLogoUrl.includes('?') ? '&' : '?';
                      
                      addLog(`Tentativa ${nextRetry}/${maxRetries} de carregar logo do cliente...`, "info");
                      
                      // On second retry, drop crossOrigin to bypass CORS preflight failures
                      if (nextRetry >= 2) {
                        target.removeAttribute('crossorigin');
                      }
                      
                      setTimeout(() => {
                        target.src = `${clienteLogoUrl}${sep}retry=${nextRetry}`;
                      }, 800);
                      return;
                    }

                    if (target.dataset.errorHandled) return;
                    target.dataset.errorHandled = "true";
                    target.style.display = 'none'; 
                    addLog(`Falha definitiva ao carregar logo do cliente após ${maxRetries} tentativas.`, "error");
                  }}
                />
              )}
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
                          const photoPairs = chunkArray(fotos, 3);
                          return (
                            <div key={className} className="p-3 space-y-3">
                              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-l-2 border-primary pl-2 mb-2">
                                {className}
                              </h3>
                              {photoPairs.map((pair, pi) => (
                                <div
                                  key={`${className}-${pi}`}
                                  data-pdf-section="site-medicao-foto-row"
                                  className="grid grid-cols-3 gap-3 items-stretch"
                                  style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                                >
                                  {pair.map((foto) => renderPhotoCard(foto))}
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
              <div className="space-y-6">
                {Array.from(fotosByItem.byItem.entries()).map(([itemLabel, itemFotos]) => {
                  const itemPairs = chunkArray(itemFotos, 3);

                  return (
                    <div key={itemLabel}>
                      {itemPairs.map((pair, pi) => (
                        <div
                          key={`${itemLabel}-${pi}`}
                          data-pdf-section={pi === 0 ? "grupo-fotos-item" : "grupo-fotos-item-row"}
                          className="space-y-3"
                          style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                        >
                          {pi === 0 && <h3 className="pdf-section-heading text-sm font-semibold text-primary">{itemLabel}</h3>}
                          <div className="grid grid-cols-3 gap-3 items-stretch" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            {pair.map((foto) => renderPhotoCard(foto))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {fotosByItem.gerais.length > 0 && (
                  <div>
                    {chunkArray(fotosByItem.gerais, 3).map((pair, pi) => (

                      <div
                        key={`gerais-${pi}`}
                        data-pdf-section={pi === 0 ? "grupo-fotos-gerais" : "grupo-fotos-gerais-row"}
                        className="space-y-3"
                        style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                      >
                        {pi === 0 && <h3 className="pdf-section-heading text-sm font-semibold text-muted-foreground">Fotos Gerais</h3>}
                        <div className="foto-card grid grid-cols-3 gap-3 items-start" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          {pair.map((foto) => renderPhotoCard(foto, { showItem: false, showSiteName: true }))}
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
    </div>
  );
}
