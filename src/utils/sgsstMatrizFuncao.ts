import { somarMeses } from "@/utils/sgsstConvocacao";

/**
 * Matriz de conformidade por função.
 *
 * Responde a pergunta que ninguém conseguia responder antes da função ter
 * vínculos: dado que a função exige estes treinamentos e estes EPIs, quem que
 * exerce a função ainda não tem o quê.
 *
 * A regra que atravessa tudo aqui: **na dúvida, acusa a pendência.** Deixar de
 * apontar uma falta por falha de cadastro é o erro caro — o trabalhador vai a
 * campo sem treinamento e o sistema diz que está tudo bem.
 */

export type SituacaoItem = "OK" | "NUNCA_FEITO" | "VENCIDO" | "SEM_FUNCAO";

export const SITUACAO_ITEM_LABEL: Record<SituacaoItem, string> = {
  OK: "Em dia",
  NUNCA_FEITO: "Nunca realizado",
  VENCIDO: "Vencido",
  SEM_FUNCAO: "Função não definida",
};

/** Participação em turma de treinamento, já achatada. */
export interface ParticipacaoTreinamento {
  colaboradorId: string;
  treinamentoId: string;
  resultado: string;
  /** Data ISO (YYYY-MM-DD) ou nulo quando o treinamento não vence. */
  validade?: string | null;
  dataConclusao?: string | null;
}

/** Entrega de EPI, já achatada. */
export interface EntregaEpi {
  colaboradorId: string;
  epiId: string;
  /** Data ISO (YYYY-MM-DD). */
  dataEntrega: string;
}

export interface ExigenciaTreinamento {
  treinamentoId: string;
  nome: string;
  obrigatorio: boolean;
}

export interface ExigenciaEpi {
  epiId: string;
  nome: string;
  obrigatorio: boolean;
  periodicidadeTrocaMeses?: number | null;
}

export interface ColaboradorMatriz {
  id: string;
  nome: string;
  funcaoId?: string | null;
  funcaoNome?: string | null;
  obra?: string | null;
}

export interface PendenciaItem {
  /** Chave estável para o React, sem depender do índice da lista. */
  chave: string;
  colaboradorId: string;
  colaborador: string;
  /**
   * Id da função, e não só o nome.
   *
   * Filtrar por nome parece funcionar e erra em silêncio: dois cargos parecidos
   * ("Montador" e "Montador de Estruturas") se confundem, e renomear a função
   * desliga o filtro sem nenhum aviso. Nulo quando o colaborador está sem
   * função — que é a própria pendência.
   */
  funcaoId?: string | null;
  funcaoNome?: string | null;
  obra?: string | null;
  tipo: "TREINAMENTO" | "EPI";
  itemId: string;
  itemNome: string;
  situacao: SituacaoItem;
  /** Data de vencimento, quando houve realização anterior. */
  vencimento?: string | null;
}

