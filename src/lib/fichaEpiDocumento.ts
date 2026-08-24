import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import {
  estilosDocumentoSgsst,
  escDoc as esc,
  dataBrDoc as dataBr,
} from "@/lib/sgsstDocumentoEstilos";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";
import type {
  SgsstEpiEntrega,
  SgsstEpiDevolucao,
  SgsstEpiManutencao,
} from "@/hooks/sgsst/useSgsstEpis";
import { previsaoTroca } from "@/utils/sgsstEpiVidaUtil";
import {
  TIPO_MANUTENCAO_LABEL,
  situacaoHigienizacao,
  higienizacaoPendente,
  SITUACAO_HIGIENIZACAO_LABEL,
} from "@/utils/sgsstEpiHigienizacao";

/**
 * Ficha de Entrega de EPI — NR-06 item 6.6.1 alínea "h".
 *
 * A norma obriga o empregador a **registrar o fornecimento** do EPI ao
 * trabalhador, e admite ficha, livro ou sistema eletrônico. O sistema tinha o
 * registro eletrônico e não tinha como imprimi-lo — e é justamente a via impressa
 * e assinada que se apresenta quando o fornecimento é contestado.
 *
 * Três decisões que definem o documento:
 *
 * 1. **Uma linha de assinatura por entrega, não uma no pé da folha.** A norma pede
 *    prova de cada fornecimento. Uma assinatura única no fim não diz nada sobre a
 *    luva entregue em março.
 *
 * 2. **O número do CA sai em cada linha.** EPI sem Certificado de Aprovação não é
 *    EPI para efeito da norma (6.2). Uma ficha que lista "luva" sem o CA não
 *    comprova que se entregou equipamento aprovado.
 *
 * 3. **Entrega feita com CA já vencido sai marcada.** Isso é comparação entre a
 *    data da entrega e a validade do CA — não é opinião, é aritmética. O sistema
 *    hoje bloqueia entrega com CA vencido, mas registros anteriores a essa regra
 *    existem, e esconder um deles na impressão seria produzir um documento que
 *    afirma mais do que os dados sustentam.
 */

export interface FichaEpiDados {
  /** Entregas do trabalhador, em qualquer ordem. */
  entregas: readonly SgsstEpiEntrega[];
  /** Devoluções ligadas a essas entregas. */
  devolucoes: readonly SgsstEpiDevolucao[];
  /**
   * Higienizações, manutenções e inspeções das peças que estão com este
   * trabalhador — NR-06 6.6.1 alínea "f". Opcional para não quebrar chamadas
   * antigas; quando vazia, a seção diz que não há registro em vez de desaparecer.
   */
  manutencoes?: readonly SgsstEpiManutencao[];
  nomeTrabalhador: string;
  cpfTrabalhador?: string | null;
  funcaoTrabalhador?: string | null;
  matriculaTrabalhador?: string | null;
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  geradoPor?: string | null;
}

const MOTIVO_LABEL: Record<string, string> = {
  PRIMEIRA_ENTREGA: "Primeira entrega",
  SUBSTITUICAO: "Substituição",
  PERDA: "Perda",
  DANIFICADO: "Danificado",
  VENCIMENTO: "Vencimento",
  OUTROS: "Outros",
};

const CONDICAO_LABEL: Record<string, string> = {
  BOM: "Bom estado",
  DANIFICADO: "Danificado",
  INUTILIZADO: "Inutilizado",
  VENCIDO: "Vencido",
};

function faltando(rotulo: string): string {
  return `<span class="doc-falta">${esc(rotulo)}</span>`;
}

/**
 * Verdadeiro quando o CA já estava vencido na data da entrega.
 *
 * Compara duas datas do próprio registro. Sem validade cadastrada não há como
 * afirmar nada — e não afirmar é o correto.
 */
export function entregaComCaVencido(entrega: SgsstEpiEntrega): boolean {
  const validade = entrega.epi?.validade_ca;
  if (!validade || !entrega.data_entrega) return false;
  return validade < entrega.data_entrega;
}

