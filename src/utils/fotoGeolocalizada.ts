import { calculateHaversineDistanceMeters } from "@/utils/geolocationUtils";

/**
 * Foto de campo com geolocalização — o selo que transforma a foto em evidência.
 *
 * O sistema já capturava coordenadas no INÍCIO e no FIM da aplicação de checklist.
 * Isso responde "onde a pessoa estava quando abriu e quando fechou" e não responde
 * a pergunta que a auditoria faz: **onde esta foto foi tirada**. Entre abrir e
 * fechar um checklist de trinta itens passam horas e quilômetros.
 *
 * Por isso a coordenada é capturada no momento de cada foto, e não herdada da
 * aplicação. E por isso ela não é opcional em silêncio: foto sem coordenada sai
 * marcada como "sem localização", com o motivo.
 *
 * Uma decisão que atravessa o arquivo: **precisão ruim não é o mesmo que ausência
 * de coordenada.** Um ponto com 800 m de raio localiza o bairro, não o andaime — e
 * apresentá-lo como se localizasse o andaime é pior que dizer que não há ponto.
 * Os dois estados são distintos e ditos diferentes.
 */

/** Acima disto a coordenada não localiza o ponto de trabalho, só a região. */
export const PRECISAO_RUIM_METROS = 100;

/** Abaixo disto a coordenada é boa o bastante para apontar a frente de serviço. */
export const PRECISAO_BOA_METROS = 30;

export type QualidadeGeo = "SEM_COORDENADA" | "BOA" | "RAZOAVEL" | "RUIM";

export const QUALIDADE_GEO_LABEL: Record<QualidadeGeo, string> = {
  SEM_COORDENADA: "Sem localização",
  BOA: "Localização precisa",
  RAZOAVEL: "Localização aproximada",
  RUIM: "Localização imprecisa",
};

export type OrigemFoto = "CAMERA" | "ARQUIVO";

export const ORIGEM_FOTO_LABEL: Record<OrigemFoto, string> = {
  CAMERA: "Foto tirada na hora",
  ARQUIVO: "Arquivo escolhido da galeria",
};

/**
 * Ajuda que explica por que a origem importa.
 *
 * Foto tirada na hora tem coordenada e horário do momento da inspeção. Arquivo da
 * galeria pode ser de qualquer dia e de qualquer lugar — inclusive legítimo (foto
 * do laudo, print de documento), mas a folha precisa dizer qual dos dois é.
 */
export const ORIGEM_FOTO_AJUDA: Record<OrigemFoto, string> = {
  CAMERA:
    "Capturada pela câmera no momento do registro, com a coordenada e o horário daquele instante.",
  ARQUIVO:
    "Escolhida da galeria ou dos arquivos do dispositivo. Pode ser de outro dia e de outro lugar — por isso a origem sai registrada.",
};

export interface CoordenadaFoto {
  latitude?: number | null;
  longitude?: number | null;
  /** Raio de incerteza em metros, como o navegador informa. */
  precisao?: number | null;
}

/**
 * Qualidade da coordenada de uma foto.
 *
 * Precisão ausente com coordenada presente conta como RAZOAVEL: há ponto, e não se
 * pode afirmar que é bom nem que é ruim. Chamar de BOA seria afirmar mais do que se
 * sabe; chamar de RUIM descartaria um dado provavelmente útil.
 */
export function qualidadeDaCoordenada(coord: CoordenadaFoto | null | undefined): QualidadeGeo {
  if (
    !coord ||
    coord.latitude === null ||
    coord.latitude === undefined ||
    coord.longitude === null ||
    coord.longitude === undefined ||
    !Number.isFinite(coord.latitude) ||
    !Number.isFinite(coord.longitude)
  ) {
    return "SEM_COORDENADA";
  }

  const precisao = coord.precisao;
  if (precisao === null || precisao === undefined || !Number.isFinite(precisao)) {
    return "RAZOAVEL";
  }

  if (precisao <= PRECISAO_BOA_METROS) return "BOA";
  if (precisao <= PRECISAO_RUIM_METROS) return "RAZOAVEL";
  return "RUIM";
}

