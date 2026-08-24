import React from "react";
import { cn } from "@/lib/utils";
import { seloDaFoto } from "@/utils/fotoGeolocalizada";

/**
 * Onde, quando e por qual meio a foto foi feita, debaixo da miniatura.
 *
 * Existe para a conferência acontecer ANTES do documento sair. Quem revisa o
 * diário do dia vê na hora qual foto não tem localização, em vez de descobrir na
 * glosa da medição — que é quando a foto que o fiscal não reconhece deixa de valer.
 *
 * A decisão que importa aqui: **foto sem nenhum metadado não recebe selo nenhum.**
 * Todo o histórico do projeto foi gravado antes de a coordenada existir, e escrever
 * "sem localização" numa foto de 2025 acusaria de falta algo que o sistema nem
 * pedia. Ausência de selo e selo dizendo ausência são coisas diferentes: a segunda
 * é uma afirmação sobre uma captura que tentou registrar e não conseguiu.
 */

export interface FotoComGeolocalizacao {
  latitude?: number | null;
  longitude?: number | null;
  precisao_metros?: number | null;
  capturada_em?: string | null;
  origem_captura?: "CAMERA" | "ARQUIVO" | null;
  motivo_sem_geo?: string | null;
}

/** Verdadeiro quando a foto foi gravada por uma versão que registra captura. */
export function temMetadadoDeCaptura(foto: FotoComGeolocalizacao): boolean {
  return (
    foto.latitude != null ||
    !!foto.capturada_em ||
    !!foto.origem_captura ||
    !!foto.motivo_sem_geo
  );
}

export const SeloDaFotoNaMiniatura = React.memo(function SeloDaFotoNaMiniatura({
  foto,
  className,
}: {
  foto: FotoComGeolocalizacao;
  className?: string;
}) {
  if (!temMetadadoDeCaptura(foto)) return null;

  const selo = seloDaFoto({
    coord: {
      latitude: foto.latitude,
      longitude: foto.longitude,
      precisao: foto.precisao_metros,
    },
    capturadaEm: foto.capturada_em,
    origem: foto.origem_captura,
    motivoSemCoordenada: foto.motivo_sem_geo,
  });

  return (
    <p
      className={cn(
        "px-2 pt-1 text-[10px] leading-snug",
        selo.alerta ? "text-amber-700" : "text-muted-foreground",
        className
      )}
      title={selo.texto}
    >
      {selo.texto}
    </p>
  );
});