/** Quantidade ainda sob responsabilidade do trabalhador, por entrega. */
export function saldoEmPosse(
  entrega: SgsstEpiEntrega,
  devolucoes: readonly SgsstEpiDevolucao[]
): number {
  const devolvido = devolucoes
    .filter((d) => d.entrega_id === entrega.id)
    .reduce((soma, d) => soma + (d.quantidade_devolvida || 0), 0);

  // Nunca negativo: devolução maior que a entrega é erro de lançamento, e a ficha
  // não deve transformá-lo em dívida do trabalhador.
  return Math.max(0, (entrega.quantidade || 0) - devolvido);
}

/** Pendências da ficha, na ordem em que fragilizam o registro. */
export function pendenciasFichaEpi(dados: FichaEpiDados): string[] {
  const { entregas, nomeTrabalhador, cpfTrabalhador, empresa } = dados;
  const p: string[] = [];

  if (entregas.length === 0) {
    p.push("Nenhuma entrega registrada para este trabalhador");
  }

  if (!cpfTrabalhador?.trim()) {
    p.push("CPF do trabalhador não informado — a ficha não identifica quem recebeu");
  }
  if (!nomeTrabalhador?.trim()) {
    p.push("Nome do trabalhador não informado");
  }
  if (!empresa?.nome?.trim()) {
    p.push("Identificação da organização ausente");
  }

  const semCa = entregas.filter((e) => !e.epi?.ca?.trim());
  if (semCa.length > 0) {
    p.push(
      `${semCa.length} entrega(s) de EPI sem número de CA — sem CA não há equipamento aprovado (NR-06 6.2)`
    );
  }

  const caVencido = entregas.filter(entregaComCaVencido);
  if (caVencido.length > 0) {
    p.push(
      `${caVencido.length} entrega(s) feita(s) com o CA já vencido na data do fornecimento`
    );
  }

  const semResponsavel = entregas.filter((e) => !e.responsavel?.nome?.trim());
  if (semResponsavel.length > 0) {
    p.push(`${semResponsavel.length} entrega(s) sem responsável pelo fornecimento registrado`);
  }

  const semOrientacao = entregas.filter((e) => !e.orientacao_uso);
  if (semOrientacao.length > 0) {
    p.push(
      `${semOrientacao.length} entrega(s) sem registro de orientação de uso — a NR-06 6.6.1 alínea "d" obriga orientar e treinar`
    );
  }

  // Higienização pendente só é cobrada de equipamento reutilizável e com saldo em
  // posse: peça já devolvida deixou de ser responsabilidade deste trabalhador, e
  // descartável não tem higienização a fazer.
  const higienizacaoPendenteAqui = entregas.filter((e) => {
    if (!e.epi?.exige_higienizacao) return false;
    if (saldoEmPosse(e, dados.devolucoes) === 0) return false;

    const situacao = situacaoHigienizacao({
      exigeHigienizacao: e.epi.exige_higienizacao,
      periodicidadeDias: e.epi.higienizacao_periodicidade_dias,
      execucoes: (dados.manutencoes ?? []).filter((m) => m.entrega_id === e.id),
      hoje: new Date(),
    });

    return higienizacaoPendente(situacao.situacao);
  });

  if (higienizacaoPendenteAqui.length > 0) {
    p.push(
      `${higienizacaoPendenteAqui.length} equipamento(s) em posse com higienização pendente — a NR-06 6.6.1 alínea "f" exige higienização e manutenção periódica`
    );
  }

  return p;
}

/**
 * Texto da previsao de troca de uma entrega.
 *
 * Sem vida util cadastrada no EPI, a coluna diz que nao ha prazo — e nao inventa
 * um. Um padrao aplicado a tudo cobraria troca de cinto de seguranca no ritmo de
 * luva de raspa, e o usuario aprenderia a ignorar o aviso.
 */
