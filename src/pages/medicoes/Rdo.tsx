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
import { useSites } from "@/hooks/useSites";
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
function gerarRelatorioDiaHtml(diario: RdoDiarioResumo, isCliente: boolean, clienteLogoUrl?: string | null): string {
  const dataFormatada = format(parseISO(diario.data), "dd/MM/yyyy (EEEE)", { locale: ptBR });
  
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

      ${diario.producoes.length > 0 ? `
        <h2>📋 Produção</h2>
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
              <td colspan="2" class="text-right font-bold bg-muted" style="padding:10px;">Total Produção:</td>
              <td class="text-right font-bold bg-muted" style="padding:10px;">${formatCurrency(diario.totalProducao)}</td>
            </tr>
          </tfoot>
          ` : ''}
        </table>
      ` : ''}

      ${diario.equipe.length > 0 ? `
        <h2>👷 Equipe</h2>
        <div class="summary-box">
          <ul>
            ${diario.equipe.map(e => `<li>${e.nome}${e.funcao ? ` (${e.funcao})` : ""} — <strong>${e.horas}h</strong></li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${diario.equipamentos.length > 0 ? `
        <h2>🔧 Equipamentos</h2>
        <div class="summary-box">
          <ul>
            ${diario.equipamentos.map(e => `<li>${e.descricao} — <strong>${e.horas}h</strong></li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${diario.veiculos.length > 0 ? `
        <h2>🚛 Veículos</h2>
        <table>
          <thead>
            <tr>
              <th>Veículo</th>
              <th class="text-right">KM Inicial</th>
              <th class="text-right">KM Final</th>
              <th class="text-right">KM Rodados</th>
            </tr>
          </thead>
          <tbody>
            ${diario.veiculos.map(v => `
              <tr>
                <td>${v.descricao}${v.placa ? ` (${v.placa})` : ""}</td>
                <td class="text-right">${Number(v.km_inicial || 0)}</td>
                <td class="text-right">${Number(v.km_final || 0)}</td>
                <td class="text-right"><strong>${Number(v.km_rodados || 0)} km</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${diario.observacoes ? `
        <h2>💬 Observações</h2>
        <p style="color:#475569; padding: 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">${diario.observacoes}</p>
      ` : ''}

      ${diario.fotos.length > 0 ? `
        <div class="html2pdf__page-break"></div>
        <h2>📷 Relatório Fotográfico</h2>
        <div class="foto-grid">
          ${diario.fotos.map(f => `
            <div class="foto-card">
              <img src="${f.url}" alt="foto" />
              <div class="foto-info">
                ${f.item_evidencia ? `<div class="foto-title">${f.item_evidencia.codigo}</div>` : ''}
                <div class="foto-meta">
                  <span class="foto-badge" style="background:${classificacaoColors[f.classificacao] || '#94a3b8'}">${classificacaoLabel[f.classificacao] || f.classificacao}</span>
                </div>
                ${f.legenda ? `<div class="foto-legenda">"${f.legenda}"</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
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

export default function RdoPage() {
  const { role } = useAuth();
  const isCliente = role === "cliente";
  const { sites } = useSites();

  const [selectedSiteId, setSelectedSiteId] = usePersistedState<string>("rdo_site_id", "");
  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const clienteLogoUrl = selectedSite?.clienteObj?.logo_url || selectedSite?.projeto?.clienteObj?.logo_url;
  const { itensLpu } = useItensLpu(selectedSite?.projeto_id);

  const [dataInicio, setDataInicio] = useState(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [itemFilter, setItemFilter] = useState<string>("all");
  const [busca, setBusca] = useState("");

  const { data: diarios = [], isLoading } = useRdo(
    selectedSiteId,
    dataInicio,
    dataFim,
    itemFilter !== "all" ? itemFilter : undefined,
    busca
  );

  const [selectedDiarioId, setSelectedDiarioId] = useState<string | null>(null);
  const selectedDiario = diarios.find(d => d.id === selectedDiarioId);

  const [lightboxPhoto, setLightboxPhoto] = useState<RdoFoto & { data: string } | null>(null);

  const [downloading, setDownloading] = useState(false);

  const uniqueItems = useMemo(() => {
    const map = new Map<string, { id: string; codigo: string; descricao: string }>();
    diarios.forEach(d => d.producoes.forEach(p => {
      if (p.item_lpu) map.set(p.item_lpu.codigo, { id: p.item_lpu_id, codigo: p.item_lpu.codigo, descricao: p.item_lpu.descricao });
    }));
    return Array.from(map.values());
  }, [diarios]);

  const totalDias = diarios.length;
  const totalFotos = diarios.reduce((s, d) => s + d.totalFotos, 0);
  const totalProd = diarios.reduce((s, d) => s + d.totalProducao, 0);

  // Download single day
  const handleDownloadDia = useCallback(async (diario: RdoDiarioResumo) => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      const dataLabel = format(parseISO(diario.data), "yyyy-MM-dd");

      // Add report PDF
      const html = gerarRelatorioDiaHtml(diario, isCliente, clienteLogoUrl);
      const container = document.createElement("div");
      container.innerHTML = html;
      const opt = getPdfOptions(`RDO_${dataLabel}.pdf`);
      const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
      zip.file(`RDO_${dataLabel}.pdf`, pdfBlob);

      // Add photos
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
      saveAs(content, `RDO_${dataLabel}.zip`);
      toast.success("Download concluído!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar download.");
    } finally {
      setDownloading(false);
    }
  }, [isCliente]);

  // Download period zip
  const handleDownloadPeriodo = useCallback(async () => {
    if (diarios.length === 0) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      const periodoLabel = `${dataInicio}_a_${dataFim}`;

      for (const diario of diarios) {
        const dataLabel = format(parseISO(diario.data), "yyyy-MM-dd");
        const dayFolder = zip.folder(dataLabel);
        if (!dayFolder) continue;

        const html = gerarRelatorioDiaHtml(diario, isCliente, clienteLogoUrl);
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
      toast.success(`Download de ${diarios.length} dias concluído!`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar download do período.");
    } finally {
      setDownloading(false);
    }
  }, [diarios, dataInicio, dataFim, isCliente]);

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
        </div>
      </div>

      {/* Site selector */}
      <div className="flex items-center gap-2 max-w-sm">
        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={selectedSiteId} onValueChange={(v) => { setSelectedSiteId(v); setSelectedDiarioId(null); }}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o site" />
          </SelectTrigger>
          <SelectContent>
            {sites.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.codigo} — {s.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedSiteId && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Selecione um site para visualizar o RDO.</p>
          </CardContent>
        </Card>
      )}

      {selectedSiteId && (
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

            {/* Download period button */}
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
                  <div className="space-y-2 pr-2">
                    {diarios.map(d => (
                      <DayCard
                        key={d.id}
                        diario={d}
                        isSelected={d.id === selectedDiarioId}
                        isCliente={isCliente}
                        onClick={() => setSelectedDiarioId(d.id)}
                      />
                    ))}
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
function DayCard({ diario, isSelected, isCliente, onClick }: {
  diario: RdoDiarioResumo;
  isSelected: boolean;
  isCliente: boolean;
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
        <div className="space-y-1.5 flex-1 min-w-0">
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
          </div>
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
function DayDetail({ diario, isCliente, onPhotoClick, onDownloadDia, downloading }: {
  diario: RdoDiarioResumo;
  isCliente: boolean;
  onPhotoClick: (photo: RdoFoto) => void;
  onDownloadDia: (diario: RdoDiarioResumo) => void;
  downloading: boolean;
}) {
  const fotosByClass = useMemo(() => {
    const groups: Record<string, RdoFoto[]> = {};
    diario.fotos.forEach(f => {
      if (!groups[f.classificacao]) groups[f.classificacao] = [];
      groups[f.classificacao].push(f);
    });
    return groups;
  }, [diario.fotos]);

  const custoEquipe = diario.equipe.reduce((s, e) => s + Number(e.custo_total), 0);
  const custoEquipamentos = diario.equipamentos.reduce((s, e) => s + Number(e.custo_total), 0);
  const custoVeiculos = diario.veiculos.reduce((s, v) => s + Number(v.custo_diaria), 0);

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
                  <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-dashed last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.item_lpu?.codigo} — {p.item_lpu?.descricao}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Number(p.quantidade)} {p.item_lpu?.unidade}
                      </p>
                    </div>
                    {!isCliente && (
                      <span className="text-sm font-semibold tabular-nums shrink-0 ml-3">
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
                {!isCliente && diario.custoTotal > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">{formatCurrency(diario.custoTotal)}</Badge>
                )}
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
                        {v.km_rodados > 0 && (
                          <span className="text-muted-foreground tabular-nums">{v.km_rodados} km</span>
                        )}
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
              {Object.entries(fotosByClass).map(([cls, photos]) => (
                <div key={cls}>
                  <Badge className={`mb-2 ${classificacaoBadgeClass[cls] || ""}`}>
                    {classificacaoLabel[cls] || cls}
                  </Badge>
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
                        {/* Item evidence + legenda overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 space-y-0.5">
                          {f.item_evidencia && (
                            <p className="text-[10px] text-emerald-300 font-medium truncate flex items-center gap-0.5">
                              <Tag className="h-2.5 w-2.5 shrink-0" />
                              {f.item_evidencia.codigo}
                            </p>
                          )}
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
