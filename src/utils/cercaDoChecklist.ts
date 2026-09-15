/**
 * A cerca geográfica do checklist existe, ou só parece existir?
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * A configuração do modelo aceitava "bloquear preenchimento fora da área" sem
 * latitude e longitude. Na hora de aplicar, a conferência do raio vivia dentro de
 * `if (latitude_alvo && longitude_alvo && raio_permitido_metros)` — então, sem
 * ponto alvo, o bloco inteiro era pulado. Em silêncio.
 *
 * O resultado: quem montou o modelo saía convencido de ter prendido o checklist a
 * um local, e o checklist podia ser respondido de qualquer lugar do mundo. Pior
 * que não ter a trava, porque ninguém vai conferir de novo uma trava que acredita
 * ter ligado.
 *
 * A regra estava escrita em dois lugares — uma condição na tela de aplicação e
 * nenhuma na de configuração. Duas cópias de uma regra divergem; é o que houve.
 * Agora é uma função, usada nos dois lados.
 *
 * O QUE NÃO É DEFEITO
 *
 * Exigir a coordenada SEM ponto alvo é uso legítimo: registra onde o checklist
 * foi feito, sem prometer conferir área nenhuma. O que a tela não pode é deixar
 * parecer que confere.
 */

export interface ConfiguracaoDaCerca {
  latitude_alvo?: number | string | null;
  longitude_alvo?: number | string | null;
  raio_permitido_metros?: number | null;
}

/**
 * Verdadeiro quando há ponto alvo e raio — isto é, quando existe algo contra o
 * que comparar a posição de quem responde.
 */
export function cercaEstaConfigurada(modelo: ConfiguracaoDaCerca): boolean {
  const temNumero = (v: number | string | null | undefined) =>
    v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

  return (
    temNumero(modelo.latitude_alvo) &&
    temNumero(modelo.longitude_alvo) &&
    temNumero(modelo.raio_permitido_metros) &&
    Number(modelo.raio_permitido_metros) > 0
  );
}

export interface ProblemaNaCerca {
  titulo: string;
  detalhe: string;
}

/**
 * O que impede salvar esta configuração de cerca, se algo impede.
 *
 * Recebe o que está digitado na tela (texto), não o que já foi convertido: é
 * antes da conversão que "vazio" ainda se distingue de zero.
 */
export function problemaNaCerca(params: {
  latitude: string;
  longitude: string;
  bloquearForaRaio: boolean;
}): ProblemaNaCerca | null {
  const temLatitude = params.latitude.trim() !== "";
  const temLongitude = params.longitude.trim() !== "";

  if (temLatitude !== temLongitude) {
    return {
      titulo: "Informe latitude e longitude.",
      detalhe:
        "Só uma das duas não define um ponto — a área não teria contra o que ser conferida.",
    };
  }

  if (params.bloquearForaRaio && !temLatitude) {
    return {
      titulo: "Bloquear fora do raio exige latitude e longitude.",
      detalhe:
        "Sem ponto alvo o bloqueio nunca dispara: o checklist seria aceito de qualquer lugar, dando a impressão de estar preso ao local.",
    };
  }

  return null;
}
