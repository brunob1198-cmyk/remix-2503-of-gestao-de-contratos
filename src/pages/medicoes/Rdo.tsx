import { useState, useMemo, useCallback } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useSites } from "@/hooks/useSites";
import { useProjetos } from "@/hooks/useProjetos";
import { useItensLpu } from "@/hooks/useItensLpu";
import { useRdo, RdoDiarioResumo, RdoFoto } from "@/hooks/useRdo";
import { useAuth } from "@/contexts/AuthContext";
import {
  FileText, Search, Calendar, Camera, X,
  ChevronLeft, ChevronRight, MapPin, Users, Wrench, Truck,
  DollarSign, ClipboardList, Eye, Image, MessageSquare, FileDown,
  AlertTriangle, Loader2, Download, FolderArchive, Tag,
} from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import { pdfGlobalStyles, getLogoHtml, getClientLogoHtml, getPdfOptions } from "@/lib/pdfTemplates";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const classificacaoLabel: Record<string, string> = {
  antes: "Antes",
  execucao: "Execução",
  depois: "Depois",
  problema: "Problema",
};

const classificacaoBadgeClass: Record<string, string> = {
  antes: "bg-blue-100 text-blue-800",
  execucao: "bg-emerald-100 text-emerald-800",
  depois: "bg-purple-100 text-purple-800",
  problema: "bg-red-100 text-red-800",
};

const classificacaoColors: Record<string, string> = {
  antes: "#3b82f6",
  execucao: "#10b981",
  depois: "#a855f7",
  problema: "#ef4444",
};

