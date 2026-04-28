import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { FileText, Camera, MapPin, Calendar, Loader2 } from "lucide-react";
import { useRef, useState, useMemo, useCallback } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";

function chunkPairs<T>(arr: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    result.push(arr.slice(i, i + 2));
  }
  return result;
}
import { getPdfOptions } from "@/lib/pdfTemplates";

const PDF_EXPORT_MIN_WIDTH = 1024;

const waitForNextPaint = async () => {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
};

const waitForPdfAssets = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll("img"));

  await Promise.all(
    images.map((img) => {
      if (img.complete) {
        return img.decode?.().catch(() => undefined) ?? Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    }),
  );

  await document.fonts.ready.catch(() => undefined);
  await waitForNextPaint();
};

const createPdfExportContainer = (source: HTMLElement) => {
  const content = source.cloneNode(true) as HTMLDivElement;
  const container = document.createElement("div");
  const contentWidth = Math.max(Math.ceil(source.scrollWidth), PDF_EXPORT_MIN_WIDTH);

  container.setAttribute("data-pdf-export", "medicao-detalhe");
  Object.assign(container.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${contentWidth}px`,
    padding: "24px",
    background: "#ffffff",
    overflow: "visible",
    pointerEvents: "none",
    boxSizing: "border-box",
  });

  content.style.width = "100%";
  content.style.maxWidth = "none";
  content.style.overflow = "visible";

  content.querySelectorAll("img").forEach((img) => {
    img.loading = "eager";
    img.decoding = "sync";
  });

  container.appendChild(content);
  document.body.appendChild(container);

  return { container, content, contentWidth };
};

/**
 * Collect safe break-point positions (top edges of data-pdf-section elements).
 * These are Y positions in the content where it's safe to start a new page.
 */
const collectSafeBreakPoints = (content: HTMLElement): number[] => {
  const contentRect = content.getBoundingClientRect();
  const sections = Array.from(content.querySelectorAll<HTMLElement>("[data-pdf-section]"))
    .filter((el) => !el.parentElement?.closest("[data-pdf-section]"));

  const breakPoints: number[] = [];
  for (const el of sections) {
    const rect = el.getBoundingClientRect();
    const top = Math.max(0, Math.floor(rect.top - contentRect.top));
    if (top > 0) breakPoints.push(top);
  }

  return [...new Set(breakPoints)].sort((a, b) => a - b);
};

/**
 * Build page slices from the full content height using safe break points.
 * Each slice = { start, height } representing a vertical strip of the content.
 */
const buildPageSlices = (
  totalHeight: number,
  pageHeightPx: number,
  safeBreaks: number[],
): { start: number; height: number }[] => {
  const slices: { start: number; height: number }[] = [];
  let cursor = 0;

  while (cursor < totalHeight) {
    const remaining = totalHeight - cursor;

    // If remaining content fits in one page, take it all
    if (remaining <= pageHeightPx) {
      slices.push({ start: cursor, height: remaining });
      break;
    }

    // Find the last safe break point that fits within this page
    const pageEnd = cursor + pageHeightPx;
    let bestBreak = -1;

    for (const bp of safeBreaks) {
      if (bp <= cursor) continue; // already past
      if (bp > pageEnd) break; // beyond this page
      bestBreak = bp;
    }

    // Use the best break point, or fall back to full page height
    // Require at least 80px of content to avoid tiny slivers
    if (bestBreak > cursor + 80) {
      slices.push({ start: cursor, height: bestBreak - cursor });
      cursor = bestBreak;
    } else {
      // No safe break found - take full page height
      slices.push({ start: cursor, height: pageHeightPx });
      cursor += pageHeightPx;
    }
  }

  return slices;
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

      // Improved query to handle large amounts of photos if necessary
      const { data: fotos, error: fErr } = await supabase
        .from("diario_fotos")
        .select("*")
        .in("diario_id", diarioIds)
        .order('created_at', { ascending: true }); // Ensure consistent order
      if (fErr) return [];

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
      <div key={foto.id} className="border rounded-lg overflow-hidden shadow-sm bg-card h-full flex flex-col" data-pdf-element="photo">
        <div className="aspect-[4/3] bg-muted/15 p-2 flex items-center justify-center overflow-hidden">
          <img
            src={`${foto.url}${foto.url.includes('?') ? '&' : '?'}t=${Date.now()}`}
            alt={foto.item_descricao || foto.site_nome || "foto"}
            className="h-full w-full object-contain"
            loading="eager"
            decoding="sync"
            crossOrigin="anonymous"
          />
        </div>
        <div className="p-3 bg-muted/20 space-y-1.5 flex-1">
          {options?.showItem !== false && foto.item_codigo && (
            <p className="font-semibold text-xs text-foreground break-words">
              {foto.item_codigo} — {foto.item_descricao}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            {options?.showSiteName && foto.site_nome && <span>{foto.site_nome}</span>}
            {foto.municipio && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" />
                {foto.municipio}
              </span>
            )}
            {foto.diario_data && (
              <span className="flex items-center gap-0.5">
                <Calendar className="h-2.5 w-2.5" />
                {formatDate(foto.diario_data)}
              </span>
            )}
          </div>

          <Badge className="text-[9px] text-white w-fit" style={{ backgroundColor: classColor(foto.classificacao) }}>
            {classLabel(foto.classificacao)}
          </Badge>

          {foto.legenda && (
            <p className="text-[10px] text-muted-foreground italic leading-relaxed break-words">“{foto.legenda}”</p>
          )}
        </div>
      </div>
    ),
    [formatDate],
  );

  const handleExportPdf = async () => {
    if (!printRef.current || isExporting) return;

    setIsExporting(true);
    let exportContainer: HTMLDivElement | null = null;

    try {
      const { container, content, contentWidth } = createPdfExportContainer(printRef.current);
      exportContainer = container;

      // Ensure all images are loaded
      await waitForPdfAssets(content);
      
      // Critical: Extra delay to ensure layout stability and font rendering
      await new Promise(resolve => setTimeout(resolve, 1500));

      const filename = `Medicao_${detailMedicao.numero_medicao || detailMedicao.site_codigo}.pdf`;
      const baseOptions = getPdfOptions(filename);
      const [marginTop, marginLeft, marginBottom, marginRight] = baseOptions.margin as [number, number, number, number];
      
      const pdf = new jsPDF({
        orientation: (baseOptions.jsPDF?.orientation ?? "portrait") as "portrait" | "landscape",
        unit: "mm",
        format: (baseOptions.jsPDF?.format ?? "a4") as string | number[],
        compress: true
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const usableWidth = pageWidth - marginLeft - marginRight;
      const usableHeight = pageHeight - marginTop - marginBottom;
      
      // Use a fixed scale for better predictability
      const scale = 2;
      const totalHeight = content.scrollHeight;
      const pageHeightPx = Math.floor(contentWidth * (usableHeight / usableWidth));

      // 1. Render the ENTIRE content as a single large canvas
      // We use a high scale to ensure quality, but handle memory by slicing it
      const fullCanvas = await html2canvas(content, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: true, // Enable logging for debugging during dev
        width: contentWidth,
        height: totalHeight,
        windowWidth: contentWidth,
        windowHeight: totalHeight,
        onclone: (doc) => {
          // Additional safety: ensure all images in the clone have crossOrigin
          const images = doc.querySelectorAll('img');
          images.forEach(img => {
            img.setAttribute('crossOrigin', 'anonymous');
          });
        }
      });

      // 2. Collect safe break points and build page slices
      const safeBreaks = collectSafeBreakPoints(content);
      const slices = buildPageSlices(totalHeight, pageHeightPx, safeBreaks);

      // 3. Slice the single canvas into pages
      const scaledWidth = fullCanvas.width;
      const pxPerUnit = scaledWidth / contentWidth;

      for (let i = 0; i < slices.length; i++) {
        const slice = slices[i];
        const srcY = Math.round(slice.start * pxPerUnit);
        const srcH = Math.round(slice.height * pxPerUnit);

        // Create a canvas for this page slice
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = scaledWidth;
        pageCanvas.height = srcH;
        const ctx = pageCanvas.getContext("2d", { alpha: false })!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, scaledWidth, srcH);
        
        // Draw the slice from the full canvas
        ctx.drawImage(fullCanvas, 0, srcY, scaledWidth, srcH, 0, 0, scaledWidth, srcH);

        const renderedHeight = (slice.height * usableWidth) / contentWidth;

        if (i > 0) pdf.addPage();

        // Use JPEG for better compression and to avoid transparency issues
        const pageImageData = pageCanvas.toDataURL("image/jpeg", 0.85);
        
        pdf.addImage(
          pageImageData,
          "JPEG",
          marginLeft,
          marginTop,
          usableWidth,
          renderedHeight,
          undefined,
          "FAST"
        );
      }

      // Handle cover page merge if necessary
      const capaUrl = detailLancamentos[0]?.capa_url || detailMedicao.capa_url;
      if (capaUrl) {
        try {
          const measurementPdfBytes = pdf.output("arraybuffer");
          const capaResponse = await fetch(capaUrl);
          const capaBytes = await capaResponse.arrayBuffer();

          const capaPdf = await PDFDocument.load(capaBytes, { ignoreEncryption: true });
          const measurementPdf = await PDFDocument.load(measurementPdfBytes);
          const mergedPdf = await PDFDocument.create();

          const capaPages = await mergedPdf.copyPages(capaPdf, capaPdf.getPageIndices());
          capaPages.forEach(page => mergedPdf.addPage(page));

          const measurementPages = await mergedPdf.copyPages(measurementPdf, measurementPdf.getPageIndices());
          measurementPages.forEach(page => mergedPdf.addPage(page));

          const mergedBytes = await mergedPdf.save();
          const blob = new Blob([mergedBytes.buffer as ArrayBuffer], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        } catch (mergeErr) {
          console.error("Erro ao mesclar capa:", mergeErr);
          pdf.save(filename);
        }
      } else {
        pdf.save(filename);
      }
    } catch (e) {
      console.error("Erro ao exportar PDF:", e);
    } finally {
      exportContainer?.remove();
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

    // Return sorted entries
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([siteName, classMap]) => ({
        siteName,
        siteId: diarioFotos.find(f => (f.site_nome || "Sem site") === siteName)?.site_id || "",
        classes: Array.from(classMap.entries()).sort((a, b) => {
          // Priority: Vistoria then Execução
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
      {/* Action buttons */}
      <div className="flex justify-end">
        <Button onClick={handleExportPdf} variant="outline" size="sm" disabled={isExporting}>
          {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
          {isExporting ? "Gerando PDF..." : "Exportar PDF"}
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
          <div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #2563eb", paddingBottom: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
              <img 
                src={detailMedicao.logo_empresa_url || localStorage.getItem("custom_logo_url") || "/logo.png"} 
                alt="Logo Empresa" 
                style={{ maxHeight: 48, objectFit: "contain" }} 
                onError={(e) => { e.currentTarget.outerHTML = '<div style="width:120px;height:48px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;font-weight:bold;border:1px dashed #cbd5e1;border-radius:4px;">LOGO DA EMPRESA</div>'; }} 
              />
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px 0", color: "#0f172a" }}>Relatório de Medição</h1>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                  {detailMedicao.projeto_codigo} — {detailMedicao.projeto_nome}
                </p>
              </div>
            </div>
            <div style={{ textAlign: "right", display: "flex", gap: "15px", alignItems: "flex-end" }}>
              <div>
                {detailMedicao.numero_medicao && (
                  <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px 0", color: "#0f172a" }}>Medição Nº {detailMedicao.numero_medicao}</p>
                )}
                <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Emissão: {formatDate(detailMedicao.data_medicao)}</p>
              </div>
              {clienteLogoUrl && (
                <img src={clienteLogoUrl} alt="Logo Cliente" style={{ maxHeight: 48, objectFit: "contain", marginLeft: "15px" }} />
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
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Site:</span> {detailMedicao.site_codigo} — {detailMedicao.site_nome}
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Município/UF:</span> {site?.municipio || "—"}/{detailMedicao.uf || "—"}
                </div>
              </>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Período:</span>{" "}
              {detailMedicao.periodo_inicio && detailMedicao.periodo_fim
                ? `${formatDate(detailMedicao.periodo_inicio)} a ${formatDate(detailMedicao.periodo_fim)}`
                : formatDate(detailMedicao.data_medicao)}
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
              <h2 className="pdf-section-heading" style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Observações</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{detailMedicao.observacao_acompanhamento}</p>
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
              <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }} className="pdf-section-heading flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Relatório Fotográfico ({diarioFotos.length} fotos)
                {(tipoMedicao === "mista" || tipoMedicao === "separada") && isMultiSite && (
                  <Badge variant="outline" className="text-xs">Agrupado por site</Badge>
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
                      <div className="px-4 py-2 font-semibold text-sm flex items-center gap-2 text-white" style={{ backgroundColor: "hsl(var(--primary))" }}>
                        <MapPin className="h-4 w-4" />
                        {siteName}
                      </div>
                      {siteItems.length > 0 && (
                        <div className="p-3 border-b bg-muted/20">
                          <p className="text-xs font-semibold mb-2">Produção do Site:</p>
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
                                  <TableCell className="text-xs py-1">{si.item_codigo} — {si.item_descricao}</TableCell>
                                  <TableCell className="text-xs text-right py-1">{si.quantidade.toLocaleString("pt-BR")} {si.unidade}</TableCell>
                                  <TableCell className="text-xs text-right py-1">{formatCurrency(si.quantidade * si.preco_unitario)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>

                          <div className="mt-3 flex justify-end">
                            <div className="rounded-md border bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
                              Total do site: {formatCurrency(siteTotal)}
                            </div>
                          </div>
                        </div>
                      )}

                      {(observacoesBySite instanceof Map ? observacoesBySite.get(siteId) : [])?.length > 0 && (
                        <div className="p-3 border-t bg-muted/10" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                          <p className="text-xs font-semibold mb-1 flex items-center gap-1">📋 Observações</p>
                          {(observacoesBySite instanceof Map ? observacoesBySite.get(siteId) : [])!.map((obs, idx) => (
                            <p key={idx} className="text-xs text-muted-foreground whitespace-pre-line mb-1">{obs}</p>
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
                          const photoPairs = chunkPairs(fotos);
                          return (
                            <div key={className} className="p-3 space-y-3">
                              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-l-2 border-primary pl-2 mb-2">
                                {className}
                              </h3>
                              {photoPairs.map((pair, pi) => (
                                <div
                                  key={`${className}-${pi}`}
                                  data-pdf-section="site-medicao-foto-row"
                                  className="grid grid-cols-2 gap-4 items-stretch"
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
                  const itemPairs = chunkPairs(itemFotos);

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
                          <div className="grid grid-cols-2 gap-4 items-stretch" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                            {pair.map((foto) => renderPhotoCard(foto))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {fotosByItem.gerais.length > 0 && (
                  <div>
                    {chunkPairs(fotosByItem.gerais).map((pair, pi) => (
                      <div
                        key={`gerais-${pi}`}
                        data-pdf-section={pi === 0 ? "grupo-fotos-gerais" : "grupo-fotos-gerais-row"}
                        className="space-y-3"
                        style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                      >
                        {pi === 0 && <h3 className="pdf-section-heading text-sm font-semibold text-muted-foreground">Fotos Gerais</h3>}
                        <div className="foto-card grid grid-cols-2 gap-4 items-start" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
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
