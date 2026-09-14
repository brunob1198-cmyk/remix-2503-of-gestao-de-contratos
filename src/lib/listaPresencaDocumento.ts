import { dataBrDoc as dataBr } from "@/lib/sgsstDocumentoEstilos";
import {
  arquivoPdfDireto,
  baixarPdfDireto,
  type Bloco,
  type CelulaDaTabela,
  type ColunaDaTabela,
  type ParDeIdentificacao,
} from "@/lib/documentoPdfDireto";
import {
  diasDaTurma,
  linhasEmBranco,
  situacaoDaFolha,
} from "@/utils/sgsstListaPresenca";
import type {
  SgsstTreinamentoParticipante,
  SgsstTreinamentoTurma,
} from "@/hooks/sgsst/useSgsstTreinamentos";

/**
 * Lista de presença da turma.
 *
 * O módulo tinha o certificado e não tinha a folha de presença — e o subtítulo da
 * própria tela já anunciava "lista de presença". O certificado prova o resultado;
 * a lista prova a frequência, que é o que a NR-01 1.7 pede junto com ele e o que
 * a fiscalização confere primeiro, porque é o documento com assinatura de próprio
 * punho.
 *
 * QUATRO DECISÕES
 *
 * 1. **Uma coluna de assinatura por dia.** Treinamento de NR tem dois ou três
 *    dias, e quem faltou no segundo não cumpriu a carga horária. Assinatura única
 *    numa turma de três dias é exatamente o vício que a folha existe para
 *    impedir.
 *
 * 2. **Linhas em branco no fim.** A folha circula na sala, e aparece quem não
 *    estava matriculado — o ajudante que entrou ontem, o fiscal do cliente. Sem
 *    linha para eles, alguém assina na margem ou não assina.
 *
 * 3. **Não imprime resultado nem aprovação.** A folha é assinada ANTES de existir
 *    nota. Uma coluna "APROVADO" preenchida numa folha que ainda vai ser assinada
 *    afirma o resultado de um treinamento que não aconteceu.
 *
 * 4. **Diz se é folha para assinar ou reimpressão.** Emitida com a turma
 *    concluída, é a segunda via de um registro que já deveria estar assinado em
 *    papel — e sair igual à primeira faria a via limpa parecer documento válido.
 *
 * ESTE É O PRIMEIRO DOCUMENTO DESENHADO DIRETO EM PDF
 *
 * Os demais ainda passam por HTML e são rasterizados pelo `html2pdf`. Este foi o
 * piloto da migração por ser o mais tabular e o que menos depende de foto — e
 * porque a folha de presença é justamente onde a paginação importa: uma turma de
 * trinta pessoas atravessa a quebra de página, e o cabeçalho da tabela precisava
 * se repetir, coisa que o raster nunca soube fazer. Ver `documentoPdfDireto`.
 */

export interface ListaPresencaDados {
  turma: SgsstTreinamentoTurma;
  participantes: readonly SgsstTreinamentoParticipante[];
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  geradoPor?: string | null;
}

// O enum e PRESENCIAL | ONLINE | HIBRIDO. A tela chama a modalidade remota de
// "EAD" no texto, entao o rotulo diz os dois para quem le a folha reconhecer.
const MODALIDADE_LABEL: Record<string, string> = {
  PRESENCIAL: "Presencial",
  ONLINE: "EAD / Online",
  HIBRIDO: "Híbrido",
};

/** Larguras fixas da tabela de frequência, em pontos. */
const LARGURA = {
  numero: 18,
  cpf: 72,
  /** Espaço confortável para assinatura de próprio punho (~24 mm). */
  assinatura: 67.5,
  /** O mínimo que Nome e Função somados precisam para não virar duas letras. */
  minimoDeNomeEFuncao: 200,
} as const;

/** Altura da linha: precisa caber uma assinatura de próprio punho. */
const ALTURA_DA_LINHA = 22.5;

function nomeDoParticipante(p: SgsstTreinamentoParticipante): string {
  return (
    p.colaborador?.profile?.nome ||
    p.colaborador?.recurso?.nome ||
    p.colaborador?.nome ||
    ""
  );
}

/**
 * O que falta para a folha valer como registro.
 *
 * Carga horária e instrutor entram porque são o que a fiscalização confere na
 * folha; sem eles ela prova que as pessoas estavam numa sala, não que receberam
 * treinamento.
 */
export function pendenciasListaPresenca(dados: ListaPresencaDados): string[] {
  const { turma, participantes } = dados;
  const p: string[] = [];

  if (participantes.length === 0) {
    p.push("Nenhum participante matriculado — a folha sai apenas com linhas em branco");
  }

  if (!turma.treinamento?.nome?.trim()) {
    p.push("Curso não identificado na turma");
  }

  if (!(turma.carga_horaria ?? turma.treinamento?.carga_horaria)) {
    p.push("Carga horária não informada — é o que a frequência precisa comprovar");
  }

  if (!turma.instrutor?.trim()) {
    p.push("Instrutor não informado");
  }

  if (!turma.local?.trim() && turma.modalidade !== "ONLINE") {
    p.push("Local do treinamento não informado");
  }

  if (!turma.data_inicial) {
    p.push("Data inicial não informada — a folha sai sem coluna de assinatura por dia");
  }

  if (!dados.empresa?.nome?.trim() && !turma.empresa_nome?.trim()) {
    p.push("Identificação da organização ausente");
  }

  return p;
}

