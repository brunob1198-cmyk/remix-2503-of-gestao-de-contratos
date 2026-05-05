import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTimelineEventos, TimelineEvento } from "@/hooks/useTimelineEventos";
import { TimelineMap } from "./TimelineMap";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { format, parseISO, eachDayOfInterval, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Play, Pause, SkipForward, MapPin, Calendar, List, Filter,
  Image as ImageIcon, ChevronLeft, ChevronRight, X, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const TIPO_COLORS: Record<string, string> = {
  producao: "bg-emerald-500",
  medicao: "bg-blue-500",
  foto: "bg-amber-500",
  problema: "bg-red-500",
};

const TIPO_LABELS: Record<string, string> = {
  producao: "Produção",
  medicao: "Medição",
  foto: "Foto",
  problema: "Problema",
};

interface TimelineObraProps {
  projetoId: string;
  siteFilter?: string[];
  sites?: Array<{ id: string; nome: string; codigo?: string }>;
}

export function TimelineObra({ projetoId, siteFilter, sites = [] }: TimelineObraProps) {
  const [selectedSites, setSelectedSites] = useState<string[]>(siteFilter ?? []);
  const [filters, setFilters] = useState<{
    dateStart?: string;
    dateEnd?: string;
    tipo?: string;
    item?: string;
  }>({});

  const combinedFilters = useMemo(() => {
    return { ...filters, siteFilter: selectedSites.length > 0 ? selectedSites : undefined };
  }, [filters, selectedSites]);

  // Sync external siteFilter prop
  useEffect(() => {
    if (siteFilter && siteFilter.length > 0) {
      setSelectedSites(siteFilter);
    }
  }, [siteFilter]);

  const { data: eventos = [], isLoading, refetch } = useTimelineEventos(projetoId, combinedFilters);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedEvento, setSelectedEvento] = useState<TimelineEvento | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [playIndex, setPlayIndex] = useState(0);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const playRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  // Unique days
  const days = useMemo(() => {
    const daySet = new Set(eventos.map((e) => e.data));
    return Array.from(daySet).sort();
  }, [eventos]);

  // Events for selected day
  const dayEvents = useMemo(() => {
    if (!selectedDay) return eventos;
    return eventos.filter((e) => e.data === selectedDay);
  }, [eventos, selectedDay]);

  // Events with coordinates for map
  const mapEvents = useMemo(() => {
    return dayEvents.filter((e) => e.latitude !== null && e.longitude !== null);
  }, [dayEvents]);

  // Grouped by day
  const groupedEvents = useMemo(() => {
    const groups: Record<string, TimelineEvento[]> = {};
    dayEvents.forEach((e) => {
      if (!groups[e.data]) groups[e.data] = [];
      groups[e.data].push(e);
    });
    return groups;
  }, [dayEvents]);

  // Playback logic
  useEffect(() => {
    if (isPlaying && mapEvents.length > 0) {
      const delay = 1500 / playSpeed;
      playRef.current = setTimeout(() => {
        setPlayIndex((prev) => {
          if (prev >= mapEvents.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
    }
    return () => {
      if (playRef.current) clearTimeout(playRef.current);
    };
  }, [isPlaying, playIndex, mapEvents.length, playSpeed]);

  const handlePlay = () => {
    if (playIndex >= mapEvents.length - 1) setPlayIndex(0);
    setIsPlaying(true);
  };

  const activePlayEvent = isPlaying || playIndex > 0 ? mapEvents[playIndex] : null;

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Multi-site selector */}
        {sites.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              variant={selectedSites.length === 0 ? "default" : "outline"}
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setSelectedSites([])}
            >
              Todos os sites
            </Button>
            {sites.map((s) => (
              <Button
                key={s.id}
                variant={selectedSites.includes(s.id) ? "default" : "outline"}
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => {
                  setSelectedSites((prev) =>
                    prev.includes(s.id)
                      ? prev.filter((x) => x !== s.id)
                      : [...prev, s.id]
                  );
                }}
              >
                {s.codigo || s.nome}
              </Button>
            ))}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-1" /> Filtros
        </Button>

        <Button variant="outline" size="sm" onClick={() => setShowDiagnostic(true)}>
          <Info className="h-4 w-4 mr-1" /> Diagnóstico
        </Button>

        {selectedDay && (
          <Badge variant="secondary" className="gap-1">
            {format(parseISO(selectedDay), "dd/MM/yyyy")}
            <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedDay(null)} />
          </Badge>
        )}

        {/* Legend */}
        <div className="flex gap-3 ml-auto text-xs">
          {Object.entries(TIPO_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={cn("w-2.5 h-2.5 rounded-full", TIPO_COLORS[key])} />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="py-3 flex flex-wrap gap-3 items-end">
            <div className="w-40">
              <label className="text-xs font-medium mb-1 block">Data Início</label>
              <Input
                type="date"
                value={filters.dateStart || ""}
                onChange={(e) => setFilters((f) => ({ ...f, dateStart: e.target.value || undefined }))}
              />
            </div>
            <div className="w-40">
              <label className="text-xs font-medium mb-1 block">Data Fim</label>
              <Input
                type="date"
                value={filters.dateEnd || ""}
                onChange={(e) => setFilters((f) => ({ ...f, dateEnd: e.target.value || undefined }))}
              />
            </div>
            <div className="w-40">
              <label className="text-xs font-medium mb-1 block">Tipo</label>
              <Select value={filters.tipo || "all"} onValueChange={(v) => setFilters((f) => ({ ...f, tipo: v === "all" ? undefined : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <label className="text-xs font-medium mb-1 block">Item</label>
              <Input
                placeholder="Buscar item..."
                value={filters.item || ""}
                onChange={(e) => setFilters((f) => ({ ...f, item: e.target.value || undefined }))}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({})}
            >
              Limpar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main layout: Map + events */}
      <div className="h-[480px]">
        <Card className="h-full overflow-hidden">
          <CardContent className="h-full p-0">
            <TimelineMap
              eventos={mapEvents}
              activeEvento={activePlayEvent}
              onSelectEvento={setSelectedEvento}
              onUpdateEvento={refetch}
            />
          </CardContent>
        </Card>
      </div>

      {/* Horizontal timeline + playback controls */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            {/* Playback controls */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {isPlaying ? (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsPlaying(false)}>
                  <Pause className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handlePlay} disabled={mapEvents.length === 0}>
                  <Play className="h-4 w-4" />
                </Button>
              )}
              <Select value={String(playSpeed)} onValueChange={(v) => setPlaySpeed(Number(v))}>
                <SelectTrigger className="h-8 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                  <SelectItem value="5">5x</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Timeline scroll */}
            <div className="flex-1 overflow-hidden">
              <div
                ref={timelineScrollRef}
                className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin"
              >
                <Button
                  variant={!selectedDay ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[11px] flex-shrink-0"
                  onClick={() => setSelectedDay(null)}
                >
                  Todos
                </Button>
                {days.map((day) => (
                  <Button
                    key={day}
                    variant={selectedDay === day ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-7 text-[11px] flex-shrink-0",
                      selectedDay === day && "ring-2 ring-primary"
                    )}
                    onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  >
                    {format(parseISO(day), "dd/MM")}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {isPlaying && mapEvents.length > 0 && (
            <div className="mt-2">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${((playIndex + 1) / mapEvents.length) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Evento {playIndex + 1} de {mapEvents.length}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <Sheet open={!!selectedEvento} onOpenChange={(open) => !open && setSelectedEvento(null)}>
        <SheetContent className="w-[400px] sm:w-[460px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <div className={cn("w-3 h-3 rounded-full", TIPO_COLORS[selectedEvento?.tipo || ""])} />
              {TIPO_LABELS[selectedEvento?.tipo || ""] || selectedEvento?.tipo}
            </SheetTitle>
          </SheetHeader>
          {selectedEvento && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Data</p>
                  <p className="font-medium">{format(parseISO(selectedEvento.data), "dd/MM/yyyy")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant={selectedEvento.status === "rejeitado" || selectedEvento.status === "problema" ? "destructive" : "secondary"}>
                    {selectedEvento.status}
                  </Badge>
                </div>
                {selectedEvento.item && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Item</p>
                    <p className="font-medium">{selectedEvento.item}</p>
                  </div>
                )}
                {selectedEvento.quantidade > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs">Quantidade</p>
                    <p className="font-medium">{selectedEvento.quantidade}</p>
                  </div>
                )}
                {selectedEvento.equipe_nome && (
                  <div>
                    <p className="text-muted-foreground text-xs">Equipe</p>
                    <p className="font-medium">{selectedEvento.equipe_nome}</p>
                  </div>
                )}
                {selectedEvento.latitude && selectedEvento.longitude && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Localização</p>
                    <p className="font-medium flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedEvento.latitude.toFixed(6)}, {selectedEvento.longitude.toFixed(6)}
                    </p>
                  </div>
                )}
              </div>

              {selectedEvento.observacao && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Observações</p>
                  <p className="text-sm bg-muted/50 rounded-md p-2">{selectedEvento.observacao}</p>
                </div>
              )}

              {selectedEvento.imagem_url && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Imagem</p>
                  <img
                    src={selectedEvento.imagem_url}
                    alt="Evidência"
                    className="rounded-lg w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setFullScreenImage(selectedEvento.imagem_url)}
                  />
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Full screen image */}
      <Dialog open={!!fullScreenImage} onOpenChange={(open) => !open && setFullScreenImage(null)}>
        <DialogContent className="max-w-4xl p-2">
          {fullScreenImage && (
            <img src={fullScreenImage} alt="Evidência" className="w-full h-auto rounded-md" />
          )}
        </DialogContent>
      </Dialog>

      {/* Diagnostic Dialog */}
      <Dialog open={showDiagnostic} onOpenChange={setShowDiagnostic}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>Diagnóstico de Geolocalização</SheetTitle>
          </SheetHeader>
          <div className="overflow-hidden flex-1 flex flex-col mt-4">
            <ScrollArea className="flex-1">
              <div className="space-y-4">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left">Miniatura</th>
                      <th className="p-2 text-left">Item/Data</th>
                      <th className="p-2 text-left">Fonte das Coordenadas</th>
                      <th className="p-2 text-left">Lat/Lng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventos.filter(e => e.tipo === "foto").map((e) => (
                      <tr key={e.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-2">
                          {e.imagem_url ? (
                            <img 
                              src={e.imagem_url} 
                              alt="" 
                              className="w-12 h-12 object-cover rounded cursor-pointer" 
                              onClick={() => setFullScreenImage(e.imagem_url)}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="font-medium">{e.item}</div>
                          <div className="text-xs text-muted-foreground">{format(parseISO(e.data), "dd/MM/yyyy")}</div>
                        </td>
                        <td className="p-2">
                          <Badge variant={e.coord_source === "Ajuste Manual" ? "default" : "secondary"} className="text-[10px]">
                            {e.coord_source || "N/A"}
                          </Badge>
                        </td>
                        <td className="p-2 font-mono text-xs">
                          {e.latitude ? (
                            <>
                              {e.latitude.toFixed(6)},<br />{e.longitude?.toFixed(6)}
                            </>
                          ) : (
                            <span className="text-destructive italic">Não posicionada</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {eventos.filter(e => e.tipo === "foto").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma foto encontrada no período selecionado.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
