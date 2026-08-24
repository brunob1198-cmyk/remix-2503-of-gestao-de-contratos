import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, ImagePlus, Loader2, MapPin, MapPinOff, AlertTriangle } from "lucide-react";
import { getCurrentDeviceLocation } from "@/utils/geolocationUtils";
import {
  seloDaFoto,
  type OrigemFoto,
  type CoordenadaFoto,
} from "@/utils/fotoGeolocalizada";

/**
 * Captura de foto de campo, com câmera e com geolocalização no instante da foto.
 *
 * Dois problemas que este componente resolve, e que existiam em todas as telas:
 *
 * 1. **Não havia como tirar foto.** Todos os campos de imagem do projeto eram
 *    `<input type="file">` sem `capture`, o que no celular abre o seletor de
 *    arquivos. Quem está na frente do andaime tinha de sair do app, abrir a
 *    câmera, voltar e procurar o arquivo. O único lugar com `capture` era o Diário
 *    de Campo.
 *
 * 2. **A coordenada era da aplicação, não da foto.** O checklist registrava onde a
 *    pessoa estava ao abrir e ao fechar. Entre os dois momentos passam horas e
 *    quilômetros, e a auditoria pergunta onde ESTA foto foi tirada.
 *
 * Duas decisões de comportamento:
 *
 * - **A falta de GPS não bloqueia a foto.** Bloquear deixaria o inspetor sem
 *   registrar o desvio, que é o oposto do objetivo. A foto entra marcada como sem
 *   localização, com o motivo — permissão negada pesa diferente de sinal ausente.
 *
 * - **A coordenada é buscada em paralelo com a leitura do arquivo**, e não antes.
 *   Esperar o GPS para só então aceitar a imagem faria o usuário olhar um spinner
 *   por até dez segundos com a foto já tirada na mão.
 */

export interface FotoCapturada {
  arquivo: File;
  origem: OrigemFoto;
  capturadaEm: string;
  coordenada: CoordenadaFoto | null;
  motivoSemGeo: string | null;
}

interface CapturaFotoCampoProps {
  onCapturar: (foto: FotoCapturada) => void | Promise<void>;
  /** Desabilita os dois botões — por exemplo durante o envio. */
  disabled?: boolean;
  /** Rótulo do botão da câmera. */
  rotuloCamera?: string;
  rotuloArquivo?: string;
  /**
   * Falso desliga a captura de coordenada. Use em foto que não é evidência de
   * campo — foto de perfil, logo, digitalização de documento.
   */
  comGeolocalizacao?: boolean;
  /** Aceita mais de um arquivo na escolha pela galeria. */
  multiplo?: boolean;
  className?: string;
}

export function CapturaFotoCampo({
  onCapturar,
  disabled = false,
  rotuloCamera = "Tirar foto",
  rotuloArquivo = "Escolher arquivo",
  comGeolocalizacao = true,
  multiplo = false,
  className,
}: CapturaFotoCampoProps) {
  const inputCamera = useRef<HTMLInputElement>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [ocupado, setOcupado] = useState(false);
  const [ultimoSelo, setUltimoSelo] = useState<ReturnType<typeof seloDaFoto> | null>(null);

  const capturarCoordenada = async (): Promise<{
    coordenada: CoordenadaFoto | null;
    motivo: string | null;
  }> => {
    if (!comGeolocalizacao) return { coordenada: null, motivo: null };

    try {
      const coords = await getCurrentDeviceLocation();
      return {
        coordenada: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          precisao: coords.accuracy ?? null,
        },
        motivo: null,
      };
    } catch (e) {
      // A mensagem de `getCurrentDeviceLocation` já distingue permissão negada,
      // sinal indisponível e tempo esgotado — e essa distinção é o que faz a
      // ausência ser interpretável depois.
      return { coordenada: null, motivo: (e as Error).message };
    }
  };

  const processar = async (arquivos: FileList | null, origem: OrigemFoto) => {
    if (!arquivos || arquivos.length === 0) return;

    setOcupado(true);
    try {
      // Uma única leitura de coordenada para o lote: fotos escolhidas juntas foram
      // tiradas no mesmo lugar, e pedir o GPS uma vez por arquivo só atrasaria.
      const { coordenada, motivo } = await capturarCoordenada();
      const capturadaEm = new Date().toISOString();

      for (const arquivo of Array.from(arquivos)) {
        await onCapturar({
          arquivo,
          origem,
          capturadaEm,
          coordenada,
          motivoSemGeo: motivo,
        });
      }

      setUltimoSelo(
        seloDaFoto({ coord: coordenada, capturadaEm, origem, motivoSemCoordenada: motivo })
      );
    } finally {
      setOcupado(false);
      // Limpa para que escolher o MESMO arquivo outra vez volte a disparar o
      // `onChange` — sem isto, refazer a foto do mesmo item não funciona.
      if (inputCamera.current) inputCamera.current.value = "";
      if (inputArquivo.current) inputArquivo.current.value = "";
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {/* `capture="environment"` abre a câmera traseira direto no celular. É a
            diferença entre registrar o desvio na hora e sair do app para fotografar. */}
        <input
          ref={inputCamera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => processar(e.target.files, "CAMERA")}
        />
        <input
          ref={inputArquivo}
          type="file"
          accept="image/*"
          multiple={multiplo}
          className="hidden"
          onChange={(e) => processar(e.target.files, "ARQUIVO")}
        />

        <Button
          type="button"
          size="sm"
          variant="default"
          className="gap-1.5"
          disabled={disabled || ocupado}
          onClick={() => inputCamera.current?.click()}
        >
          {ocupado ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          {rotuloCamera}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={disabled || ocupado}
          onClick={() => inputArquivo.current?.click()}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {rotuloArquivo}
        </Button>

        {comGeolocalizacao && (
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            a localização é registrada no momento da foto
          </span>
        )}
      </div>

      {/* O selo da última captura fica visível: o inspetor confere na hora se a
          coordenada saiu, em vez de descobrir na auditoria que não saiu. */}
      {ultimoSelo && (
        <div
          className={`mt-2 flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-[11px] ${
            ultimoSelo.alerta
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {ultimoSelo.qualidade === "SEM_COORDENADA" ? (
            <MapPinOff className="h-3.5 w-3.5 shrink-0 mt-px" />
          ) : ultimoSelo.alerta ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
          ) : (
            <MapPin className="h-3.5 w-3.5 shrink-0 mt-px" />
          )}
          <span>{ultimoSelo.texto}</span>
        </div>
      )}
    </div>
  );
}
