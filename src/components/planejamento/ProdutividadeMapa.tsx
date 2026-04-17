import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell } from "recharts";
import { MapPin, BarChart3, TrendingUp } from "lucide-react";
import { resolveCoordsFromPhotos } from "@/lib/photoGeolocation";

interface ProdutividadeMapaProps {
  projetoId: string;
  siteFilter?: string;
}

interface ProdRegiao {
  municipio: string;
  uf: string;
  latitude: number | null;
  longitude: number | null;
  totalQuantidade: number;
  totalValor: number;
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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function ProdutividadeMapa({ projetoId, siteFilter }: ProdutividadeMapaProps) {
  const [metrica, setMetrica] = useState<"totalValor" | "totalQuantidade" | "totalItens" | "avgQuantidade">("totalValor");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const { data: regioes = [], isLoading } = useQuery({
    queryKey: ["produtividade-mapa", projetoId, siteFilter, dataInicio, dataFim],
    queryFn: async () => {
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

      // Get diaries with optional date filter
      let queryDiarios = supabase
        .from("diarios_obra")
        .select("id, site_id, municipio, uf, data")
        .in("site_id", siteIds);
      if (dataInicio) queryDiarios = queryDiarios.gte("data", dataInicio);
      if (dataFim) queryDiarios = queryDiarios.lte("data", dataFim);

      const { data: diariosGeral } = await queryDiarios;
      if (!diariosGeral?.length) return [];

      const diarioIds = diariosGeral.map(d => d.id);
      const diarioMap = Object.fromEntries(diariosGeral.map(d => [d.id, d]));

      // Get production with valor_total
      const { data: prods } = await supabase
        .from("diario_producao")
        .select("diario_id, quantidade, valor_total")
        .in("diario_id", diarioIds);
      if (!prods?.length) return [];

      const { data: photosData } = await supabase
        .from("diario_fotos")
        .select("diario_id, url")
        .in("diario_id", diarioIds);

      // Get municipality coordinates
      const municipios = new Set<string>();
      prods.forEach((p: any) => {
        const dInfo = diarioMap[p.diario_id];
        const mun = dInfo?.municipio || sites.find((s) => s.id === dInfo?.site_id)?.municipio;
        const uf = dInfo?.uf || sites.find((s) => s.id === dInfo?.site_id)?.uf;
        if (mun && uf) municipios.add(`${mun}__${uf}`);
      });

      const munEntries = Array.from(municipios).map((entry) => {
        const [nome, uf] = entry.split("__");
        return { nome, uf };
      });
      let munCoords: Record<string, { lat: number; lng: number; uf: string }> = {};

      if (munEntries.length > 0) {
        const { data: ibge } = await supabase
          .from("municipios_ibge")
          .select("nome, uf, latitude, longitude")
          .in("nome", munEntries.map((entry) => entry.nome))
          .in("uf", munEntries.map((entry) => entry.uf));

        (ibge ?? []).forEach((m) => {
          if (m.latitude && m.longitude) {
            munCoords[`${m.nome}__${m.uf}`] = { lat: Number(m.latitude), lng: Number(m.longitude), uf: m.uf };
          }
        });
      }

      // Aggregate by municipality
      const aggMap: Record<string, { mun: string; uf: string; lat: number | null; lng: number | null; total: number; totalValor: number; count: number; photos: string[] }> = {};

      const photosByMunicipio: Record<string, string[]> = {};
      (photosData ?? []).forEach((photo) => {
        const dInfo = diarioMap[photo.diario_id];
        if (!dInfo) return;
        const mun = dInfo.municipio || sites.find((s) => s.id === dInfo.site_id)?.municipio || "";
        const uf = dInfo.uf || sites.find((s) => s.id === dInfo.site_id)?.uf || "";
        if (!mun || !uf) return;
        const key = `${mun}__${uf}`;
        photosByMunicipio[key] = [...(photosByMunicipio[key] || []), photo.url];
      });

      prods.forEach((p: any) => {
        const dInfo = diarioMap[p.diario_id];
        if (!dInfo) return;
        const mun = dInfo.municipio || sites.find((s) => s.id === dInfo.site_id)?.municipio || "";
        const uf = dInfo.uf || sites.find((s) => s.id === dInfo.site_id)?.uf || "";
        if (!mun) return;

        const key = `${mun}__${uf}`;
        const coords = munCoords[key];

        if (!aggMap[key]) {
          aggMap[key] = {
            mun,
            uf,
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
            total: 0,
            totalValor: 0,
            count: 0,
            photos: Array.from(new Set(photosByMunicipio[key] || [])),
          };
        }
        aggMap[key].total += Number(p.quantidade);
        aggMap[key].totalValor += Number(p.valor_total) || 0;
        aggMap[key].count += 1;
      });

      const regioesBase = Object.values(aggMap);

      // Fallback: EXIF coords from photos
      await Promise.all(
        regioesBase
          .filter((r) => (r.lat === null || r.lng === null) && r.photos.length > 0)
          .map(async (r) => {
            const coordsFromPhoto = await getCoordinatesFromPhotos(r.photos);
            if (coordsFromPhoto) {
              r.lat = coordsFromPhoto.lat;
              r.lng = coordsFromPhoto.lng;
            }
          })
      );

      // Fallback: Nominatim
      const missingCoords = regioesBase.filter((r) => r.lat === null || r.lng === null);
      if (missingCoords.length > 0) {
        await Promise.all(
          missingCoords.map(async (regiao) => {
            try {
              const q = encodeURIComponent(`${regiao.mun} ${regiao.uf} Brazil`);
              const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
                headers: { "User-Agent": "LovableApp/1.0" },
              });
              const data = await resp.json();
              if (data?.[0]?.lat && data?.[0]?.lon) {
                regiao.lat = Number(data[0].lat);
                regiao.lng = Number(data[0].lon);
              }
            } catch (e) {
              console.warn(`Nominatim fallback failed for ${regiao.mun}/${regiao.uf}`, e);
            }
          })
        );
      }

      return regioesBase.map((a) => ({
        municipio: a.mun,
        uf: a.uf,
        latitude: a.lat,
        longitude: a.lng,
        totalQuantidade: a.total,
        totalValor: a.totalValor,
        totalItens: a.count,
        avgQuantidade: a.count > 0 ? a.total / a.count : 0,
        photos: Array.from(new Set(a.photos)).slice(0, 10),
      })) as ProdRegiao[];
    },
    enabled: !!projetoId,
  });

  const mapRegioes = useMemo(
    () => regioes.filter((r) => r.latitude !== null && r.longitude !== null) as Array<ProdRegiao & { latitude: number; longitude: number }>,
    [regioes]
  );

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
    totalValor: "Valor Total (R$)",
    totalQuantidade: "Quantidade Total",
    totalItens: "Nº Lançamentos",
    avgQuantidade: "Média por Lançamento",
  };

  const isValorMetrica = metrica === "totalValor";

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Label className="text-xs font-medium mb-1 block">Métrica</Label>
          <Select value={metrica} onValueChange={(v) => setMetrica(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="totalValor">Valor Total (R$)</SelectItem>
              <SelectItem value="totalQuantidade">Quantidade Total</SelectItem>
              <SelectItem value="totalItens">Nº de Lançamentos</SelectItem>
              <SelectItem value="avgQuantidade">Média por Lançamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium mb-1 block">Data Início</Label>
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-[140px] h-9"
          />
        </div>
        <div>
          <Label className="text-xs font-medium mb-1 block">Data Fim</Label>
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-[140px] h-9"
          />
        </div>
        {(dataInicio || dataFim) && (
          <button
            onClick={() => { setDataInicio(""); setDataFim(""); }}
            className="text-xs text-primary hover:underline pb-2"
          >
            Limpar
          </button>
        )}
        <div className="flex items-center gap-3 ml-auto text-xs pb-2">
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
              ) : mapRegioes.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  <div className="text-center max-w-xs">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Os dados do Diário foram encontrados, mas ainda sem coordenadas válidas para o mapa.</p>
                    <p className="text-xs mt-1">O ranking e as fotos já estão sendo exibidos ao lado.</p>
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
                  <FitBoundsRegiao regioes={mapRegioes} />
                  {mapRegioes.map((r) => (
                    <CircleMarker
                      key={`${r.municipio}-${r.uf}`}
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
                            <p>Valor Total: <strong>{formatCurrency(r.totalValor)}</strong></p>
                            <p>Quantidade Total: <strong>{r.totalQuantidade.toLocaleString("pt-BR")}</strong></p>
                            <p>Lançamentos: <strong>{r.totalItens}</strong></p>
                            <p>Média: <strong>{r.avgQuantidade.toFixed(1)}</strong></p>
                          </div>
                          {r.photos.length > 0 && (
                            <div className="space-y-1 pt-1">
                              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Fotos do Diário</p>
                              <div className="grid grid-cols-2 gap-1 max-w-[140px]">
                                {r.photos.slice(0, 4).map((url, i) => (
                                  <img key={i} src={url} className="w-full h-12 object-cover rounded shadow-sm border" alt={`Foto do diário em ${r.municipio}`} />
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
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickFormatter={isValorMetrica ? (v) => `R$ ${(v / 1000).toFixed(0)}k` : undefined}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={120}
                      tick={{ fontSize: 10 }}
                    />
                    <ReTooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(value: number) => [
                        isValorMetrica ? formatCurrency(value) : value.toLocaleString("pt-BR"),
                        METRICA_LABELS[metrica],
                      ]}
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
                <p className="text-xs text-muted-foreground">Valor Total Produzido</p>
                <p className="text-lg font-bold">
                  {formatCurrency(regioes.reduce((s, r) => s + r.totalValor, 0))}
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
                    ? [...regioes].sort((a, b) => b.totalValor - a.totalValor)[0].municipio
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
