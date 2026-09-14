/**
 * Regras do checklist respondido pelo QR Code, sem login.
 *
 * O QUE MUDA QUANDO NAO HA LOGIN
 *
 * O sistema deixa de saber QUEM respondeu. Passa a saber apenas o que a pessoa
 * digitou. Tudo aqui parte disso: a identidade e DECLARADA, e em nenhum lugar o
 * resultado pode ser apresentado com a mesma confianca de uma aplicacao feita por
 * usuario autenticado.
 *
 * A ARMADILHA DO "SIM / NAO"
 *
 * Um item pode ter `tipo_resposta` = `Sim_Nao`, e nesse caso o valor gravado e
 * "Sim" ou "Nao". Mas a pergunta costuma ser escrita de um jeito em que "Sim" e a
 * resposta RUIM — "Houve arranhado ou amassado?".
 *
 * Por isso a tela de aplicacao interna nunca rotula os botoes como "Sim" e "Nao":
 * ela rotula "Conforme" e "Nao Conforme", e o tipo so decide a string que vai para
 * o banco. O formulario publico faz igual, e e por isso que `valorConforme` e
 * `valorNaoConforme` existem em vez de o componente escolher o texto na hora.
 * Rotular "Sim/Nao" inverteria o significado de metade dos checklists sem nenhum
 * aviso.
 */

export type TipoRespostaPublico =
  | "Sim_Nao"
  | "Sim_Nao_NA"
  | "Conforme_NaoConforme"
  | "Conforme_NaoConforme_NA"
  | "OK_NaoOK"
  | "Escala"
  | "Numero"
  | "Texto"
  | "Data"
  | "Hora"
  | "Selecao"
  | "MultiplaSelecao";

export interface ItemPublico {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo_resposta: TipoRespostaPublico;
  opcoes_selecao?: string[] | null;
  obrigatorio: boolean;
  exigir_comentario_nao_conforme: boolean;
  critico: boolean;
}

export interface RespostaPublica {
  valor: string;
  comentario?: string;
}

/** O valor gravado quando a pessoa marca "Conforme", conforme o tipo do item. */
export function valorConforme(tipo: TipoRespostaPublico): string {
  return tipo.startsWith("Sim") ? "Sim" : "Conforme";
}

/** O valor gravado quando a pessoa marca "Não Conforme". */
export function valorNaoConforme(tipo: TipoRespostaPublico): string {
  return tipo.startsWith("Sim") ? "Nao" : "NaoConforme";
}

/** Este item aceita "não se aplica"? */
export function aceitaNaoAplicavel(tipo: TipoRespostaPublico): boolean {
  return tipo.includes("NA");
}

/** O item usa os botões de conformidade, e não um campo livre? */
export function ehItemDeConformidade(tipo: TipoRespostaPublico): boolean {
  return (
    tipo.startsWith("Sim") || tipo.startsWith("Conforme") || tipo === "OK_NaoOK"
  );
}

const VALORES_NAO_CONFORMES = new Set(["Nao", "NaoConforme", "NaoOK", "Nao Conforme"]);
const VALORES_NAO_APLICAVEIS = new Set(["NA", "N/A", "NaoAplicavel"]);

export function ehNaoConforme(valor: string): boolean {
  return VALORES_NAO_CONFORMES.has(valor);
}

export function ehNaoAplicavel(valor: string): boolean {
  return VALORES_NAO_APLICAVEIS.has(valor);
}

export interface PendenciaPublica {
  itemId: string;
  titulo: string;
  motivo: string;
}

/** Quem respondeu, como a própria pessoa declarou. */
export interface QuemRespondeu {
  nome: string;
  documento?: string;
}

/**
 * O que falta para o checklist poder ser enviado.
 *
 * Mesma regra da aplicação interna — item obrigatório sem resposta e comentário
 * obrigatório na não conformidade —, mais o nome de quem está respondendo, que só
 * existe neste fluxo.
 *
 * O servidor confere de novo. Esta função é conveniência: ela evita a viagem e
 * diz onde tocar, mas não é a guarda. A guarda está em
 * `responder_checklist_por_qr`, porque a chamada vem de um aparelho que não está
 * sob nosso controle.
 */
