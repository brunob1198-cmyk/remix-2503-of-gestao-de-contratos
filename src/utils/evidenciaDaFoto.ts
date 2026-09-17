import type { FotoCapturada } from "@/components/comum/CapturaFotoCampo";
import type {
  EntidadeEvidencia,
  SgsstEvidenciaInput,
} from "@/hooks/sgsst/useSgsstEvidencias";

/**
 * A foto capturada, traduzida para a linha de evidência.
 *
 * POR QUE ISTO SAIU DO COMPONENTE
 *
 * São treze campos, e o que os liga não é óbvio: `capturada_em` vem do INSTANTE
 * da foto e não do envio; `origem_captura` distingue a foto tirada na hora da
 * escolhida na galeria; `motivo_sem_geo` existe para a ausência de coordenada
 * ficar explicada em vez de virar um campo vazio.
 *
 * O painel de evidências fazia esse mapeamento inline. Ao acrescentar a captura
 * dentro do formulário de entrega de EPI (roteiro 13.13), o mesmo mapeamento
 * precisaria existir num segundo lugar — e um campo esquecido ali não dá erro:
 * a foto entra sem coordenada, ou sem o horário da captura, e o selo do
 * documento passa a mentir em silêncio.
 *
 * `r2_key` E `r2_url` RECEBEM O MESMO VALOR
 *
 * É o que o painel já fazia. O envio devolve uma URL e não uma chave separada;
 * manter as duas colunas com o mesmo conteúdo preserva o formato da tabela sem
 * inventar uma chave que ninguém usa para buscar.
 */
export function payloadDaEvidencia(params: {
  entidade: EntidadeEvidencia;
  entidadeId: string;
  foto: FotoCapturada;
  /** O endereço devolvido pelo envio do arquivo. */
  url: string;
  descricao?: string | null;
}): SgsstEvidenciaInput {
  const { entidade, entidadeId, foto, url, descricao } = params;

  return {
    entidade,
    entidade_id: entidadeId,
    r2_key: url,
    r2_url: url,
    nome_arquivo: foto.arquivo.name,
    tipo_mime: foto.arquivo.type || null,
    tamanho: foto.arquivo.size || null,
    descricao: descricao?.trim() || null,
    latitude: foto.coordenada?.latitude ?? null,
    longitude: foto.coordenada?.longitude ?? null,
    precisao_metros: foto.coordenada?.precisao ?? null,
    capturada_em: foto.capturadaEm,
    origem_captura: foto.origem,
    motivo_sem_geo: foto.motivoSemGeo,
  };
}

/**
 * O que dizer quando o registro foi salvo e alguma foto não subiu.
 *
 * A ENTREGA NÃO É DESFEITA
 *
 * A entrega de EPI move estoque e é um fato: o equipamento saiu da prateleira e
 * está com o trabalhador. Desfazê-la porque uma foto falhou trocaria um problema
 * pequeno — falta a foto — por um grande: o estoque volta a contar uma peça que
 * não está lá, e a entrega que aconteceu deixa de existir no papel.
 *
 * Então a entrega fica, e a pessoa é avisada do que exatamente faltou e de como
 * completar: o botão de câmera na linha do registro, que já existe.
 */
export function avisoDeFotoNaoEnviada(quantas: number): string {
  if (quantas <= 0) return "";

  const plural = quantas > 1;
  return (
    `A entrega foi registrada, mas ${quantas} foto${plural ? "s" : ""} não ` +
    `${plural ? "subiram" : "subiu"}. Anexe pelo botão de câmera na linha da ` +
    `entrega — o registro de estoque já está feito e não precisa ser refeito.`
  );
}
