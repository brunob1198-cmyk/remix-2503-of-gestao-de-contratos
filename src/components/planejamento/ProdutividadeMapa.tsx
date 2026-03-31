import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell } from "recharts";
import { MapPin, BarChart3, TrendingUp } from "lucide-react";
import { useEffect } from "react";

interface ProdutividadeMapaProps {
  projetoId: string;
  siteFilter?: string;
}

interface ProdRegiao {
  municipio: string;
  uf: string;
  latitude: number;
  longitude: number;
  totalQuantidade: number;
  totalItens: number;
  avgQuantidade: number;
  photos: string[];
}

function FitBoundsRegiao({ regioes }: { regioes: ProdRegiao[] }) {
  const map = useMap();
  useEffect(() => {
    if (regioes.length === 0) return;
    const bounds = L.latLngBounds(
      regioes.map((r) => [r.latitude, r.longitude] as [number, number])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [regioes, map]);
  return null;
}

function getColor(value: number, max: number): string {
  const ratio = max > 0 ? value / max : 0;
  if (ratio > 0.75) return "#10b981";
  if (ratio > 0.5) return "#3b82f6";
  if (ratio > 0.25) return "#f59e0b";
  return "#ef4444";
}

function getRadius(value: number, max: number): number {
  const ratio = max > 0 ? value / max : 0;
  return Math.max(8, Math.min(30, 8 + ratio * 22));
}

export function ProdutividadeMapa({ projetoId, siteFilter }: ProdutividadeMapaProps) {
  const [metrica, setMetrica] = useState<"totalQuantidade" | "totalItens" | "avgQuantidade">("totalQuantidade");

  // Fetch production data with municipality info
  const { data: regioes = [], isLoading } = useQuery({
    queryKey: ["produtividade-mapa", projetoId, siteFilter],
    queryFn: async () => {
      // Get project sites
      let querySites = supabase
        .from("sites")
        .select("id, municipio, uf")
        .eq("projeto_id", projetoId);
        
      if (siteFilter) {
        querySites = querySites.eq("id", siteFilter);
      }
      
      const { data: sites } = await querySites;
      if (!sites?.length) return [];

      const siteIds = sites.map((s) => s.id);

      // Get production per site using Diario de Obra directly!
      const { data: prods } = await supabase
        .from("diario_producao")
        .select(`
          quantidade, 
          diario:diarios_obra!inner(site_id, municipio, uf)
        `)
        .in("diario.site_id", siteIds);

      if (!prods?.length) return [];

      // Get municipality coordinates
      const municipios = new Set<string>();
      prods.forEach((p: any) => {
        const mun = p.diario.municipio || sites.find((s) => s.id === p.diario.site_id)?.municipio;
        if (mun) municipios.add(mun);
      });

      const munList = Array.from(municipios);
      let munCoords: Record<string, { lat: number; lng: number; uf: string }> = {};

      if (munList.length > 0) {
        const { data: ibge } = await supabase
          .from("municipios_ibge")
          .select("nome, uf, latitude, longitude")
          .in("nome", munList);

        (ibge ?? []).forEach((m) => {
          if (m.latitude && m.longitude) {
            munCoords[m.nome] = { lat: Number(m.latitude), lng: Number(m.longitude), uf: m.uf };
          }
        });
      }

      // Aggregate by municipality
      const aggMap: Record<string, { mun: string; uf: string; lat: number; lng: number; total: number; count: number; photos: string[] }> = {};

      // Get photos for these sites
      const { data: photosData } = await supabase
        .from("diario_fotos")
        .select(`
          url,
          diario:diarios_obra!inner(municipio, uf, site_id)
        `)
        .in("diario.site_id", siteIds);

      prods.forEach((p: any) => {
        const mun = p.diario.municipio || sites.find((s) => s.id === p.diario.site_id)?.municipio || "";
        const uf = p.diario.uf || sites.find((s) => s.id === p.diario.site_id)?.uf || "";
        if (!mun) return;

        const coords = munCoords[mun];
        if (!coords) return;

        if (!aggMap[mun]) {
          const munPhotos = (photosData ?? [])
            .filter((f: any) => f.diario.municipio === mun)
            .map((f: any) => f.url);
            
          aggMap[mun] = { mun, uf: coords.uf || uf, lat: coords.lat, lng: coords.lng, total: 0, count: 0, photos: munPhotos };
        }
        aggMap[mun].total += Number(p.quantidade);
        aggMap[mun].count += 1;
      });

      return Object.values(aggMap).map((a) => ({
        municipio: a.mun,
        uf: a.uf,
        latitude: a.lat,
        longitude: a.lng,
        totalQuantidade: a.total,
        totalItens: a.count,
        avgQuantidade: a.count > 0 ? a.total / a.count : 0,
        photos: Array.from(new Set(a.photos)).slice(0, 10), // Unique photos, limit 10
      })) as ProdRegiao[];
    },
    enabled: !!projetoId,
  });

  const maxValue = useMemo(() => {
    return Math.max(...regioes.map((r) => r[metrica]), 1);
  }, [regioes, metrica]);

  const chartData = useMemo(() => {
    return [...regioes]
      .sort((a, b) => b[metrica] - a[metrica])
      .slice(0, 15)
      .map((r) => ({
        name: `${r.municipio}/${r.uf}`,
        value: Math.round(r[metrica] * 100) / 100,
        color: getColor(r[metrica], maxValue),
      }));
  }, [regioes, metrica, maxValue]);

  const METRICA_LABELS: Record<string, string> = {
    totalQuantidade: "Quantidade Total",
    totalItens: "Nº Lançamentos",
    avgQuantidade: "Média por Lançamento",
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="w-52">
          <label className="text-xs font-medium mb-1 block">Métrica</label>
          <Select value={metrica} onValueChange={(v) => setMetrica(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="totalQuantidade">Quantidade Total</SelectItem>
              <SelectItem value="totalItens">Nº de Lançamentos</SelectItem>
              <SelectItem value="avgQuantidade">Média por Lançamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 ml-auto text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" /> Alta
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" /> Média
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500" /> Baixa
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" /> Crítica
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 480 }}>
        {/* Map */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="p-0 h-full" style={{ minHeight: 420 }}>
              {regioes.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  <div className="text-center">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum dado de produção com localização encontrado</p>
                    <p className="text-xs mt-1">Registre produções com município para visualizar no mapa</p>
                  </div>
                </div>
              ) : (
                <MapContainer
                  center={[-14.235, -51.9253]}
                  zoom={5}
                  style={{ height: "100%", width: "100%", borderRadius: "inherit" }}
                  className="z-0"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitBoundsRegiao regioes={regioes} />

                  {regioes.map((r) => (
                    <CircleMarker
                      key={r.municipio}
                      center={[r.latitude, r.longitude]}
                      radius={getRadius(r[metrica], maxValue)}
                      pathOptions={{
                        fillColor: getColor(r[metrica], maxValue),
                        color: "white",
                        weight: 2,
                        fillOpacity: 0.75,
                      }}
                    >
                      <Popup>
                        <div className="text-xs space-y-2">
                          <p className="font-bold border-b pb-1">{r.municipio}/{r.uf}</p>
                          <div className="space-y-0.5">
                            <p>Quantidade Total: <strong>{r.totalQuantidade.toLocaleString("pt-BR")}</strong></p>
                            <p>Lançamentos: <strong>{r.totalItens}</strong></p>
                            <p>Média: <strong>{r.avgQuantidade.toFixed(1)}</strong></p>
                          </div>
                          
                          {r.photos.length > 0 && (
                            <div className="space-y-1 pt-1">
                              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Fotos do Diário</p>
                              <div className="grid grid-cols-2 gap-1 max-w-[140px]">
                                {r.photos.slice(0, 4).map((url, i) => (
                                  <img key={i} src={url} className="w-full h-12 object-cover rounded shadow-sm border" alt="" />
                                ))}
                              </div>
                              {r.photos.length > 4 && (
                                <p className="text-[10px] text-muted-foreground">+{r.photos.length - 4} fotos</p>
                              )}
                            </div>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chart ranking */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" />
                Ranking por Município
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">{METRICA_LABELS[metrica]}</p>
            </CardHeader>
            <CardContent className="p-0 pr-2">
              {chartData.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">
                  Sem dados
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={120}
                      tick={{ fontSize: 10 }}
                    />
                    <ReTooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(value: number) => [value.toLocaleString("pt-BR"), METRICA_LABELS[metrica]]}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Summary stats */}
      {regioes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Regiões</p>
                <p className="text-lg font-bold">{regioes.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total Produzido</p>
                <p className="text-lg font-bold">
                  {regioes.reduce((s, r) => s + r.totalQuantidade, 0).toLocaleString("pt-BR")}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Região Mais Produtiva</p>
                <p className="text-sm font-bold truncate">
                  {regioes.length > 0
                    ? [...regioes].sort((a, b) => b.totalQuantidade - a.totalQuantidade)[0].municipio
                    : "—"
                  }
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Média Geral</p>
                <p className="text-lg font-bold">
                  {(regioes.reduce((s, r) => s + r.avgQuantidade, 0) / Math.max(regioes.length, 1)).toFixed(1)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