/**
 * Largura de cada coluna de assinatura.
 *
 * Com uma coluna, a largura confortável. Com seis — o teto de dias da turma — não
 * há 67,5pt para cada sem espremer Nome e Função a duas letras, então elas
 * dividem o que sobra depois de reservado o mínimo para identificar a pessoa.
 * Identificar quem assinou vale mais que o tamanho do campo de assinatura.
 */
export function larguraDaColunaDeAssinatura(params: {
  larguraUtil: number;
  colunas: number;
}): number {
  if (params.colunas <= 0) return 0;
  const disponivel =
    params.larguraUtil - LARGURA.numero - LARGURA.cpf - LARGURA.minimoDeNomeEFuncao;
  return Math.max(24, Math.min(LARGURA.assinatura, disponivel / params.colunas));
}

export function montarBlocosListaPresenca(
  dados: ListaPresencaDados,
  larguraUtil: number
): Bloco[] {
  const { turma, participantes, empresa, geradoPor } = dados;
  const emitidoEm = new Date().toLocaleString("pt-BR");

  const { dias, colunaUnica } = diasDaTurma({
    dataInicial: turma.data_inicial,
    dataFinal: turma.data_final,
  });
  const vazias = linhasEmBranco({
    inscritos: participantes.length,
    capacidade: turma.capacidade,
  });
  const reimpressao = situacaoDaFolha(turma.status) === "DEPOIS_DO_TREINAMENTO";
  const carga = turma.carga_horaria ?? turma.treinamento?.carga_horaria ?? null;

  // Cabeçalho das colunas de assinatura. Com coluna única, uma só com o período.
  const rotulosDeAssinatura =
    colunaUnica || dias.length === 0 ? ["Assinatura"] : dias.map((d) => dataBr(d));

  const larguraAssin = larguraDaColunaDeAssinatura({
    larguraUtil,
    colunas: rotulosDeAssinatura.length,
  });

  const colunas: ColunaDaTabela[] = [
    { rotulo: "#", largura: LARGURA.numero, alinhamento: "centro" },
    { rotulo: "Nome" },
    { rotulo: "CPF", largura: LARGURA.cpf },
    { rotulo: "Função" },
    ...rotulosDeAssinatura.map((rotulo) => ({ rotulo, largura: larguraAssin })),
  ];

  /**
   * A célula de assinatura da pessoa, marcada para a assinatura eletrônica saber
   * onde carimbar o nome dela.
   *
   * SÓ QUANDO A FOLHA TEM UMA COLUNA. Com uma coluna por dia, a assinatura
   * eletrônica é UM ato e não diz nada sobre cada dia separadamente — carimbá-la
   * nas três colunas afirmaria presença em três dias a partir de um clique, que é
   * exatamente o vício que a coluna por dia existe para impedir.
   */
  const celulasDeAssinatura = (nome: string): CelulaDaTabela[] =>
    rotulosDeAssinatura.map((_, i) => ({
      texto: "",
      ancoraDeAssinatura:
        i === 0 && rotulosDeAssinatura.length === 1 && nome.trim() ? nome : undefined,
    }));

  const linhasInscritos = participantes.map((p, i) => {
    const nome = nomeDoParticipante(p);
    return [
      { texto: String(i + 1) },
      { texto: nome || "(sem nome)" },
      { texto: p.colaborador?.cpf || "—" },
      { texto: p.colaborador?.funcao?.nome || "—" },
      ...celulasDeAssinatura(nome),
    ];
  });

  // As linhas em branco saem numeradas na sequência: numerar é o que impede de
  // acrescentarem uma linha a lápis no rodapé depois da folha assinada.
  const linhasVazias = Array.from({ length: vazias }, (_, i) => [
    { texto: String(participantes.length + i + 1) },
    { texto: "" },
    { texto: "" },
    { texto: "" },
    ...rotulosDeAssinatura.map(() => ({ texto: "" })),
  ]);

  const identificacao: ParDeIdentificacao[] = [
    {
      rotulo: "Organização",
      valor: turma.empresa_nome || empresa?.nome || "não informada",
      forte: true,
      falta: !(turma.empresa_nome || empresa?.nome),
    },
    { rotulo: "CNPJ", valor: turma.empresa_cnpj || empresa?.cnpj || "—" },
    {
      rotulo: "Curso",
      valor: turma.treinamento?.nome || "não identificado",
      forte: true,
      falta: !turma.treinamento?.nome,
    },
    {
      rotulo: "Carga horária",
      valor: carga ? `${carga} horas` : "não informada",
      falta: !carga,
    },
    {
      rotulo: "Período",
      valor: turma.data_inicial
        ? turma.data_final && turma.data_final !== turma.data_inicial
          ? `${dataBr(turma.data_inicial)} a ${dataBr(turma.data_final)}`
          : dataBr(turma.data_inicial)
        : "não informado",
      falta: !turma.data_inicial,
    },
    {
      rotulo: "Modalidade",
      valor: MODALIDADE_LABEL[turma.modalidade] ?? turma.modalidade ?? "—",
    },
    {
      rotulo: "Instrutor",
      valor: turma.instrutor || "não informado",
      falta: !turma.instrutor,
    },
    {
      rotulo: "Local",
      valor:
        turma.local || (turma.modalidade === "ONLINE" ? "—" : "não informado"),
      falta: !turma.local && turma.modalidade !== "ONLINE",
    },
  ];

  const blocos: Bloco[] = [
    {
      tipo: "cabecalho",
      titulo: "Lista de Presença",
      subtitulo: `${
        turma.codigo_turma ? `Turma ${turma.codigo_turma} · ` : ""
      }Registro de frequência — NR-01 item 1.7`,
    },
  ];

  if (reimpressao) {
    blocos.push({
      tipo: "aviso",
      titulo: "Turma já concluída — esta é uma segunda via.",
      texto:
        "A folha assinada de próprio punho é a que vale como registro de frequência. " +
        "Esta cópia serve de conferência, e não a substitui.",
    });
  }

  blocos.push(
    { tipo: "identificacao", pares: identificacao },
    { tipo: "secao", titulo: "Frequência" },
    {
      tipo: "tabela",
      colunas,
      linhas: [...linhasInscritos, ...linhasVazias],
      alturaDaLinha: ALTURA_DA_LINHA,
    },
    {
      tipo: "paragrafo",
      fraco: true,
      texto:
        (colunaUnica && dias.length > 0
          ? "O período é longo demais para uma coluna por dia; a assinatura cobre o período inteiro. "
          : "") +
        "As linhas numeradas em branco existem para quem comparecer sem estar matriculado. " +
        "Linha não utilizada deve ser inutilizada com um traço.",
    },
    {
      tipo: "assinaturas",
      campos: [
        {
          nome: turma.instrutor,
          papel: `Instrutor${
            turma.instrutor_qualificacao ? ` — ${turma.instrutor_qualificacao}` : ""
          }`,
        },
        { nome: turma.responsavel_tecnico, papel: "Responsável técnico" },
      ],
    },
    {
      tipo: "paragrafo",
      fraco: true,
      texto: `Emitido em ${emitidoEm}${
        geradoPor ? ` por ${geradoPor}` : ""
      } · Lista de presença — NR-01 item 1.7`,
    }
  );

  return blocos;
}