/** Converte "YYYY-MM-DD" em Date local, sem o deslocamento de fuso do ISO puro. */
function comoData(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/**
 * Formata como "YYYY-MM-DD" pelo calendário local.
 *
 * Não usar `toISOString()`: ele converte para UTC, e uma data local à meia-noite
 * em fuso positivo (UTC+2, por exemplo) volta como o dia ANTERIOR. A data de
 * vencimento sairia um dia errada dependendo de onde o navegador está.
 */
function comoIso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/**
 * Certificado de NR cadastrado à mão na ficha do trabalhador.
 *
 * Segunda fonte de "treinamento feito", ao lado da matrícula em turma. Vem da
 * tabela `sgsst_colaborador_treinamentos`, que guarda o certificado em papel com
 * o anexo no R2 — treinamento feito antes do sistema, ou em escola externa, onde
 * nunca houve turma cadastrada aqui.
 */
export interface CertificadoManual {
  colaboradorId: string;
  /** Texto livre digitado no cadastro. É por ele que o casamento acontece. */
  nomeTreinamento: string;
  /**
   * Curso do catálogo, quando o registro aponta um.
   *
   * Hoje é sempre nulo: o formulário da ficha não oferece o campo. Fica aqui
   * porque, existindo, é o casamento forte — e evita depender do nome.
   */
  treinamentoId?: string | null;
  dataConclusao?: string | null;
  validade?: string | null;
}

/**
 * Nome normalizado para comparação: sem acento, sem caixa, sem espaço repetido.
 */
export function chaveDoTreinamento(nome: string): string {
  return (nome ?? "")
    .normalize("NFD")
    // Remove os acentos que o NFD acabou de separar da letra. A faixa entre os
    // colchetes é U+0300 a U+036F (acentos combinantes) e está escrita com os
    // caracteres em si, que não têm desenho próprio e por isso parecem lixo no
    // editor. Se alguém "limpar" essa linha, o casamento por nome passa a
    // distinguir "Trabalho em Altura" de "Trabalho em altura".
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O número da NR citada no nome, quando há uma.
 *
 * "NR10", "NR-10", "nr 10 básico" e "NR-10 Segurança em Instalações Elétricas"
 * todos devolvem "10".
 *
 * POR QUE NÃO BASTA COMPARAR TEXTO, E POR QUE NÃO PODE SER "UM CONTÉM O OUTRO"
 *
 * O cadastro manual é texto livre: ninguém digita o nome do catálogo inteiro.
 * "NR10" precisa casar com "NR-10 Segurança em Instalações Elétricas".
 *
 * Resolver isso por substring seria um desastre silencioso: "NR1" está contido em
 * "NR10", e NR-1 e NR-10 são normas diferentes — a ficha daria baixa na norma
 * errada e ninguém notaria. Comparar o NÚMERO extraído não tem esse problema.
 */
export function numeroDaNr(nome: string): string | null {
  const achado = chaveDoTreinamento(nome).match(/\bnr[\s-]?(\d{1,2})\b/);
  // Sem zero à esquerda: "NR-01" e "NR1" são a mesma norma.
  return achado ? String(Number(achado[1])) : null;
}

/** O certificado manual corresponde ao treinamento exigido? */
export function certificadoCasaComExigencia(
  certificado: CertificadoManual,
  exigencia: { treinamentoId: string; nome?: string | null }
): boolean {
  // 1. Vínculo explícito vence tudo.
  if (certificado.treinamentoId && certificado.treinamentoId === exigencia.treinamentoId) {
    return true;
  }

  const nomeExigido = exigencia.nome ?? "";
  if (!nomeExigido.trim() || !certificado.nomeTreinamento?.trim()) return false;

  // 2. Duas NRs com o mesmo número são a mesma norma, tenham o nome que tiverem.
  const nrDoCertificado = numeroDaNr(certificado.nomeTreinamento);
  const nrDaExigencia = numeroDaNr(nomeExigido);
  if (nrDoCertificado && nrDaExigencia) return nrDoCertificado === nrDaExigencia;

  // 3. Fora das NRs, só nome igual. Aproximar mais aqui daria baixa por engano.
  return chaveDoTreinamento(certificado.nomeTreinamento) === chaveDoTreinamento(nomeExigido);
}

/** Situação de um conjunto de registros que têm validade. Regra única das duas fontes. */
function situacaoPorValidade(
  validades: readonly (string | null | undefined)[],
  hoje: Date
): { situacao: "OK" | "VENCIDO"; vencimento: string | null } {
  // Sem validade = não expira. Um registro perpétuo basta.
  if (validades.some((v) => !v)) return { situacao: "OK", vencimento: null };

  // Entre os que vencem, o que vence mais tarde é o que manda.
  const maisRecente = validades
    .map((v) => v as string)
    .sort()
    .at(-1) as string;

  return {
    situacao: comoData(maisRecente) < hoje ? "VENCIDO" : "OK",
    vencimento: maisRecente,
  };
}

/**
 * Um treinamento conta como feito?
 *
 * DUAS FONTES, E O CERTIFICADO MANUAL PREVALECE
 *
 * Antes só a matrícula em turma dava baixa. NR cadastrada à mão na ficha, com o
 * certificado anexado, não contava: a exigência da função continuava aparecendo
 * como "nunca realizado" mesmo com o papel no sistema.
 *
 * As duas fontes passaram a valer. Quando as duas têm registro do mesmo
 * treinamento e discordam, o CADASTRO MANUAL decide — decisão do usuário, e
 * coerente com o fato de ser ele que carrega o certificado assinado.
 *
 * A consequência a conhecer: um registro manual velho e vencido derruba uma
 * turma recém-concluída do mesmo curso. É o preço de "o manual prevalece", e a
 * saída é corrigir o registro manual, que agora é editável.
 *
 * Só `APROVADO` vale na turma — presença sem aprovação não capacita. O cadastro
 * manual não tem campo de aprovação: existir já significa que houve certificado.
 */
export function situacaoTreinamento(
  participacoes: readonly ParticipacaoTreinamento[],
  treinamentoId: string,
  hoje: Date,
  extras?: {
    /** Nome do treinamento exigido, para casar com o cadastro manual. */
    nomeExigido?: string | null;
    certificadosManuais?: readonly CertificadoManual[];
  }
): { situacao: Exclude<SituacaoItem, "SEM_FUNCAO">; vencimento: string | null } {
  const manuais = (extras?.certificadosManuais ?? []).filter((c) =>
    certificadoCasaComExigencia(c, { treinamentoId, nome: extras?.nomeExigido })
  );

  // O manual decide sozinho quando existe — inclusive para dizer VENCIDO.
  if (manuais.length > 0) {
    return situacaoPorValidade(manuais.map((c) => c.validade), hoje);
  }

  const aprovadas = participacoes.filter(
    (p) => p.treinamentoId === treinamentoId && p.resultado === "APROVADO"
  );

  if (aprovadas.length === 0) return { situacao: "NUNCA_FEITO", vencimento: null };

  return situacaoPorValidade(aprovadas.map((p) => p.validade), hoje);
}

/**
 * Um EPI conta como entregue?
 *
 * `periodicidadeTrocaMeses` nula significa sem troca programada — uma entrega
 * basta. Com periodicidade, uma entrega de três anos atrás não pode continuar
 * valendo para sempre.
 */
export function situacaoEpi(
  entregas: readonly EntregaEpi[],
  epiId: string,
  periodicidadeTrocaMeses: number | null | undefined,
  hoje: Date
): {
  situacao: Exclude<SituacaoItem, "SEM_FUNCAO">;
  vencimento: string | null;
  /**
   * Quando o EPI foi entregue pela última vez.
   *
   * Devolvido junto porque é a METADE AFIRMATIVA da resposta. Só com `situacao`
   * dá para dizer que falta alguma coisa; para dizer que o EPI exigido pela
   * função **consta como entregue** — que é o que um dossiê precisa provar — é
   * preciso a data da entrega.
   */
  ultimaEntrega: string | null;
} {
  const doEpi = entregas.filter((e) => e.epiId === epiId);
  if (doEpi.length === 0) {
    return { situacao: "NUNCA_FEITO", vencimento: null, ultimaEntrega: null };
  }

  const ultima = doEpi.map((e) => e.dataEntrega).sort().at(-1) as string;

  if (!periodicidadeTrocaMeses || periodicidadeTrocaMeses <= 0) {
    return { situacao: "OK", vencimento: null, ultimaEntrega: ultima };
  }

  const proximaTroca = somarMeses(comoData(ultima), periodicidadeTrocaMeses);
  const vencida = proximaTroca < hoje;

  return {
    situacao: vencida ? "VENCIDO" : "OK",
    vencimento: comoIso(proximaTroca),
    ultimaEntrega: ultima,
  };
}

export interface ResumoMatriz {
  colaboradoresAvaliados: number;
  semFuncao: number;
  emDia: number;
  comPendencia: number;
  pendenciasTreinamento: number;
  pendenciasEpi: number;
}

/**
 * O mesmo resumo, recortado por função.
 *
 * Permite a uma tela de função responder "quem exerce isto está regular?" sem
 * varrer a lista inteira de pendências no cliente — e sem depender do nome da
 * função para agrupar.
 */
export interface ResumoDaFuncao {
  colaboradores: number;
  emDia: number;
  comPendencia: number;
  pendenciasTreinamento: number;
  pendenciasEpi: number;
}

export const RESUMO_DA_FUNCAO_VAZIO: ResumoDaFuncao = {
  colaboradores: 0,
  emDia: 0,
  comPendencia: 0,
  pendenciasTreinamento: 0,
  pendenciasEpi: 0,
};

/**
 * Uma exigência da função já confrontada com o histórico do trabalhador —
 * INCLUSIVE quando está tudo certo.
 *
 * POR QUE O "ESTÁ TUDO CERTO" PRECISA EXISTIR COMO DADO
 *
 * A matriz nasceu para responder "quem está em falta", e por isso descartava todo
 * item em dia. O efeito colateral só apareceu no uso: o dossiê do trabalhador não
 * tinha como dizer que o EPI exigido pela função **foi entregue**, nem quando é a
 * próxima troca — a data era calculada por `situacaoEpi` e jogada fora na linha
 * seguinte.
 *
 * Um dossiê que só sabe listar problemas não serve para provar conformidade, que
 * é justamente para o que ele é pedido numa fiscalização.
 */
export interface ExigenciaAvaliada {
  tipo: "TREINAMENTO" | "EPI";
  itemId: string;
  itemNome: string;
  /** Falso = recomendado. Só o obrigatório vira pendência. */
  obrigatorio: boolean;
  situacao: Exclude<SituacaoItem, "SEM_FUNCAO">;
  /** Vencimento do treinamento, ou a data da próxima troca do EPI. */
  vencimento: string | null;
  /** Só para EPI: quando foi entregue e de quanto em quanto tempo se troca. */
  ultimaEntrega?: string | null;
  periodicidadeTrocaMeses?: number | null;
}

/**
 * Como a exigência é nomeada para quem lê.
 *
 * "Em dia" serve para treinamento, mas não para EPI: o que se quer saber de um
 * capacete é se ele foi ENTREGUE. E "Vencido" num EPI não significa que o
 * equipamento estragou — significa que passou da data de troca programada, que é
 * outra afirmação.
 */
export function rotuloDaExigencia(e: ExigenciaAvaliada): string {
  if (e.tipo === "EPI") {
    if (e.situacao === "OK") return "Entregue";
    if (e.situacao === "VENCIDO") return "Troca vencida";
    return "Nunca entregue";
  }
  return SITUACAO_ITEM_LABEL[e.situacao];
}

/**
 * A frase que sustenta o rótulo: datas e periodicidade.
 *
 * Recebe o formatador de data de fora para continuar pura — a tela e o PDF
 * formatam data de jeitos diferentes e precisam do mesmo texto.
 */
export function detalheDaExigencia(
  e: ExigenciaAvaliada,
  formatarData: (iso?: string | null) => string
): string {
  if (e.tipo === "EPI") {
    if (e.situacao === "NUNCA_FEITO") return "";

    const entrega = e.ultimaEntrega ? `entregue em ${formatarData(e.ultimaEntrega)}` : "";

    if (e.situacao === "VENCIDO") {
      const venc = e.vencimento ? `troca venceu em ${formatarData(e.vencimento)}` : "";
      return [entrega, venc].filter(Boolean).join(" · ");
    }

    // Sem periodicidade cadastrada não há previsão de troca — e inventar uma
    // seria afirmar um prazo que ninguém definiu.
    const troca = e.vencimento
      ? `próxima troca em ${formatarData(e.vencimento)}${
          e.periodicidadeTrocaMeses ? ` (a cada ${e.periodicidadeTrocaMeses} meses)` : ""
        }`
      : "sem troca programada";

    return [entrega, troca].filter(Boolean).join(" · ");
  }

  if (e.situacao === "OK") {
    return e.vencimento ? `válido até ${formatarData(e.vencimento)}` : "sem vencimento";
  }
  if (e.situacao === "VENCIDO" && e.vencimento) {
    return `venceu em ${formatarData(e.vencimento)}`;
  }
  return "";
}

export interface ResultadoMatriz {
  pendencias: PendenciaItem[];
  resumo: ResumoMatriz;
  /**
   * Indexado por id de função. Função sem ninguém não aparece aqui — quem
   * consome trata a ausência como zero, mas só depois de saber que o cálculo
   * terminou: ausência durante o carregamento não é zero.
   */
  porFuncao: Record<string, ResumoDaFuncao>;
  /**
   * Todas as exigências de cada trabalhador, em dia ou não, indexadas por id de
   * colaborador. Sai do MESMO cálculo das pendências de propósito: uma segunda
   * função avaliando a mesma regra acabaria divergindo dela, e aí a tela e a
   * lista de pendências passariam a discordar sobre o mesmo trabalhador.
   */
  exigenciasPorColaborador: Record<string, ExigenciaAvaliada[]>;
}

/**
 * Cruza colaboradores com as exigências da função de cada um.
 *
 * Só itens marcados como obrigatórios geram pendência: recomendação que aparece
 * como falta viraria ruído e o usuário passaria a ignorar a lista inteira.
 */
export function calcularMatriz(params: {
  colaboradores: readonly ColaboradorMatriz[];
  treinamentosPorFuncao: Readonly<Record<string, readonly ExigenciaTreinamento[]>>;
  episPorFuncao: Readonly<Record<string, readonly ExigenciaEpi[]>>;
  participacoes: readonly ParticipacaoTreinamento[];
  /**
   * NRs cadastradas a mao na ficha do trabalhador. Segunda fonte de baixa, e a
   * que prevalece quando discorda da turma. Opcional para nao quebrar quem ainda
   * nao passa a lista.
   */
  certificadosManuais?: readonly CertificadoManual[];
  entregas: readonly EntregaEpi[];
  hoje: Date;
}): ResultadoMatriz {
  const {
    colaboradores,
    treinamentosPorFuncao,
    episPorFuncao,
    participacoes,
    entregas,
    hoje,
  } = params;
  const certificadosManuais = params.certificadosManuais ?? [];

  const pendencias: PendenciaItem[] = [];
  const porFuncao: Record<string, ResumoDaFuncao> = {};
  const exigenciasPorColaborador: Record<string, ExigenciaAvaliada[]> = {};
  let semFuncao = 0;
  let emDia = 0;

  const daFuncao = (funcaoId: string): ResumoDaFuncao =>
    (porFuncao[funcaoId] ??= { ...RESUMO_DA_FUNCAO_VAZIO });

  for (const colaborador of colaboradores) {
    // Sem função não há como saber o que é exigido. Isto é uma pendência de
    // cadastro, não um "está tudo certo" — por isso entra na lista.
    if (!colaborador.funcaoId) {
      semFuncao += 1;
      pendencias.push({
        chave: `${colaborador.id}:sem-funcao`,
        colaboradorId: colaborador.id,
        colaborador: colaborador.nome,
        funcaoId: null,
        funcaoNome: null,
        obra: colaborador.obra,
        tipo: "TREINAMENTO",
        itemId: "",
        itemNome: "Função não definida no cadastro",
        situacao: "SEM_FUNCAO",
        vencimento: null,
      });
      continue;
    }

    const resumoFuncao = daFuncao(colaborador.funcaoId);
    resumoFuncao.colaboradores += 1;

    const minhasParticipacoes = participacoes.filter(
      (p) => p.colaboradorId === colaborador.id
    );
    const meusCertificados = certificadosManuais.filter(
      (c) => c.colaboradorId === colaborador.id
    );
    const minhasEntregas = entregas.filter((e) => e.colaboradorId === colaborador.id);

    // TODAS as exigências são avaliadas, inclusive as recomendadas e as que estão
    // em dia. O filtro de obrigatoriedade passou a ser aplicado só na hora de
    // decidir o que vira PENDÊNCIA — antes ele era aplicado aqui, e por isso o
    // item em dia não existia nem como dado.
    const exigenciasTr = treinamentosPorFuncao[colaborador.funcaoId] ?? [];
    const exigenciasEpi = episPorFuncao[colaborador.funcaoId] ?? [];

    const avaliadas: ExigenciaAvaliada[] = [];
    exigenciasPorColaborador[colaborador.id] = avaliadas;

    let temPendencia = false;

    for (const exigencia of exigenciasTr) {
      const { situacao, vencimento } = situacaoTreinamento(
        minhasParticipacoes,
        exigencia.treinamentoId,
        hoje,
        { nomeExigido: exigencia.nome, certificadosManuais: meusCertificados }
      );

      avaliadas.push({
        tipo: "TREINAMENTO",
        itemId: exigencia.treinamentoId,
        itemNome: exigencia.nome,
        obrigatorio: exigencia.obrigatorio,
        situacao,
        vencimento,
      });

      // Recomendação em falta não é pendência: apareceria como cobrança e o
      // usuário passaria a ignorar a lista inteira.
      if (situacao === "OK" || !exigencia.obrigatorio) continue;

      temPendencia = true;
      resumoFuncao.pendenciasTreinamento += 1;
      pendencias.push({
        chave: `${colaborador.id}:tr:${exigencia.treinamentoId}`,
        colaboradorId: colaborador.id,
        colaborador: colaborador.nome,
        funcaoId: colaborador.funcaoId,
        funcaoNome: colaborador.funcaoNome,
        obra: colaborador.obra,
        tipo: "TREINAMENTO",
        itemId: exigencia.treinamentoId,
        itemNome: exigencia.nome,
        situacao,
        vencimento,
      });
    }

    for (const exigencia of exigenciasEpi) {
      const { situacao, vencimento, ultimaEntrega } = situacaoEpi(
        minhasEntregas,
        exigencia.epiId,
        exigencia.periodicidadeTrocaMeses,
        hoje
      );

      avaliadas.push({
        tipo: "EPI",
        itemId: exigencia.epiId,
        itemNome: exigencia.nome,
        obrigatorio: exigencia.obrigatorio,
        situacao,
        vencimento,
        ultimaEntrega,
        periodicidadeTrocaMeses: exigencia.periodicidadeTrocaMeses ?? null,
      });

      if (situacao === "OK" || !exigencia.obrigatorio) continue;

      temPendencia = true;
      resumoFuncao.pendenciasEpi += 1;
      pendencias.push({
        chave: `${colaborador.id}:epi:${exigencia.epiId}`,
        colaboradorId: colaborador.id,
        colaborador: colaborador.nome,
        funcaoId: colaborador.funcaoId,
        funcaoNome: colaborador.funcaoNome,
        obra: colaborador.obra,
        tipo: "EPI",
        itemId: exigencia.epiId,
        itemNome: exigencia.nome,
        situacao,
        vencimento,
      });
    }

    if (temPendencia) {
      resumoFuncao.comPendencia += 1;
    } else {
      emDia += 1;
      resumoFuncao.emDia += 1;
    }
  }

  return {
    pendencias: ordenarPendencias(pendencias),
    resumo: {
      colaboradoresAvaliados: colaboradores.length,
      semFuncao,
      emDia,
      comPendencia: new Set(
        pendencias.filter((p) => p.situacao !== "SEM_FUNCAO").map((p) => p.colaboradorId)
      ).size,
      pendenciasTreinamento: pendencias.filter(
        (p) => p.tipo === "TREINAMENTO" && p.situacao !== "SEM_FUNCAO"
      ).length,
      pendenciasEpi: pendencias.filter((p) => p.tipo === "EPI").length,
    },
    porFuncao,
    exigenciasPorColaborador,
  };
}

/** Nunca feito primeiro: é mais grave que vencido, que ao menos já foi feito. */
const ORDEM_SITUACAO: Record<SituacaoItem, number> = {
  NUNCA_FEITO: 0,
  VENCIDO: 1,
  SEM_FUNCAO: 2,
  OK: 3,
};

export function ordenarPendencias<T extends { situacao: SituacaoItem; colaborador: string }>(
  itens: readonly T[]
): T[] {
  return [...itens].sort((a, b) => {
    const porSituacao = ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao];
    if (porSituacao !== 0) return porSituacao;
    return a.colaborador.localeCompare(b.colaborador, "pt-BR");
  });
}

/**
 * O que a tela deve mostrar na contagem de quem exerce uma função.
 *
 * Existe como função pura porque a ORDEM dos casos é a regra, e regra em JSX não
 * se testa: se "sem colaborador" for avaliado antes de "calculando", a tela
 * afirma que ninguém exerce a função enquanto a consulta ainda está em curso —
 * e ausência de resultado não é resultado zero.
 */
export type EstadoContagemFuncao =
  | { tipo: "CALCULANDO" }
  | { tipo: "ERRO" }
  | { tipo: "SEM_COLABORADOR" }
  | { tipo: "CONTAGEM"; resumo: ResumoDaFuncao };

export function estadoDaContagem(params: {
  isLoading: boolean;
  temErro: boolean;
  /** Recorte da função, ou `undefined` quando ela não está no mapa. */
  resumo: ResumoDaFuncao | undefined;
}): EstadoContagemFuncao {
  // Carregando vem primeiro: durante a consulta não se sabe nada ainda.
  if (params.isLoading) return { tipo: "CALCULANDO" };
  // Erro antes de zero: falhar em contar não é contar zero.
  if (params.temErro) return { tipo: "ERRO" };
  if (!params.resumo) return { tipo: "SEM_COLABORADOR" };
  return { tipo: "CONTAGEM", resumo: params.resumo };
}