function textoDaTroca(entrega: SgsstEpiEntrega, hoje: Date): string {
  const r = previsaoTroca({
    dataEntrega: entrega.data_entrega,
    vidaUtilMeses: entrega.epi?.vida_util_meses ?? null,
    hoje,
  });

  if (r.situacao === "SEM_PRAZO") return `<span class="doc-neutro">sem prazo</span>`;
  if (r.situacao === "VENCIDO") {
    return `<span class="doc-inapto">${dataBr(r.dataPrevista)} (vencida)</span>`;
  }
  if (r.situacao === "PROXIMO_DA_TROCA") {
    return `<span class="doc-restr">${dataBr(r.dataPrevista)}</span>`;
  }
  return dataBr(r.dataPrevista);
}

export function montarHtmlFichaEpi(dados: FichaEpiDados, hoje = new Date()): string {
  const {
    entregas,
    devolucoes,
    nomeTrabalhador,
    cpfTrabalhador,
    funcaoTrabalhador,
    matriculaTrabalhador,
    empresa,
    geradoPor,
  } = dados;

  const emitidoEm = new Date().toLocaleString("pt-BR");

  // Mais antiga primeiro: a ficha é um histórico, e histórico se lê na ordem em
  // que aconteceu.
  const ordenadas = [...entregas].sort((a, b) =>
    (a.data_entrega ?? "").localeCompare(b.data_entrega ?? "")
  );

  const totalEmPosse = ordenadas.reduce(
    (soma, e) => soma + saldoEmPosse(e, devolucoes),
    0
  );

  const linhasEntrega = ordenadas
    .map((e) => {
      const caVencido = entregaComCaVencido(e);
      const saldo = saldoEmPosse(e, devolucoes);

      return `<tr>
        <td>${dataBr(e.data_entrega)}</td>
        <td>
          ${esc(e.epi?.nome) || faltando("EPI removido")}
          ${e.tamanho_modelo ? `<br><span class="doc-neutro">${esc(e.tamanho_modelo)}</span>` : ""}
        </td>
        <td>${
          e.epi?.ca?.trim()
            ? `${esc(e.epi.ca)}${
                caVencido
                  ? `<br><span class="doc-inapto">CA vencido em ${dataBr(
                      e.epi.validade_ca
                    )}</span>`
                  : ""
              }`
            : faltando("sem CA")
        }</td>
        <td class="doc-num">${esc(e.quantidade)}</td>
        <td>${esc(MOTIVO_LABEL[e.motivo] ?? e.motivo)}</td>
        <td>${
          e.orientacao_uso
            ? "Sim"
            : `<span class="doc-inapto">Não registrada</span>`
        }</td>
        <td>${textoDaTroca(e, hoje)}</td>
        <td class="doc-num">${saldo}</td>
        <td>${esc(e.responsavel?.nome) || faltando("não registrado")}</td>
        <td class="doc-assin-linha"></td>
      </tr>`;
    })
    .join("");

  // Higienização e manutenção — NR-06 6.6.1 alínea "f".
  const execucoes = dados.manutencoes ?? [];

  const linhasManutencao = [...execucoes]
    .sort((a, b) => (a.data_execucao ?? "").localeCompare(b.data_execucao ?? ""))
    .map((m) => {
      const entrega = entregas.find((e) => e.id === m.entrega_id);
      return `<tr>
        <td>${dataBr(m.data_execucao)}</td>
        <td>${esc(m.epi?.nome) || esc(entrega?.epi?.nome) || "—"}</td>
        <td>${esc(TIPO_MANUTENCAO_LABEL[m.tipo] ?? m.tipo)}</td>
        <td class="doc-num">${esc(m.quantidade)}</td>
        <td>${esc(m.executado_por_nome) || esc(m.executado_por?.nome) || "—"}</td>
        <td>${
          m.resultado === "DESCARTADO"
            ? `<span class="doc-inapto">Descartado</span>`
            : m.resultado === "REPROVADO"
              ? `<span class="doc-restr">Reprovado</span>`
              : "Aprovado"
        }</td>
        <td>${m.proxima_prevista ? dataBr(m.proxima_prevista) : "—"}</td>
      </tr>`;
    })
    .join("");

  /**
   * Equipamentos reutilizáveis ainda em posse do trabalhador com higienização
   * atrasada ou nunca registrada.
   *
   * Peça já devolvida sai da conta: deixou de ser responsabilidade dele. E
   * descartável nunca entra — cobrar higienização de máscara PFF1 é ruído.
   */
  const equipamentosPendentes = entregas
    .filter((e) => e.epi?.exige_higienizacao && saldoEmPosse(e, devolucoes) > 0)
    .map((e) => ({
      nome: e.epi?.nome ?? "EPI",
      situacao: situacaoHigienizacao({
        exigeHigienizacao: e.epi?.exige_higienizacao,
        periodicidadeDias: e.epi?.higienizacao_periodicidade_dias,
        execucoes: execucoes.filter((m) => m.entrega_id === e.id),
        hoje,
      }).situacao,
    }))
    .filter((x) => higienizacaoPendente(x.situacao));

  const linhasDevolucao = [...devolucoes]
    .sort((a, b) => (a.data_devolucao ?? "").localeCompare(b.data_devolucao ?? ""))
    .map((d) => {
      const entrega = entregas.find((e) => e.id === d.entrega_id);
      return `<tr>
        <td>${dataBr(d.data_devolucao)}</td>
        <td>${esc(entrega?.epi?.nome) || "—"}</td>
        <td class="doc-num">${esc(d.quantidade_devolvida)}</td>
        <td>${esc(CONDICAO_LABEL[d.condicao_epi] ?? d.condicao_epi)}</td>
        <td>${esc(d.motivo) || "—"}</td>
        <td>${esc(d.responsavel?.nome) || "—"}</td>
      </tr>`;
    })
    .join("");

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    <div class="doc">

      <div class="doc-cab">
        <h1>Ficha de Entrega de EPI</h1>
        <p class="doc-sub">Registro de fornecimento · NR-06 item 6.6.1</p>
      </div>

      <div class="doc-ident">
        <table>
          <tr>
            <td class="rot">Organização</td>
            <td><strong>${esc(empresa?.nome) || faltando("não informada")}</strong></td>
            <td class="rot">CNPJ</td>
            <td>${esc(empresa?.cnpj) || "—"}</td>
          </tr>
          <tr>
            <td class="rot">Trabalhador</td>
            <td><strong>${esc(nomeTrabalhador) || faltando("não informado")}</strong></td>
            <td class="rot">CPF</td>
            <td>${esc(cpfTrabalhador) || faltando("não informado")}</td>
          </tr>
          <tr>
            <td class="rot">Função</td>
            <td>${esc(funcaoTrabalhador) || "—"}</td>
            <td class="rot">Matrícula</td>
            <td>${esc(matriculaTrabalhador) || "—"}</td>
          </tr>
        </table>
      </div>

      <div class="doc-bloco">
        <div class="tit">Equipamentos fornecidos</div>
        <div class="corpo">
          ${
            ordenadas.length === 0
              ? `<p class="doc-aviso">Nenhuma entrega registrada para este trabalhador. A
                  NR-06 exige o registro do fornecimento — ficha em branco não comprova
                  entrega nenhuma.</p>`
              : `<table class="doc-tabela">
                  <thead>
                    <tr>
                      <th>Data</th><th>EPI</th><th>CA</th><th>Qtd.</th>
                      <th>Motivo</th><th>Orientado</th><th>Troca prevista</th>
                      <th>Em posse</th><th>Entregue por</th>
                      <th>Recebi o EPI (assinatura)</th>
                    </tr>
                  </thead>
                  <tbody>${linhasEntrega}</tbody>
                  <tfoot>
                    <tr>
                      <td colspan="7"><strong>Total sob responsabilidade do trabalhador</strong></td>
                      <td class="doc-num"><strong>${totalEmPosse}</strong></td>
                      <td colspan="2"></td>
                    </tr>
                  </tfoot>
                 </table>
                 <p class="doc-neutro">
                   Cada assinatura acima corresponde a um fornecimento e vale como recibo
                   daquele item, na data indicada.
                 </p>`
          }
        </div>
      </div>

      ${
        devolucoes.length > 0
          ? `<div class="doc-bloco">
              <div class="tit">Devoluções</div>
              <div class="corpo">
                <table class="doc-tabela">
                  <thead>
                    <tr>
                      <th>Data</th><th>EPI</th><th>Qtd.</th><th>Condição</th>
                      <th>Motivo</th><th>Recebido por</th>
                    </tr>
                  </thead>
                  <tbody>${linhasDevolucao}</tbody>
                </table>
              </div>
             </div>`
          : ""
      }

      <div class="doc-bloco">
        <div class="tit">Higienização e manutenção — NR-06 item 6.6.1 alínea "f"</div>
        <div class="corpo">
          ${
            execucoes.length === 0
              ? `<p class="doc-aviso">Nenhuma higienização, manutenção ou inspeção
                  registrada para os equipamentos deste trabalhador. A NR-06 põe no
                  empregador a responsabilidade pela higienização e manutenção
                  periódica — sem registro, a periodicidade não tem como ser
                  comprovada.</p>`
              : `<table class="doc-tabela">
                  <thead>
                    <tr>
                      <th>Data</th><th>EPI</th><th>Tipo</th><th>Qtd.</th>
                      <th>Executado por</th><th>Resultado</th><th>Próxima</th>
                    </tr>
                  </thead>
                  <tbody>${linhasManutencao}</tbody>
                 </table>`
          }

          ${
            equipamentosPendentes.length === 0
              ? ""
              : `<p class="doc-aviso"><strong>${equipamentosPendentes.length}
                  equipamento(s) em posse com higienização pendente:</strong>
                  ${equipamentosPendentes
                    .map(
                      (x) =>
                        `${esc(x.nome)} — ${esc(
                          SITUACAO_HIGIENIZACAO_LABEL[x.situacao]
                        )}`
                    )
                    .join(" · ")}</p>`
          }
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Termo de responsabilidade — NR-06 item 6.7.1</div>
        <div class="corpo">
          <p>
            Declaro ter recebido gratuitamente os equipamentos de proteção individual
            relacionados nesta ficha, em perfeito estado de conservação, e ter sido
            orientado quanto ao uso, à guarda e à conservação de cada um deles.
          </p>
          <p>Comprometo-me a:</p>
          <p>a) usar o equipamento apenas para a finalidade a que se destina;</p>
          <p>b) responsabilizar-me pela guarda e conservação;</p>
          <p>c) comunicar ao empregador qualquer alteração que o torne impróprio para uso;</p>
          <p>d) cumprir as determinações do empregador sobre o uso adequado.</p>
          <p>
            Estou ciente de que o uso do EPI é obrigatório nas atividades em que ele é
            exigido e que a recusa injustificada constitui ato faltoso, nos termos da
            NR-01 item 1.4.2 alínea "b".
          </p>
        </div>
      </div>

      <div class="doc-assin">
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(nomeTrabalhador) || "&nbsp;"}</div>
          <hr>
          <p>Assinatura do trabalhador</p>
          <p>${esc(cpfTrabalhador) || "&nbsp;"}</p>
        </div>
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">&nbsp;</div>
          <hr>
          <p>Responsável pela segurança do trabalho</p>
          <p>Data: ____/____/______</p>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${geradoPor ? ` por ${esc(geradoPor)}` : ""} ·
        Registro de fornecimento de EPI conforme a NR-06 item 6.6.1
      </div>
    </div>
  `;
}

function nomeArquivo(dados: FichaEpiDados): string {
  const base = dados.nomeTrabalhador || "trabalhador";
  return `Ficha_EPI_${base.replace(/[^\w-]+/g, "_").slice(0, 48)}.pdf`;
}

export async function gerarPdfFichaEpi(dados: FichaEpiDados): Promise<void> {
  await emitirPdfTimbrado({
    html: montarHtmlFichaEpi(dados),
    nomeArquivo: nomeArquivo(dados),
    identificacao: `Ficha de EPI — ${dados.nomeTrabalhador}`.slice(0, 88),
  });
}