function nomeArquivo(turma: SgsstTreinamentoTurma): string {
  const base = turma.codigo_turma || turma.treinamento?.nome || "turma";
  return `Lista_Presenca_${base.replace(/[^\w-]+/g, "_").slice(0, 48)}.pdf`;
}

function identificacaoDoRodape(dados: ListaPresencaDados): string {
  return `Lista de presença — ${
    dados.turma.codigo_turma || dados.turma.treinamento?.nome || ""
  }`.slice(0, 88);
}

/**
 * Largura útil da folha, em pontos.
 *
 * A montagem dos blocos precisa dela para dividir as colunas da tabela. Vem da
 * mesma geometria que o renderizador usa, e não de um número repetido aqui.
 */
async function larguraUtilEmPontos(): Promise<number> {
  const { geometriaDaFolha } = await import("@/lib/sgsstPapelTimbrado");
  return geometriaDaFolha().larguraUtilMm * (72 / 25.4);
}

export async function gerarPdfListaPresenca(dados: ListaPresencaDados): Promise<void> {
  const largura = await larguraUtilEmPontos();
  await baixarPdfDireto(
    {
      blocos: montarBlocosListaPresenca(dados, largura),
      identificacao: identificacaoDoRodape(dados),
    },
    nomeArquivo(dados.turma)
  );
}

/**
 * A mesma lista de presença, como arquivo para a fila de assinatura.
 *
 * Sem download: aqui o PDF vai para o armazenamento e fica anexado à
 * solicitação, para cada signatário abrir e ler antes de assinar.
 *
 * As âncoras de assinatura saem exatas, e não medidas: quem desenha a célula sabe
 * onde ela ficou. No caminho por HTML era preciso interromper o html2pdf no meio
 * e medir o clone dele.
 */
export async function gerarArquivoListaPresenca(dados: ListaPresencaDados): Promise<File> {
  const largura = await larguraUtilEmPontos();
  return arquivoPdfDireto(
    {
      blocos: montarBlocosListaPresenca(dados, largura),
      identificacao: identificacaoDoRodape(dados),
    },
    nomeArquivo(dados.turma)
  );
}
