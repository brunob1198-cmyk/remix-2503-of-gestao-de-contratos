import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import {
  estilosDocumentoSgsst,
  escDoc as esc,
  dataBrDoc as dataBr,
} from "@/lib/sgsstDocumentoEstilos";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";
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

function faltando(rotulo: string): string {
  return `<span class="doc-falta">${esc(rotulo)}</span>`;
}

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

export function montarHtmlListaPresenca(dados: ListaPresencaDados): string {
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
  const colunasDeAssinatura =
    colunaUnica || dias.length === 0
      ? [{ rotulo: "Assinatura" }]
      : dias.map((d) => ({ rotulo: dataBr(d) }));

  const celulasVazias = colunasDeAssinatura.map(() => "<td></td>").join("");

  const linhasInscritos = participantes
    .map((p, i) => {
      const nome = nomeDoParticipante(p);
      return `<tr>
        <td class="num">${i + 1}</td>
        <td>${esc(nome) || faltando("sem nome")}</td>
        <td>${esc(p.colaborador?.cpf) || "—"}</td>
        <td>${esc(p.colaborador?.funcao?.nome) || "—"}</td>
        ${celulasVazias}
      </tr>`;
    })
    .join("");

  // As linhas em branco saem numeradas na sequência: numerar é o que impede de
  // acrescentarem uma linha a lápis no rodapé depois da folha assinada.
  const linhasVazias = Array.from({ length: vazias }, (_, i) => {
    return `<tr class="linha-vazia">
      <td class="num">${participantes.length + i + 1}</td>
      <td></td><td></td><td></td>
      ${celulasVazias}
    </tr>`;
  }).join("");

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    <style>
      /* Altura de linha suficiente para caber assinatura de próprio punho. Uma
         tabela compacta economiza papel e inutiliza a folha. */
      table.doc-tabela tbody td { height: 30px; }
      table.doc-tabela .num { width: 24px; text-align: center; }
      .linha-vazia td { background: #fff; }
      .col-assin { width: 90px; }
    </style>
    <div class="doc">

      <div class="doc-cab">
        <h1>Lista de Presença</h1>
        <p class="doc-sub">
          ${turma.codigo_turma ? `Turma ${esc(turma.codigo_turma)} · ` : ""}Registro de frequência — NR-01 item 1.7
        </p>
      </div>

      ${
        reimpressao
          ? `<div class="doc-aviso">
              <strong>Turma já concluída — esta é uma segunda via.</strong>
              A folha assinada de próprio punho é a que vale como registro de
              frequência. Esta cópia serve de conferência, e não a substitui.
             </div>`
          : ""
      }

      <div class="doc-ident">
        <table>
          <tr>
            <td class="rot">Organização</td>
            <td><strong>${esc(turma.empresa_nome || empresa?.nome) || faltando("não informada")}</strong></td>
            <td class="rot">CNPJ</td>
            <td>${esc(turma.empresa_cnpj || empresa?.cnpj) || "—"}</td>
          </tr>
          <tr>
            <td class="rot">Curso</td>
            <td><strong>${esc(turma.treinamento?.nome) || faltando("não identificado")}</strong></td>
            <td class="rot">Carga horária</td>
            <td>${carga ? `${carga} horas` : faltando("não informada")}</td>
          </tr>
          <tr>
            <td class="rot">Período</td>
            <td>${
              turma.data_inicial
                ? turma.data_final && turma.data_final !== turma.data_inicial
                  ? `${dataBr(turma.data_inicial)} a ${dataBr(turma.data_final)}`
                  : dataBr(turma.data_inicial)
                : faltando("não informado")
            }</td>
            <td class="rot">Modalidade</td>
            <td>${esc(MODALIDADE_LABEL[turma.modalidade] ?? turma.modalidade)}</td>
          </tr>
          <tr>
            <td class="rot">Instrutor</td>
            <td>${esc(turma.instrutor) || faltando("não informado")}</td>
            <td class="rot">Local</td>
            <td>${esc(turma.local) || (turma.modalidade === "ONLINE" ? "—" : faltando("não informado"))}</td>
          </tr>
        </table>
      </div>

      <h2 class="doc-sec">Frequência</h2>
      <table class="doc-tabela">
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Nome</th>
            <th>CPF</th>
            <th>Função</th>
            ${colunasDeAssinatura
              .map((c) => `<th class="col-assin">${esc(c.rotulo)}</th>`)
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${linhasInscritos}
          ${linhasVazias}
        </tbody>
      </table>

      <p class="doc-neutro">
        ${
          colunaUnica && dias.length > 0
            ? "O período é longo demais para uma coluna por dia; a assinatura cobre o período inteiro. "
            : ""
        }As linhas numeradas em branco existem para quem comparecer sem estar
        matriculado. Linha não utilizada deve ser inutilizada com um traço.
      </p>

      <div class="doc-assin">
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(turma.instrutor) || "&nbsp;"}</div>
          <hr>
          <p>Instrutor${
            turma.instrutor_qualificacao ? ` — ${esc(turma.instrutor_qualificacao)}` : ""
          }</p>
        </div>
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(turma.responsavel_tecnico) || "&nbsp;"}</div>
          <hr>
          <p>Responsável técnico</p>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${geradoPor ? ` por ${esc(geradoPor)}` : ""} ·
        Lista de presença — NR-01 item 1.7
      </div>
    </div>
  `;
}

function nomeArquivo(turma: SgsstTreinamentoTurma): string {
  const base = turma.codigo_turma || turma.treinamento?.nome || "turma";
  return `Lista_Presenca_${base.replace(/[^\w-]+/g, "_").slice(0, 48)}.pdf`;
}

export async function gerarPdfListaPresenca(dados: ListaPresencaDados): Promise<void> {
  await emitirPdfTimbrado({
    html: montarHtmlListaPresenca(dados),
    nomeArquivo: nomeArquivo(dados.turma),
    identificacao: `Lista de presença — ${
      dados.turma.codigo_turma || dados.turma.treinamento?.nome || ""
    }`.slice(0, 88),
  });
}