export function pendenciasDoEnvio(params: {
  itens: readonly ItemPublico[];
  respostas: Readonly<Record<string, RespostaPublica>>;
  quem: QuemRespondeu;
}): PendenciaPublica[] {
  const pendencias: PendenciaPublica[] = [];

  if ((params.quem.nome ?? "").trim().length < 3) {
    pendencias.push({
      itemId: "__quem__",
      titulo: "Identificação",
      motivo: "informe o nome de quem está respondendo",
    });
  }

  for (const item of params.itens) {
    const resposta = params.respostas[item.id];
    const valor = (resposta?.valor ?? "").trim();

    if (!valor) {
      // Item crítico também é exigido mesmo se alguém o deixou como não
      // obrigatório: em branco, ele deixaria a aprovação indefinida.
      if (item.obrigatorio || item.critico) {
        pendencias.push({
          itemId: item.id,
          titulo: item.titulo,
          motivo: item.critico ? "item crítico sem resposta" : "item obrigatório sem resposta",
        });
      }
      continue;
    }

    if (
      ehNaoConforme(valor) &&
      item.exigir_comentario_nao_conforme &&
      !(resposta?.comentario ?? "").trim()
    ) {
      pendencias.push({
        itemId: item.id,
        titulo: item.titulo,
        motivo: "não conformidade sem comentário — descreva o que encontrou",
      });
    }
  }

  return pendencias;
}

/**
 * Distância em metros entre dois pontos (fórmula de haversine).
 *
 * Serve para o modelo que exige geolocalização dentro de um raio. Terra como
 * esfera de 6.371 km: o erro disso é de ~0,3%, irrelevante para um raio de
 * duzentos metros, e evita depender de biblioteca.
 */
export function distanciaEmMetros(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;

  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type SituacaoDaPosicao =
  | { estado: "NAO_EXIGIDA" }
  | { estado: "AGUARDANDO" }
  | { estado: "SEM_PERMISSAO"; bloqueia: boolean }
  | { estado: "DENTRO"; metros: number }
  | { estado: "FORA"; metros: number; bloqueia: boolean };

/**
 * O que a posição do aparelho significa para este checklist.
 *
 * `bloqueia` separa as duas coisas que o modelo pode querer: apenas REGISTRAR
 * onde a pessoa estava, ou IMPEDIR o preenchimento fora da área. Tratar as duas
 * como uma só faria um checklist de registro barrar quem está do lado de fora do
 * portão por vinte metros.
 */
export function situacaoDaPosicao(params: {
  exigirGeolocalizacao: string;
  bloquearForaRaio: boolean;
  latitudeAlvo?: number | null;
  longitudeAlvo?: number | null;
  raioEmMetros: number;
  posicao?: { latitude: number; longitude: number } | null;
  permissaoNegada?: boolean;
}): SituacaoDaPosicao {
  if (!params.exigirGeolocalizacao || params.exigirGeolocalizacao === "nao") {
    return { estado: "NAO_EXIGIDA" };
  }

  if (params.permissaoNegada) {
    return { estado: "SEM_PERMISSAO", bloqueia: params.bloquearForaRaio };
  }

  if (!params.posicao) return { estado: "AGUARDANDO" };

  // Sem ponto alvo não há raio a conferir: a posição é só registrada.
  if (params.latitudeAlvo == null || params.longitudeAlvo == null) {
    return { estado: "DENTRO", metros: 0 };
  }

  const metros = Math.round(
    distanciaEmMetros(params.posicao, {
      latitude: params.latitudeAlvo,
      longitude: params.longitudeAlvo,
    })
  );

  return metros <= params.raioEmMetros
    ? { estado: "DENTRO", metros }
    : { estado: "FORA", metros, bloqueia: params.bloquearForaRaio };
}