/** Coordenada em formato legível, com seis casas — o suficiente para ~0,1 m. */
export function formatarCoordenada(coord: CoordenadaFoto | null | undefined): string {
  if (qualidadeDaCoordenada(coord) === "SEM_COORDENADA") return "—";

  const lat = (coord as CoordenadaFoto).latitude as number;
  const lon = (coord as CoordenadaFoto).longitude as number;
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

/** Link para o mapa. Quem recebe a folha confere o ponto sem digitar nada. */
export function linkDoMapa(coord: CoordenadaFoto | null | undefined): string | null {
  if (qualidadeDaCoordenada(coord) === "SEM_COORDENADA") return null;

  const lat = (coord as CoordenadaFoto).latitude as number;
  const lon = (coord as CoordenadaFoto).longitude as number;
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
}

export interface SeloDaFoto {
  qualidade: QualidadeGeo;
  /** Texto curto para a interface e para o documento. */
  texto: string;
  /** Verdadeiro quando o selo deve chamar atenção. */
  alerta: boolean;
}

/**
 * Selo textual da foto: onde, quando, e por qual meio.
 *
 * Sai montado aqui, e não em cada tela, para que a interface e o PDF digam
 * exatamente a mesma coisa — e para que a regra do que é "impreciso" tenha um lugar
 * só.
 */
export function seloDaFoto(params: {
  coord?: CoordenadaFoto | null;
  capturadaEm?: string | null;
  origem?: OrigemFoto | null;
  /** Motivo de não haver coordenada, quando conhecido. */
  motivoSemCoordenada?: string | null;
}): SeloDaFoto {
  const { coord, capturadaEm, origem, motivoSemCoordenada } = params;
  const qualidade = qualidadeDaCoordenada(coord);

  const partes: string[] = [];

  if (qualidade === "SEM_COORDENADA") {
    partes.push(
      motivoSemCoordenada?.trim()
        ? `Sem localização (${motivoSemCoordenada.trim()})`
        : "Sem localização"
    );
  } else {
    partes.push(formatarCoordenada(coord));
    if (coord?.precisao !== null && coord?.precisao !== undefined) {
      partes.push(`±${Math.round(coord.precisao)} m`);
    }
  }

  if (capturadaEm) {
    // `new Date("lixo")` não lança: devolve um Date inválido, e
    // `toLocaleString` nele imprime "Invalid Date". Um `try/catch` aqui nunca
    // dispararia, e o selo sairia dizendo "Invalid Date" — pior que mostrar o
    // valor cru, que ao menos permite descobrir de onde veio.
    const data = new Date(capturadaEm);
    partes.push(
      Number.isNaN(data.getTime()) ? capturadaEm : data.toLocaleString("pt-BR")
    );
  }

  if (origem) partes.push(ORIGEM_FOTO_LABEL[origem]);

  return {
    qualidade,
    texto: partes.join(" · "),
    // Arquivo da galeria também alerta: não é erro, é informação que muda o peso da
    // evidência, e quem confere precisa notar sem procurar.
    alerta: qualidade === "SEM_COORDENADA" || qualidade === "RUIM" || origem === "ARQUIVO",
  };
}

export type SituacaoNoLocal = "SEM_REFERENCIA" | "SEM_COORDENADA" | "DENTRO" | "FORA";

export const SITUACAO_NO_LOCAL_LABEL: Record<SituacaoNoLocal, string> = {
  SEM_REFERENCIA: "Obra sem coordenada de referência",
  SEM_COORDENADA: "Foto sem localização",
  DENTRO: "Dentro da área da obra",
  FORA: "Fora da área da obra",
};

export interface ConferenciaNoLocal {
  situacao: SituacaoNoLocal;
  /** Distância até o ponto de referência; nula quando não há o que comparar. */
  distanciaMetros: number | null;
}

/**
 * Confere se a foto foi tirada dentro da área da obra.
 *
 * Precisa das duas pontas: a coordenada da foto e a referência do local. Faltando
 * qualquer uma, a resposta é o estado que diz **qual** delas faltou — não um "fora
 * da área" que acusaria o inspetor por uma referência que ninguém cadastrou.
 *
 * A comparação soma a precisão ao raio: um ponto a 210 m com ±40 m de incerteza
 * pode perfeitamente estar dentro de um raio de 200 m, e acusar "fora" nesse caso
 * seria tratar a margem de erro como certeza.
 */
export function conferirNoLocal(params: {
  coord?: CoordenadaFoto | null;
  referencia?: { latitude?: number | null; longitude?: number | null } | null;
  raioMetros?: number | null;
}): ConferenciaNoLocal {
  const { coord, referencia, raioMetros } = params;

  if (
    !referencia ||
    referencia.latitude === null ||
    referencia.latitude === undefined ||
    referencia.longitude === null ||
    referencia.longitude === undefined ||
    !raioMetros ||
    raioMetros <= 0
  ) {
    return { situacao: "SEM_REFERENCIA", distanciaMetros: null };
  }

  if (qualidadeDaCoordenada(coord) === "SEM_COORDENADA") {
    return { situacao: "SEM_COORDENADA", distanciaMetros: null };
  }

  const distanciaMetros = calculateHaversineDistanceMeters(
    coord!.latitude as number,
    coord!.longitude as number,
    referencia.latitude,
    referencia.longitude
  );

  const margem = coord?.precisao && Number.isFinite(coord.precisao) ? coord.precisao : 0;

  return {
    situacao: distanciaMetros <= raioMetros + margem ? "DENTRO" : "FORA",
    distanciaMetros,
  };
}
