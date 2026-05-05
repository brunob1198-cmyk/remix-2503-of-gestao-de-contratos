import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { TimelineEvento } from "@/hooks/useTimelineEventos";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

// Fix leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const TIPO_HEX: Record<string, string> = {
  producao: "#10b981",
  medicao: "#3b82f6",
  foto: "#f59e0b",
  problema: "#ef4444",
};

function createColoredIcon(tipo: string, isActive: boolean = false) {
  const color = TIPO_HEX[tipo] || "#6b7280";
  const size = isActive ? 16 : 10;
  const border = isActive ? 3 : 2;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${color};
      border:${border}px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
      ${isActive ? 'animation:pulse 1s infinite;' : ''}
    "></div>
    <style>@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}</style>`,
    iconSize: [size + border * 2, size + border * 2],
    iconAnchor: [(size + border * 2) / 2, (size + border * 2) / 2],
  });
}

function InvalidateMapSize({ trigger }: { trigger: any }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map, trigger]);

  return null;
}

function FitBounds({ eventos }: { eventos: TimelineEvento[] }) {
  const map = useMap();
  useEffect(() => {
    const positionedEvents = eventos.filter(
      (evento) => evento.latitude !== null && evento.longitude !== null
    );

    if (positionedEvents.length === 0) return;

    const bounds = L.latLngBounds(
      positionedEvents.map((e) => [e.latitude!, e.longitude!] as [number, number])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [eventos, map]);
  return null;
}

function FlyToActive({ evento }: { evento: TimelineEvento | null }) {
  const map = useMap();
  useEffect(() => {
    if (evento?.latitude !== null && evento?.latitude !== undefined && evento?.longitude !== null && evento?.longitude !== undefined) {
      map.flyTo([evento.latitude, evento.longitude], 15, { duration: 0.8 });
    }
  }, [evento, map]);
  return null;
}

interface TimelineMapProps {
  eventos: TimelineEvento[];
  activeEvento: TimelineEvento | null;
  onSelectEvento: (e: TimelineEvento) => void;
  onUpdateEvento?: () => void;
}

export function TimelineMap({ eventos, activeEvento, onSelectEvento, onUpdateEvento }: TimelineMapProps) {
  const defaultCenter: [number, number] = [-14.235, -51.9253]; // Brazil center

  const handleDragEnd = async (evtId: string, tipo: string, latlng: L.LatLng) => {
    if (tipo !== "foto") {
      toast.info("Apenas fotos podem ter sua geolocalização ajustada manualmente por enquanto.");
      return;
    }

    try {
      const { error } = await supabase
        .from("foto_geolocalizacao_ajustes")
        .upsert({
          foto_id: evtId,
          latitude: latlng.lat,
          longitude: latlng.lng,
          updated_at: new Date().toISOString()
        }, { onConflict: 'foto_id' });

      if (error) throw error;
      toast.success("Posição salva com sucesso!");
      onUpdateEvento?.();
    } catch (error: any) {
      console.error("Erro ao salvar correção:", error);
      toast.error("Falha ao salvar a nova posição.");
    }
  };

  if (eventos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Nenhum evento com coordenadas para exibir no mapa
      </div>
    );
  }

  return (
    <MapContainer
      center={defaultCenter}
      zoom={5}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%", minHeight: "480px", borderRadius: "inherit" }}
      className="z-0 h-full w-full"
      preferCanvas={true}
    >
      <InvalidateMapSize trigger={eventos.length + (activeEvento?.id || "")} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds eventos={eventos} />
      <FlyToActive evento={activeEvento} />

      {eventos.map((evt) => (
        <Marker
          key={evt.id}
          position={[evt.latitude!, evt.longitude!]}
          icon={createColoredIcon(evt.tipo, activeEvento?.id === evt.id)}
          draggable={evt.tipo === "foto"}
          eventHandlers={{
            click: () => onSelectEvento(evt),
            dragend: (e) => {
              const marker = e.target;
              handleDragEnd(evt.id, evt.tipo, marker.getLatLng());
            }
          }}
        >
          <Popup>
            <div className="text-xs space-y-2 max-w-[200px]">
              <p className="font-bold border-b pb-1">{evt.item || evt.tipo}</p>
              
              {evt.imagem_url && (
                <div className="rounded overflow-hidden border bg-muted aspect-video flex items-center justify-center">
                  <img 
                    src={evt.imagem_thumb_url || evt.imagem_url} 
                    alt="evidência" 
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(evt.imagem_url!, '_blank')}
                  />
                </div>
              )}

              <div className="space-y-0.5">
                <p><span className="text-muted-foreground">Data:</span> {format(parseISO(evt.data), "dd/MM/yyyy")}</p>
                {evt.quantidade > 0 && <p><span className="text-muted-foreground">Qtd:</span> {evt.quantidade}</p>}
                {evt.coord_source && (
                  <p className="text-[10px] text-muted-foreground mt-1 italic">
                    Fonte: {evt.coord_source}
                  </p>
                )}
                {evt.tipo === "foto" && (
                  <p className="text-[10px] text-primary mt-1 font-medium">
                    Arraste o ponto para corrigir a posição
                  </p>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