// Generate HTML report for a single day
function gerarRelatorioDiaHtml(diario: RdoDiarioResumo, isCliente: boolean, clienteLogoUrl?: string | null, siteName?: string): string {
  const dataFormatada = format(parseISO(diario.data), "dd/MM/yyyy (EEEE)", { locale: ptBR });
  const localidade = [diario.municipio, diario.uf].filter(Boolean).join("/");
  const siteLabel = siteName || (diario.site_codigo ? `${diario.site_codigo} — ${diario.site_nome}` : undefined);

  return `
    ${pdfGlobalStyles}
    <div class="pdf-container">
      <div class="header">
        <div class="header-left">
          ${getLogoHtml()}
          <div>
            <h1 class="header-title">Relatório Diário de Obra</h1>
            <p class="header-subtitle">RDO — ${dataFormatada}</p>
          </div>
        </div>
        ${clienteLogoUrl ? `<div class="header-right" style="display:flex; align-items:flex-end;">${getClientLogoHtml(clienteLogoUrl)}</div>` : ''}
      </div>

      <div class="site-info-bar">
        ${siteLabel ? `<div class="site-info-item"><strong>Site:</strong> ${siteLabel}</div>` : ''}
        ${localidade ? `<div class="site-info-item"><strong>Localidade:</strong> ${localidade}</div>` : ''}
        <div class="site-info-item"><strong>Data:</strong> ${dataFormatada}</div>
      </div>

      ${diario.producoes.length > 0 ? `
        <h2><svg class="icon-h2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg> Produção</h2>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-right">Qtd</th>
              ${!isCliente ? '<th class="text-right">Valor</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${diario.producoes.map(p => `
              <tr>
                <td>${p.item_lpu?.codigo} — ${p.item_lpu?.descricao}</td>
                <td class="text-right">${Number(p.quantidade)} ${p.item_lpu?.unidade}</td>
                ${!isCliente ? `<td class="text-right">${formatCurrency(Number(p.valor_total))}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
          ${!isCliente ? `
          <tfoot>
            <tr>
              <td colspan="2" class="text-right">Total Produção:</td>
              <td class="text-right">${formatCurrency(diario.totalProducao)}</td>
            </tr>
          </tfoot>
          ` : ''}
        </table>
      ` : ''}

      ${diario.equipe.length > 0 ? `
        <h2><svg class="icon-h2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> Equipe</h2>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Função</th>
              <th class="text-right">Horas</th>
            </tr>
          </thead>
          <tbody>
            ${diario.equipe.map(e => `
              <tr>
                <td>${e.nome}</td>
                <td>${e.funcao || "—"}</td>
                <td class="text-right">${e.horas}h</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${diario.equipamentos.length > 0 ? `
        <h2><svg class="icon-h2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg> Equipamentos</h2>
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th class="text-right">Horas</th>
            </tr>
          </thead>
          <tbody>
            ${diario.equipamentos.map(e => `
              <tr>
                <td>${e.descricao}</td>
                <td class="text-right">${e.horas}h</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${diario.veiculos.length > 0 ? `
        <h2><svg class="icon-h2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Veículos</h2>
        <table>
          <thead>
            <tr>
              <th>Veículo</th>
              <th class="text-right">Placa</th>
              <th class="text-right">KM Inicial</th>
              <th class="text-right">KM Final</th>
              <th class="text-right">KM Rodados</th>
            </tr>
          </thead>
          <tbody>
            ${diario.veiculos.map(v => `
              <tr>
                <td>${v.descricao}</td>
                <td class="text-right">${v.placa || "—"}</td>
                <td class="text-right">${Number(v.km_inicial || 0).toLocaleString('pt-BR')}</td>
                <td class="text-right">${Number(v.km_final || 0).toLocaleString('pt-BR')}</td>
                <td class="text-right"><strong>${Number(v.km_rodados || 0).toLocaleString('pt-BR')} km</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${diario.observacoes ? `
        <h2><svg class="icon-h2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Observações</h2>
        <div style="color:#334155; padding: 12px 16px; background: #f0f4f8; border-radius: 6px; border: 1px solid #d0d7e0; line-height: 1.6; white-space: pre-line;">${diario.observacoes}</div>
      ` : ''}

      ${diario.fotos.length > 0 ? (() => {
        const itemGroups = new Map<string, typeof diario.fotos>();
        const itemOrder: string[] = [];
        diario.fotos.forEach(f => {
          const key = f.item_evidencia ? f.item_evidencia.codigo : '__sem_item__';
          if (!itemGroups.has(key)) { itemGroups.set(key, []); itemOrder.push(key); }
          itemGroups.get(key)!.push(f);
        });
        return `
        <h2><svg class="icon-h2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> Relatório Fotográfico</h2>
        ${itemOrder.map(key => {
          const photos = itemGroups.get(key)!;
          const first = photos[0];
          const title = first.item_evidencia ? `${first.item_evidencia.codigo} — ${first.item_evidencia.descricao}` : 'Sem item vinculado';
          const renderCard = (f: RdoFoto) => `
              <div class="foto-card">
                <img src="${f.url}" alt="foto" />
                ${f.legenda ? `<div class="foto-info"><div class="foto-legenda">${f.legenda}</div></div>` : ''}
              </div>`;
          // Render in pairs so each row avoids page breaks
          const rows: string[] = [];
          for (let i = 0; i < photos.length; i += 2) {
            if (i + 1 < photos.length) {
              rows.push(`<div class="foto-row" style="page-break-inside:avoid; break-inside:avoid;">${renderCard(photos[i])}${renderCard(photos[i+1])}</div>`);
            } else {
              rows.push(`<div class="foto-row" style="page-break-inside:avoid; break-inside:avoid;">${renderCard(photos[i])}</div>`);
            }
          }
          return `
          <div class="foto-item-group" style="page-break-inside:avoid; break-inside:avoid;">
            <h3 style="font-size:13px; margin:16px 0 8px; color:#1e3a5f;">${title}</h3>
            <div class="foto-grid">
              ${rows.join('')}
            </div>
          </div>`;
        }).join('')}`;
      })() : ''}
    </div>
  `;
}

async function fetchImageAsBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

interface DayGroup {
  data: string;
  diarios: RdoDiarioResumo[];
  totalProducao: number;
  totalItens: number;
  totalFotos: number;
}

export default function RdoPage() {
  const { role } = useAuth();
  const isCliente = role === "cliente";
  const { projetos } = useProjetos();
  const [selectedProjetoIds, setSelectedProjetoIds] = usePersistedState<string[]>("rdo_projeto_ids_v2", []);
  const { sites } = useSites();
  const filteredSites = selectedProjetoIds.length > 0
    ? sites.filter(s => selectedProjetoIds.includes(s.projeto_id))
    : sites;

  const [selectedSiteIds, setSelectedSiteIds] = usePersistedState<string[]>("rdo_site_ids_v2", []);

  // Build sites map for the hook
  const sitesMap = useMemo(() => {
    const m = new Map<string, { codigo: string; nome: string }>();
    sites.forEach(s => m.set(s.id, { codigo: s.codigo, nome: s.nome }));
    return m;
  }, [sites]);

  // Determine which site IDs to query
  const querySiteIds = useMemo(() => {
    if (selectedSiteIds.length > 0) {
      return selectedSiteIds;
    }
    return filteredSites.map(s => s.id);
  }, [selectedSiteIds, filteredSites]);

  const selectedSite = selectedSiteIds.length === 1 ? sites.find(s => s.id === selectedSiteIds[0]) : null;
  
  // Resolve client logo: from selected site, or from selected project's client, or from first available site
  const clienteLogoUrl = useMemo(() => {
    if (selectedSite) {
      const logo = (selectedSite as any)?.projeto?.clienteObj?.logo_url;
      if (logo) return logo;
    }
    if (selectedProjetoIds.length > 0) {
      const siteWithLogo = sites.find(s => selectedProjetoIds.includes(s.projeto_id) && (s as any)?.projeto?.clienteObj?.logo_url);
      if (siteWithLogo) return (siteWithLogo as any).projeto.clienteObj.logo_url;
    }
    return null;
  }, [selectedSite, selectedProjetoIds, sites]);
  const selectedProjeto = selectedProjetoIds.length === 1 ? projetos.find(p => p.id === selectedProjetoIds[0]) : null;
  const firstProjetoId = selectedSite?.projeto_id || selectedProjeto?.id || filteredSites[0]?.projeto_id;

  const toggleProjeto = useCallback((id: string) => {
    setSelectedProjetoIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      // Clear site selection when projects change
      setSelectedSiteIds([]);
      return next;
    });
  }, [setSelectedProjetoIds, setSelectedSiteIds]);

  const toggleSite = useCallback((id: string) => {
    setSelectedSiteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, [setSelectedSiteIds]);
  const { itensLpu } = useItensLpu(firstProjetoId);

  const [dataInicio, setDataInicio] = usePersistedState("rdo-data-inicio", format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = usePersistedState("rdo-data-fim", format(new Date(), "yyyy-MM-dd"));
  const [itemFilter, setItemFilter] = useState<string>("");
  const [busca, setBusca] = useState("");

  const { data: diarios = [], isLoading } = useRdo(
    querySiteIds.length > 0 ? querySiteIds : undefined,
    dataInicio,
    dataFim,
    itemFilter !== "all" ? itemFilter : undefined,
    busca,
    sitesMap
  );

  const [selectedDiarioId, setSelectedDiarioId] = useState<string | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const toggleDayCollapse = useCallback((data: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(data)) next.delete(data); else next.add(data);
      return next;
    });
  }, []);
  const selectedDiario = diarios.find(d => d.id === selectedDiarioId);

  const [lightboxPhoto, setLightboxPhoto] = useState<RdoFoto & { data: string } | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Group diarios by date
  const dayGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, RdoDiarioResumo[]>();
    diarios.forEach(d => {
      const existing = map.get(d.data) || [];
      existing.push(d);
      map.set(d.data, existing);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([data, diariosForDay]) => ({
        data,
        diarios: diariosForDay,
        totalProducao: diariosForDay.reduce((s, d) => s + d.totalProducao, 0),
        totalItens: diariosForDay.reduce((s, d) => s + d.totalItens, 0),
        totalFotos: diariosForDay.reduce((s, d) => s + d.totalFotos, 0),
      }));
  }, [diarios]);

  const isMultiSite = selectedSiteIds.length !== 1;

  const uniqueItems = useMemo(() => {
    const map = new Map<string, { id: string; codigo: string; descricao: string }>();
    diarios.forEach(d => d.producoes.forEach(p => {
      if (p.item_lpu) map.set(p.item_lpu.codigo, { id: p.item_lpu_id, codigo: p.item_lpu.codigo, descricao: p.item_lpu.descricao });
    }));
    return Array.from(map.values());
  }, [diarios]);

  const totalDias = dayGroups.length;
  const totalFotos = diarios.reduce((s, d) => s + d.totalFotos, 0);
  const totalProd = diarios.reduce((s, d) => s + d.totalProducao, 0);

  // Download single day
  const handleDownloadDia = useCallback(async (diario: RdoDiarioResumo) => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      const dataLabel = format(parseISO(diario.data), "yyyy-MM-dd");
      const siteLabel = diario.site_codigo ? `${diario.site_codigo} — ${diario.site_nome}` : undefined;

      const html = gerarRelatorioDiaHtml(diario, isCliente, clienteLogoUrl, siteLabel);
      const container = document.createElement("div");
      container.innerHTML = html;
      const opt = getPdfOptions(`RDO_${dataLabel}.pdf`);
      const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
      zip.file(`RDO_${dataLabel}_${diario.site_codigo || 'site'}.pdf`, pdfBlob);

      if (diario.fotos.length > 0) {
        const fotosFolder = zip.folder("fotos");
        for (let i = 0; i < diario.fotos.length; i++) {
          const f = diario.fotos[i];
          const blob = await fetchImageAsBlob(f.url);
          if (blob && fotosFolder) {
            const cls = classificacaoLabel[f.classificacao] || f.classificacao;
            const itemLabel = f.item_evidencia ? `_${f.item_evidencia.codigo}` : "";
            const ext = f.url.split(".").pop()?.split("?")[0] || "jpg";
            fotosFolder.file(`${String(i + 1).padStart(2, "0")}_${cls}${itemLabel}.${ext}`, blob);
          }
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `RDO_${dataLabel}_${diario.site_codigo || 'site'}.zip`);
      toast.success("Download concluído!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar download.");
    } finally {
      setDownloading(false);
    }
  }, [isCliente, clienteLogoUrl]);

  // Download period zip
  const handleDownloadPeriodo = useCallback(async () => {
    if (diarios.length === 0) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      const periodoLabel = `${dataInicio}_a_${dataFim}`;

      for (const diario of diarios) {
        const dataLabel = format(parseISO(diario.data), "yyyy-MM-dd");
        const folderName = `${dataLabel}_${diario.site_codigo || diario.site_id}`;
        const dayFolder = zip.folder(folderName);
        if (!dayFolder) continue;

        const siteLabel = diario.site_codigo ? `${diario.site_codigo} — ${diario.site_nome}` : undefined;
        const html = gerarRelatorioDiaHtml(diario, isCliente, clienteLogoUrl, siteLabel);
        const container = document.createElement("div");
        container.innerHTML = html;
        const opt = getPdfOptions(`RDO_${dataLabel}.pdf`);
        const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
        dayFolder.file(`RDO_${dataLabel}.pdf`, pdfBlob);

        if (diario.fotos.length > 0) {
          const fotosFolder = dayFolder.folder("fotos");
          for (let i = 0; i < diario.fotos.length; i++) {
            const f = diario.fotos[i];
            const blob = await fetchImageAsBlob(f.url);
            if (blob && fotosFolder) {
              const cls = classificacaoLabel[f.classificacao] || f.classificacao;
              const itemLabel = f.item_evidencia ? `_${f.item_evidencia.codigo}` : "";
              const ext = f.url.split(".").pop()?.split("?")[0] || "jpg";
              fotosFolder.file(`${String(i + 1).padStart(2, "0")}_${cls}${itemLabel}.${ext}`, blob);
            }
          }
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `RDO_${periodoLabel}.zip`);
      toast.success(`Download de ${diarios.length} registros concluído!`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar download do período.");
    } finally {
      setDownloading(false);
    }
  }, [diarios, dataInicio, dataFim, isCliente, clienteLogoUrl]);

  const projetoLabel = selectedProjetoIds.length === 0
    ? "Todos os projetos"
    : selectedProjetoIds.length === 1
      ? (() => { const p = projetos.find(x => x.id === selectedProjetoIds[0]); return p ? `${p.codigo} — ${p.nome}` : "1 projeto"; })()
      : `${selectedProjetoIds.length} projetos`;

  const siteLabel = selectedSiteIds.length === 0
    ? "Todos os sites"
    : selectedSiteIds.length === 1
      ? (() => { const s = sites.find(x => x.id === selectedSiteIds[0]); return s ? `${s.codigo} — ${s.nome}` : "1 site"; })()
      : `${selectedSiteIds.length} sites`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight leading-none">RDO — Relatório Diário de Obra</h1>
          {selectedSite && (
            <p className="text-sm text-muted-foreground mt-1">
              {selectedSite.codigo} — {selectedSite.nome}
              {selectedSite.municipio && ` · ${selectedSite.municipio}`}
              {selectedSite.uf && `/${selectedSite.uf}`}
            </p>
          )}
          {!selectedSite && selectedProjeto && (
            <p className="text-sm text-muted-foreground mt-1">
              {selectedProjeto.codigo} — {selectedProjeto.nome} · Todos os sites
            </p>
          )}
        </div>
      </div>

      {/* Multi-select filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-[220px]">
          <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal">
                {projetoLabel}
                {selectedProjetoIds.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{selectedProjetoIds.length}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 space-y-2" align="start">
              <div className="flex gap-2 text-xs mb-1">
                <button onClick={() => setSelectedProjetoIds(projetos.map(p => p.id))} className="text-primary hover:underline">Todos</button>
                <button onClick={() => { setSelectedProjetoIds([]); setSelectedSiteIds([]); }} className="text-primary hover:underline">Limpar</button>
              </div>
              <ScrollArea className="max-h-72">
                <div className="space-y-1">
                  {projetos.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                      <Checkbox checked={selectedProjetoIds.includes(p.id)} onCheckedChange={() => toggleProjeto(p.id)} className="h-3.5 w-3.5" />
                      <span className="truncate">{p.codigo} — {p.nome}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-2 min-w-[220px]">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal">
                {siteLabel}
                {selectedSiteIds.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{selectedSiteIds.length}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 space-y-2" align="start">
              <div className="flex gap-2 text-xs mb-1">
                <button onClick={() => setSelectedSiteIds(filteredSites.map(s => s.id))} className="text-primary hover:underline">Todos</button>
                <button onClick={() => setSelectedSiteIds([])} className="text-primary hover:underline">Limpar</button>
              </div>
              <ScrollArea className="max-h-72">
                <div className="space-y-1">
                  {filteredSites.map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                      <Checkbox checked={selectedSiteIds.includes(s.id)} onCheckedChange={() => toggleSite(s.id)} className="h-3.5 w-3.5" />
                      <span className="truncate">{s.codigo} — {s.nome}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {filteredSites.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Selecione um projeto com sites para visualizar o RDO.</p>
          </CardContent>
        </Card>
      )}

      {filteredSites.length > 0 && (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Início
                  </label>
                  <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[160px]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Fim
                  </label>
                  <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[160px]" />
                </div>
                <div className="space-y-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <ClipboardList className="h-3 w-3" /> Item
                  </label>
                  <Select value={itemFilter} onValueChange={setItemFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os itens</SelectItem>
                      {uniqueItems.map(i => (
                        <SelectItem key={i.id} value={i.id}>{i.codigo} — {i.descricao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 flex-1 min-w-[180px]">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Search className="h-3 w-3" /> Buscar
                  </label>
                  <Input
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar por texto..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary cards + Download buttons */}
          <div className="flex flex-wrap items-start gap-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold tabular-nums">{totalDias}</p>
                  <p className="text-xs text-muted-foreground">Dias registrados</p>
                </CardContent>
              </Card>
              {!isCliente && (
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalProd)}</p>
                    <p className="text-xs text-muted-foreground">Produção total</p>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold tabular-nums">{totalFotos}</p>
                  <p className="text-xs text-muted-foreground">Fotos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold tabular-nums">{diarios.reduce((s, d) => s + d.totalItens, 0)}</p>
                  <p className="text-xs text-muted-foreground">Itens produzidos</p>
                </CardContent>
              </Card>
            </div>

            {diarios.length > 0 && (
              <Button
                variant="outline"
                className="gap-2 shrink-0"
                disabled={downloading}
                onClick={handleDownloadPeriodo}
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderArchive className="h-4 w-4" />
                )}
                Baixar Período (.zip)
              </Button>
            )}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : diarios.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>Nenhum registro encontrado no período selecionado.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Timeline cards - left */}
              <div className="lg:col-span-1 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Linha do Tempo</p>
                <ScrollArea className="h-[calc(100vh-420px)]">
                  <div className="space-y-3 pr-2">
                    {dayGroups.map(group => {
                      const isDayCollapsed = collapsedDays.has(group.data);
                      return (
                      <div key={group.data} className="space-y-0">
                        {/* Day header - clickable to collapse/expand */}
                        <button
                          onClick={() => toggleDayCollapse(group.data)}
                          className="flex items-center gap-2 mb-1 w-full text-left hover:bg-accent/50 rounded px-1 py-0.5 transition-colors"
                        >
                          <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                          <span className="text-sm font-bold tabular-nums">
                            {format(parseISO(group.data), "dd/MM", { locale: ptBR })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(group.data), "EEEE", { locale: ptBR })}
                          </span>
                          {group.diarios.length > 1 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              {group.diarios.length} sites
                            </Badge>
                          )}
                          <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform ${isDayCollapsed ? "" : "rotate-90"}`} />
                        </button>
                        {/* Day totals */}
                        <div className="flex items-center gap-3 ml-5 mb-1.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <ClipboardList className="h-3 w-3" /> {group.totalItens} itens
                          </span>
                          <span className="flex items-center gap-1">
                            <Camera className="h-3 w-3" /> {group.totalFotos}
                          </span>
                          {!isCliente && (
                            <span className="flex items-center gap-1 font-medium">
                              <DollarSign className="h-3 w-3" /> {formatCurrency(group.totalProducao)}
                            </span>
                          )}
                        </div>
                        {/* Site cards within the day - collapsible */}
                        {!isDayCollapsed && (
                          <div className={`space-y-1.5 ${group.diarios.length > 1 ? "ml-5 border-l-2 border-primary/20 pl-3" : ""}`}>
                            {group.diarios.map(d => (
                              <DayCard
                                key={d.id}
                                diario={d}
                                isSelected={d.id === selectedDiarioId}
                                isCliente={isCliente}
                                showSite={isMultiSite}
                                onClick={() => setSelectedDiarioId(d.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );})}
                  </div>
                </ScrollArea>
              </div>

              {/* Day detail - right */}
              <div className="lg:col-span-2">
                {!selectedDiario ? (
                  <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                      <Eye className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p>Selecione um dia na linha do tempo para ver os detalhes.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <DayDetail
                    diario={selectedDiario}
                    isCliente={isCliente}
                    showSite={isMultiSite}
                    onPhotoClick={(photo) => setLightboxPhoto({ ...photo, data: selectedDiario.data })}
                    onDownloadDia={handleDownloadDia}
                    downloading={downloading}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Photo Lightbox */}
      <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {lightboxPhoto && (
            <div className="relative">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.legenda || "Foto do diário"}
                className="w-full max-h-[80vh] object-contain bg-black"
                loading="lazy"
              />
              <div className="absolute top-3 right-3">
                <Button variant="secondary" size="icon" onClick={() => setLightboxPhoto(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 bg-background space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={classificacaoBadgeClass[lightboxPhoto.classificacao] || ""}>
                    {classificacaoLabel[lightboxPhoto.classificacao] || lightboxPhoto.classificacao}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {format(parseISO(lightboxPhoto.data), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                {lightboxPhoto.item_evidencia && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">{lightboxPhoto.item_evidencia.codigo}</span>
                    <span className="text-muted-foreground">— {lightboxPhoto.item_evidencia.descricao}</span>
                  </div>
                )}
                {lightboxPhoto.legenda && (
                  <p className="text-sm">{lightboxPhoto.legenda}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Day Card Component =====
function DayCard({ diario, isSelected, isCliente, showSite, onClick }: {
  diario: RdoDiarioResumo;
  isSelected: boolean;
  isCliente: boolean;
  showSite: boolean;
  onClick: () => void;
}) {
  const hasProblema = diario.fotos.some(f => f.classificacao === "problema");
  const thumbs = diario.fotos.slice(0, 3);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 transition-all duration-200
        ${isSelected
          ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
          : "border-border hover:border-primary/40 hover:shadow-sm"
        }
        active:scale-[0.98]`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          {showSite && diario.site_codigo && (
            <div className="flex items-center gap-1.5 mb-0.5">
              <MapPin className="h-3 w-3 text-primary shrink-0" />
              <span className="text-xs font-semibold text-primary truncate">
                {diario.site_codigo} — {diario.site_nome}
              </span>
            </div>
          )}
          {!showSite && (
            <div className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">
                {format(parseISO(diario.data), "dd/MM", { locale: ptBR })}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(parseISO(diario.data), "EEEE", { locale: ptBR })}
              </span>
              {hasProblema && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ClipboardList className="h-3 w-3" /> {diario.totalItens} {diario.totalItens === 1 ? "item" : "itens"}
            </span>
            <span className="flex items-center gap-1">
              <Camera className="h-3 w-3" /> {diario.totalFotos}
            </span>
            {!isCliente && (
              <span className="flex items-center gap-1 font-medium text-foreground">
                <DollarSign className="h-3 w-3" /> {formatCurrency(diario.totalProducao)}
              </span>
            )}
            {hasProblema && showSite && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            )}
          </div>
          {diario.observacoes && (
            <p className="text-xs text-muted-foreground truncate mt-0.5 italic">
              <MessageSquare className="h-3 w-3 inline mr-1" />
              {diario.observacoes}
            </p>
          )}
        </div>
        {thumbs.length > 0 && (
          <div className="flex -space-x-2 shrink-0">
            {thumbs.map(f => (
              <div key={f.id} className="w-8 h-8 rounded border-2 border-background overflow-hidden">
                <img src={f.url} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

// ===== Day Detail Component =====
function DayDetail({ diario, isCliente, showSite, onPhotoClick, onDownloadDia, downloading }: {
  diario: RdoDiarioResumo;
  isCliente: boolean;
  showSite: boolean;
  onPhotoClick: (photo: RdoFoto) => void;
  onDownloadDia: (diario: RdoDiarioResumo) => void;
  downloading: boolean;
}) {
  const fotosByItem = useMemo(() => {
    const groups: { key: string; label: string; photos: RdoFoto[] }[] = [];
    const map = new Map<string, RdoFoto[]>();
    const order: string[] = [];
    diario.fotos.forEach(f => {
      const key = f.item_evidencia ? f.item_evidencia.codigo : "__sem_item__";
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(f);
    });
    order.forEach(key => {
      const photos = map.get(key)!;
      const first = photos[0];
      const label = first.item_evidencia
        ? `${first.item_evidencia.codigo} — ${first.item_evidencia.descricao}`
        : "Sem item vinculado";
      groups.push({ key, label, photos });
    });
    return groups;
  }, [diario.fotos]);

  return (
    <ScrollArea className="h-[calc(100vh-420px)]">
      <div className="space-y-5 pr-2">
        {/* Date header + download button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tabular-nums">
              {format(parseISO(diario.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
            <p className="text-sm text-muted-foreground capitalize">
              {format(parseISO(diario.data), "EEEE", { locale: ptBR })}
            </p>
            {showSite && diario.site_codigo && (
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-semibold text-primary">
                  {diario.site_codigo} — {diario.site_nome}
                </span>
                {diario.municipio && (
                  <span className="text-xs text-muted-foreground ml-1">
                    · {diario.municipio}{diario.uf ? `/${diario.uf}` : ""}
                  </span>
                )}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            disabled={downloading}
            onClick={() => onDownloadDia(diario)}
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Baixar Dia
          </Button>
        </div>

        {/* Produção */}
        {diario.producoes.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-emerald-600" />
                Produção
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {diario.producoes.map(p => (
                  <div key={p.id} className="flex items-center py-1.5 border-b border-dashed last:border-0 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {p.item_lpu?.codigo} — {p.item_lpu?.descricao}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground shrink-0 text-right min-w-[80px]">
                      {Number(p.quantidade)} {p.item_lpu?.unidade}
                    </span>
                    {!isCliente && (
                      <span className="text-sm font-semibold tabular-nums shrink-0 text-right min-w-[100px]">
                        {formatCurrency(Number(p.valor_total))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {!isCliente && (
                <div className="flex justify-end mt-3 pt-2 border-t">
                  <span className="text-sm font-bold">Total: {formatCurrency(diario.totalProducao)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recursos */}
        {(diario.equipe.length > 0 || diario.equipamentos.length > 0 || diario.veiculos.length > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                Recursos Utilizados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {diario.equipe.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Users className="h-3 w-3" /> Equipe
                  </p>
                  <div className="space-y-1">
                    {diario.equipe.map(e => (
                      <div key={e.id} className="flex justify-between text-sm py-1">
                        <span>{e.nome}{e.funcao ? ` (${e.funcao})` : ""}</span>
                        <span className="text-muted-foreground tabular-nums">{e.horas}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {diario.equipamentos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Wrench className="h-3 w-3" /> Equipamentos
                  </p>
                  <div className="space-y-1">
                    {diario.equipamentos.map(e => (
                      <div key={e.id} className="flex justify-between text-sm py-1">
                        <span>{e.descricao}</span>
                        <span className="text-muted-foreground tabular-nums">{e.horas}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {diario.veiculos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Truck className="h-3 w-3" /> Veículos
                  </p>
                  <div className="space-y-1">
                    {diario.veiculos.map(v => (
                      <div key={v.id} className="flex justify-between text-sm py-1">
                        <span>{v.descricao}{v.placa ? ` (${v.placa})` : ""}</span>
                        <div className="flex items-center gap-3 text-muted-foreground tabular-nums">
                          <span className="text-xs">KM Ini: {Number(v.km_inicial || 0)}</span>
                          <span className="text-xs">KM Fin: {Number(v.km_final || 0)}</span>
                          {Number(v.km_rodados) > 0 && (
                            <span className="font-medium text-foreground">{Number(v.km_rodados)} km</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Fotos */}
        {diario.fotos.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Image className="h-4 w-4 text-purple-600" />
                Fotos do Dia
                <Badge variant="secondary" className="ml-auto text-xs">{diario.fotos.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fotosByItem.map(({ key, label, photos }) => (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-xs font-semibold truncate">{label}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto shrink-0">{photos.length}</Badge>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {photos.map(f => (
                      <button
                        key={f.id}
                        onClick={() => onPhotoClick(f)}
                        className="relative aspect-square rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary/50 transition-all active:scale-[0.97] group"
                      >
                        <img
                          src={f.url}
                          alt={f.legenda || "Foto"}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 space-y-0.5">
                          <Badge className={`text-[9px] px-1 py-0 ${classificacaoBadgeClass[f.classificacao] || ""}`}>
                            {classificacaoLabel[f.classificacao] || f.classificacao}
                          </Badge>
                          {f.legenda && (
                            <p className="text-[10px] text-white truncate">{f.legenda}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Observações */}
        {diario.observacoes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-amber-600" />
                Observações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{diario.observacoes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
