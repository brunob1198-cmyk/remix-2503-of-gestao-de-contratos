import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Trash2, ExternalLink, MapPin, MapPinOff, Loader2 } from "lucide-react";
import { CapturaFotoCampo, type FotoCapturada } from "@/components/comum/CapturaFotoCampo";
import { uploadImage } from "@/services/uploadImage";
import { resolveFileUrl } from "@/utils/fileUrlResolver";
import { SgsstErrorState } from "@/components/sgsst/SgsstStateFeedback";
import { seloDaFoto, linkDoMapa } from "@/utils/fotoGeolocalizada";
import {
  useSgsstEvidencias,
  type EntidadeEvidencia,
} from "@/hooks/sgsst/useSgsstEvidencias";
import { toast } from "sonner";

/**
 * Painel de evidência fotográfica, para qualquer registro do SGSST.
 *
 * Um componente para as doze entidades, pelo mesmo motivo de haver uma tabela só:
 * a interação é idêntica em todas — tirar a foto, ver onde e quando foi tirada,
 * escrever a legenda, remover a errada.
 *
 * Duas decisões de comportamento:
 *
 * - **A legenda é salva ao sair do campo**, não a cada tecla. Escrever legenda
 *   dispara um `UPDATE` por caractere se salvar no `onChange`.
 *
 * - **A foto sem localização não é escondida nem recusada.** Ela aparece com o selo
 *   dizendo que não há coordenada e o motivo. Recusar deixaria o inspetor sem
 *   registrar o desvio; esconder faria o documento afirmar mais do que os dados
 *   sustentam.
 */

interface SgsstEvidenciasPanelProps {
  entidade: EntidadeEvidencia;
  entidadeId?: string;
  /** Falso esconde os botões de anexar e remover — modo leitura. */
  permiteEditar?: boolean;
  titulo?: string;
  /** Texto curto explicando o que fotografar naquele contexto. */
  ajuda?: string;
  /** Sem o cartão em volta, para uso dentro de um bloco que já tem moldura. */
  semCartao?: boolean;
}

export function SgsstEvidenciasPanel({
  entidade,
  entidadeId,
  permiteEditar = true,
  titulo = "Evidência fotográfica",
  ajuda,
  semCartao = false,
}: SgsstEvidenciasPanelProps) {
  const { evidencias, isLoading, error, adicionar, remover, atualizarDescricao, truncado } =
    useSgsstEvidencias(entidade, entidadeId);

  const [enviando, setEnviando] = useState(false);
  const [legendas, setLegendas] = useState<Record<string, string>>({});

  const anexar = async (foto: FotoCapturada) => {
    if (!entidadeId) {
      toast.error("Salve o registro antes de anexar fotos.");
      return;
    }

    setEnviando(true);
    try {
      const url = await uploadImage(foto.arquivo);
      if (!url) throw new Error("O envio não retornou o endereço do arquivo.");

      await adicionar.mutateAsync({
        entidade,
        entidade_id: entidadeId,
        r2_key: url,
        r2_url: url,
        nome_arquivo: foto.arquivo.name,
        tipo_mime: foto.arquivo.type || null,
        tamanho: foto.arquivo.size || null,
        latitude: foto.coordenada?.latitude ?? null,
        longitude: foto.coordenada?.longitude ?? null,
        precisao_metros: foto.coordenada?.precisao ?? null,
        capturada_em: foto.capturadaEm,
        origem_captura: foto.origem,
        motivo_sem_geo: foto.motivoSemGeo,
      });
    } catch (e) {
      toast.error(`Erro ao anexar a foto: ${(e as Error).message}`);
    } finally {
      setEnviando(false);
    }
  };

  const conteudo = (
    <div className="space-y-3">
      {ajuda && <p className="text-[11px] text-muted-foreground">{ajuda}</p>}

      {error && <SgsstErrorState error={error} modulo="Evidências" inline />}

      {permiteEditar && (
        <CapturaFotoCampo
          onCapturar={anexar}
          disabled={enviando || !entidadeId}
          multiplo
          rotuloCamera="Tirar foto"
          rotuloArquivo="Anexar arquivo"
        />
      )}

      {!entidadeId && (
        <p className="text-[11px] text-muted-foreground">
          Salve o registro para poder anexar fotos.
        </p>
      )}

      {enviando && (
        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> enviando a foto...
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando evidências...</p>
      ) : evidencias.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma foto anexada. A foto é o que sustenta o desvio no documento — sem
          ela, o registro depende só da descrição escrita.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {evidencias.map((ev, indice) => {
            const selo = seloDaFoto({
              coord: {
                latitude: ev.latitude,
                longitude: ev.longitude,
                precisao: ev.precisao_metros,
              },
              capturadaEm: ev.capturada_em,
              origem: ev.origem_captura,
              motivoSemCoordenada: ev.motivo_sem_geo,
            });

            const mapa = linkDoMapa({
              latitude: ev.latitude,
              longitude: ev.longitude,
            });

            return (
              <div key={ev.id} className="rounded-lg border overflow-hidden bg-card">
                <a
                  href={resolveFileUrl(ev.r2_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  <img
                    src={resolveFileUrl(ev.r2_url)}
                    alt={ev.descricao || `Evidência ${indice + 1}`}
                    className="w-full h-36 object-cover"
                    loading="lazy"
                  />
                </a>

                <div className="p-2 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        selo.alerta
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : "bg-emerald-50 text-emerald-700 border-emerald-300"
                      }`}
                    >
                      {selo.qualidade === "SEM_COORDENADA" ? (
                        <MapPinOff className="h-2.5 w-2.5 mr-1" />
                      ) : (
                        <MapPin className="h-2.5 w-2.5 mr-1" />
                      )}
                      Foto {indice + 1}
                    </Badge>

                    <div className="flex items-center gap-1">
                      {mapa && (
                        <a
                          href={mapa}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir o ponto no mapa"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {permiteEditar && (
                        <button
                          type="button"
                          title="Remover esta evidência"
                          className="text-muted-foreground hover:text-red-600"
                          onClick={() => remover.mutate(ev.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* O selo fica visível na própria miniatura: quem confere não
                      precisa abrir o arquivo para saber onde a foto foi tirada. */}
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    {selo.texto}
                  </p>

                  {permiteEditar ? (
                    <Input
                      placeholder="Legenda da foto"
                      className="h-7 text-[11px]"
                      value={legendas[ev.id] ?? ev.descricao ?? ""}
                      onChange={(e) =>
                        setLegendas((prev) => ({ ...prev, [ev.id]: e.target.value }))
                      }
                      // Salva ao sair do campo: gravar no `onChange` dispararia um
                      // UPDATE por caractere digitado.
                      onBlur={() => {
                        const nova = legendas[ev.id];
                        if (nova === undefined || nova === (ev.descricao ?? "")) return;
                        atualizarDescricao.mutate({ id: ev.id, descricao: nova });
                      }}
                    />
                  ) : (
                    ev.descricao && <p className="text-[11px]">{ev.descricao}</p>
                  )}

                  {ev.autor?.nome && (
                    <p className="text-[10px] text-muted-foreground">
                      por {ev.autor.nome}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {truncado && (
        <p className="text-[11px] text-amber-700">
          A lista atingiu o limite de fotos por registro e pode estar incompleta.
        </p>
      )}
    </div>
  );

  if (semCartao) return conteudo;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" /> {titulo}
          {evidencias.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {evidencias.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{conteudo}</CardContent>
    </Card>
  );
}
