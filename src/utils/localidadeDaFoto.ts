/**
 * O município e o estado de onde a foto foi tirada.
 *
 * POR QUE ISTO EXISTE
 *
 * O selo da foto já trazia a coordenada, e coordenada não se lê. Ninguém abre uma
 * folha de inspeção e reconhece `-14.524700, -49.140800` como Uruaçu. Quem confere
 * o documento — fiscal, cliente, o próprio gestor meses depois — precisa saber em
 * que cidade aquilo foi registrado sem abrir um mapa.
 *
 * O NOME É CAPTURADO NO MOMENTO DA FOTO, E GUARDADO
 *
 * Não é resolvido na hora de exibir. Três razões:
 *
 * 1. Uma lista com cinquenta fotos faria cinquenta chamadas externas a cada
 *    abertura de tela.
 * 2. O PDF é montado sem rede garantida, e sairia sem os nomes.
 * 3. O documento é evidência: o que ele afirma tem de ser o que foi apurado
 *    naquele instante, e não o que um serviço externo responder no ano que vem.
 *
 * QUANDO NÃO DÁ PARA SABER, NÃO INVENTA
 *
 * Sem rede, serviço fora do ar, coordenada no meio do oceano: o selo sai como
 * saía antes, só com a coordenada. Nome errado numa evidência é pior que nome
 * nenhum — e um município errado no documento é exatamente o tipo de erro que
 * ninguém confere e todo mundo repete.
 */

export interface LocalidadeDaFoto {
  /** Nome do município, como o serviço devolve. */
  municipio: string;
  /** Sigla de duas letras. Ausente fora do Brasil. */
  uf?: string | null;
}

/**
 * O rótulo que entra no selo: `Uruaçu-GO`.
 *
 * Sem município não há rótulo, mesmo havendo UF. Um selo que diz apenas `GO` ao
 * lado da coordenada não informa nada que a coordenada já não diga, e parece
 * defeito para quem lê.
 */
export function rotuloDaLocalidade(
  local: LocalidadeDaFoto | null | undefined
): string | null {
  const municipio = (local?.municipio ?? "").trim();
  if (!municipio) return null;

  const uf = (local?.uf ?? "").trim().toUpperCase();
  return uf ? `${municipio}-${uf}` : municipio;
}

/**
 * A sigla do estado a partir do código ISO do serviço (`BR-GO`).
 *
 * Só aceita o prefixo do Brasil: `US-CA` viraria "CA", que num documento
 * brasileiro se lê como uma UF que não existe.
 */
export function ufDoCodigoIso(codigo: string | null | undefined): string | null {
  const bruto = (codigo ?? "").trim().toUpperCase();
  const casa = /^BR-([A-Z]{2})$/.exec(bruto);
  return casa ? casa[1] : null;
}

/** O formato que o serviço de geocodificação reversa devolve, no que usamos. */
export interface RespostaDeGeocodificacao {
  countryCode?: string | null;
  principalSubdivisionCode?: string | null;
  city?: string | null;
  locality?: string | null;
}

/**
 * Lê a resposta do serviço.
 *
 * `city` vem vazio em ponto de zona rural e no mar; `locality` preenche o
 * primeiro caso e, no segundo, devolve coisas como "Oceano Atlântico" — que não é
 * município nenhum. Por isso a localidade só vale quando há país: sem país não há
 * divisão administrativa, e o que veio é nome de acidente geográfico.
 */
export function localidadeDaResposta(
  resposta: RespostaDeGeocodificacao | null | undefined
): LocalidadeDaFoto | null {
  if (!resposta) return null;
  if (!(resposta.countryCode ?? "").trim()) return null;

  const municipio = (resposta.city ?? "").trim() || (resposta.locality ?? "").trim();
  if (!municipio) return null;

  return { municipio, uf: ufDoCodigoIso(resposta.principalSubdivisionCode) };
}

/**
 * Tempo máximo esperando o serviço.
 *
 * A foto já está tirada e a pessoa está esperando para continuar. Quatro segundos
 * é o teto do que se pode gastar com um enfeite do selo — passou disso, a foto
 * segue sem o nome, que é como ela seguia antes desta mudança existir.
 */
export const LIMITE_DA_BUSCA_MS = 4000;

const SERVICO = "https://api-bdc.net/data/reverse-geocode-client";

/**
 * Busca o município e o estado de uma coordenada.
 *
 * Devolve nulo em qualquer falha — sem rede, sem serviço, resposta estranha,
 * tempo esgotado. Quem chama não precisa tratar erro: a ausência do nome é um
 * estado normal deste selo, e não uma exceção.
 */
export async function buscarLocalidade(params: {
  latitude: number;
  longitude: number;
  /** Trocável nos testes e se um dia o serviço mudar. */
  buscar?: typeof fetch;
}): Promise<LocalidadeDaFoto | null> {
  const { latitude, longitude } = params;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const buscar = params.buscar ?? fetch;
  const abortar = new AbortController();
  const relogio = setTimeout(() => abortar.abort(), LIMITE_DA_BUSCA_MS);

  try {
    const url =
      `${SERVICO}?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`;
    const resposta = await buscar(url, { signal: abortar.signal });
    if (!resposta.ok) return null;

    return localidadeDaResposta((await resposta.json()) as RespostaDeGeocodificacao);
  } catch {
    // Inclui o aborto por tempo. Nada a registrar: a foto vale sem o nome, e um
    // erro no console a cada foto em obra sem sinal viraria ruído permanente.
    return null;
  } finally {
    clearTimeout(relogio);
  }
}
