import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { FileText, Camera, MapPin, Calendar, Loader2 } from "lucide-react";
import { useRef, useState, useMemo } from "react";
import html2pdf from "html2pdf.js";
import { getPdfOptions } from "@/lib/pdfTemplates";

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

      const { data: fotos, error: fErr } = await supabase
        .from("diario_fotos")
        .select("*")
        .in("diario_id", diarioIds);
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
        return {
          id: f.id,
          url: f.url,
          classificacao: f.classificacao,
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
    switch (cls) {
      case "execucao": return "Execução";
      case "antes": return "Antes";
      case "problema": return "Problema";
      default: return cls;
    }
  };

  const classColor = (cls: string) => {
    switch (cls) {
      case "execucao": return "#2563eb";
      case "antes": return "#16a34a";
      case "problema": return "#dc2626";
      default: return "#6b7280";
    }
  };

  const handleExportPdf = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const opt = getPdfOptions(`Medicao_${detailMedicao.numero_medicao || detailMedicao.site_codigo}.pdf`);
      const element = printRef.current;
      await html2pdf().set(opt).from(element).save();
    } catch (e) {
      console.error(e);
    } finally {
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

  // Group photos by site for mista/separada display
  const fotosBySite = useMemo(() => {
    const map = new Map<string, { fotos: DiarioFotoWithItem[]; siteId: string }>();
    diarioFotos.forEach(f => {
      const key = f.site_nome || "Sem site";
      if (!map.has(key)) map.set(key, { fotos: [], siteId: f.site_id || "" });
      map.get(key)!.fotos.push(f);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
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
            <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Observações</h2>
            <p className="text-sm text-muted-foreground">{detailMedicao.observacao_acompanhamento}</p>
          </div>
        )}

        <Separator className="my-3" />

        {/* Consolidated Items table */}
        <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Itens da Medição</h2>
        <Table>
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

        {/* Photo Report */}
        {(diarioFotos.length > 0 || loadingFotos) && (
          <>
            <Separator className="my-4" />
            <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }} className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Relatório Fotográfico ({diarioFotos.length} fotos)
              {(tipoMedicao === "mista" || tipoMedicao === "separada") && isMultiSite && (
                <Badge variant="outline" className="text-xs">Agrupado por site</Badge>
              )}
            </h2>

            {loadingFotos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tipoMedicao === "mista" ? (
              /* MISTA: Photos grouped by site with per-site production table */
              <div className="space-y-6">
                {fotosBySite.map(([siteName, { fotos, siteId }]) => {
                  const siteItems = productionBySite.get(siteId) || [];
                  return (
                    <div key={siteName} className="border rounded-lg overflow-hidden" style={{ pageBreakInside: "avoid" }}>
                      <div className="px-4 py-2 font-semibold text-sm flex items-center gap-2 text-white" style={{ backgroundColor: "hsl(var(--primary))" }}>
                        <MapPin className="h-4 w-4" />
                        {siteName}
                      </div>
                      {siteItems.length > 0 && (
                        <div className="p-3 border-b bg-muted/20">
                          <p className="text-xs font-semibold mb-2">Produção do Site:</p>
                          <Table>
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
                        </div>
                      )}
                      <div className="p-3">
                        <div className="grid grid-cols-2 gap-4">
                          {fotos.map(f => (
                            <div key={f.id} className="foto-card border rounded-lg overflow-hidden shadow-sm bg-card" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                              <img src={f.url} alt={f.item_descricao || "foto"} className="w-full h-56 object-cover" />
                              <div className="p-3 bg-muted/30 space-y-1.5">
                                {f.item_codigo && (
                                  <p className="font-semibold text-xs text-foreground break-words">{f.item_codigo} — {f.item_descricao}</p>
                                )}
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  {f.municipio && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{f.municipio}</span>}
                                  {f.diario_data && <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{formatDate(f.diario_data)}</span>}
                                </div>
                                <Badge className="text-[9px] text-white" style={{ backgroundColor: classColor(f.classificacao) }}>
                                  {classLabel(f.classificacao)}
                                </Badge>
                                {f.legenda && (
                                  <p className="text-[10px] text-muted-foreground italic mt-1">"{f.legenda}"</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* SEPARADA / AGRUPADA: Photos grouped by item */
              <div className="space-y-6">
                {Array.from(fotosByItem.byItem.entries()).map(([itemLabel, itemFotos]) => (
                  <div key={itemLabel}>
                    <h3 className="text-sm font-semibold mb-3 text-primary">{itemLabel}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {itemFotos.map(f => (
                        <div key={f.id} className="foto-card border rounded-lg overflow-hidden shadow-sm bg-card" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          <img src={f.url} alt={f.item_descricao || "foto"} className="w-full h-56 object-cover" />
                          <div className="p-3 bg-muted/30 space-y-1.5">
                            <p className="font-semibold text-xs text-foreground break-words">{f.item_codigo} — {f.item_descricao}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              {f.municipio && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{f.municipio}</span>}
                              {f.diario_data && <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{formatDate(f.diario_data)}</span>}
                            </div>
                            <Badge className="text-[9px] text-white" style={{ backgroundColor: classColor(f.classificacao) }}>
                              {classLabel(f.classificacao)}
                            </Badge>
                            {f.legenda && (
                              <p className="text-[10px] text-muted-foreground italic mt-1">"{f.legenda}"</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {fotosByItem.gerais.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Fotos Gerais</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {fotosByItem.gerais.map(f => (
                        <div key={f.id} className="foto-card border rounded-lg overflow-hidden shadow-sm bg-card" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          <img src={f.url} alt="foto" className="w-full h-56 object-cover" />
                          <div className="p-3 bg-muted/30 space-y-1.5">
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              {f.site_nome && <span>{f.site_nome}</span>}
                              {f.municipio && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{f.municipio}</span>}
                              {f.diario_data && <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{formatDate(f.diario_data)}</span>}
                            </div>
                            <Badge className="text-[9px] text-white" style={{ backgroundColor: classColor(f.classificacao) }}>
                              {classLabel(f.classificacao)}
                            </Badge>
                            {f.legenda && (
                              <p className="text-[10px] text-muted-foreground italic mt-1">"{f.legenda}"</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
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
