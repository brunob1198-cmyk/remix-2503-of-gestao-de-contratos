import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import {
  estilosDocumentoSgsst,
  escDoc as esc,
  dataBrDoc as dataBr,
} from "@/lib/sgsstDocumentoEstilos";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";
import {
  blocoDeFotos,
  estilosFotosDocumento,
  type FotosPreparadas,
} from "@/lib/fotosDoDocumento";
import type {
  SgsstNaoConformidade,
  SgsstNaoConformidadeAcao,
} from "@/hooks/sgsst/useSgsstNaoConformidades";

/**
 * Emissão do relatório de não conformidade e plano de ação.
 *
 * A NR-01 1.5.5.2 exige plano de ação para as medidas de prevenção, com prazo e
 * responsável. Quando a não conformidade vem de acidente ou incidente, a análise
 * de causa é o item 1.5.5.5. Nada disso serve enquanto vive só no banco: o
 * relatório é o que vai ao responsável designado e o que fecha o ciclo com a
 * verificação de eficácia.
 *
 * Três decisões:
 *
 * 1. **Ação sem prazo ou sem responsável sai marcada.** Plano de ação sem os dois
 *    não é plano — é intenção. A norma pede exatamente esses dois campos.
 *
 * 2. **A verificação de eficácia é seção própria, mesmo vazia.** Fechar uma NC sem
 *    verificar se a ação funcionou é o furo mais comum do ciclo. Uma seção em
 *    branco cobra; a ausência da seção esconde.
 *
 * 3. **NC concluída sem verificação registrada recebe aviso.** É a contradição que
 *    o documento não pode deixar passar em silêncio: o status diz resolvido e não
 *    há prova de que a ação resolveu.
 */

export interface NcDocumentoDados {
  nc: SgsstNaoConformidade;
  acoes: readonly SgsstNaoConformidadeAcao[];
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  geradoPor?: string | null;
  /** Fotos do desvio: como foi encontrado e, depois de tratado, como ficou. */
  fotos?: FotosPreparadas;
  /**
   * Fotos de cada ação do plano, por id.
   *
   * Saem debaixo da tabela do plano, numeradas conforme a linha. A eficácia é
   * verificada por alguém que não esteve no local: a foto do "depois" é a única
   * coisa que sustenta o "ACEITA".
   */
  fotosPorAcao?: ReadonlyMap<string, FotosPreparadas>;
}

const ORIGEM_LABEL: Record<string, string> = {
  INSPECAO: "Inspeção de segurança",
  INCIDENTE: "Incidente ou acidente",
  PGR: "Programa de Gerenciamento de Riscos",
  APR: "Análise Preliminar de Riscos",
  PT: "Permissão de Trabalho",
  MANUAL: "Registro manual",
};

const CRITICIDADE_LABEL: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANALISE: "Em análise",
  PLANO_ACAO: "Plano de ação definido",
  EM_TRATAMENTO: "Em tratamento",
  AGUARDANDO_VERIFICACAO: "Aguardando verificação",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const TIPO_ACAO_LABEL: Record<string, string> = {
  CORRETIVA: "Corretiva",
  PREVENTIVA: "Preventiva",
  CONTENCAO: "Contenção",
  MELHORIA: "Melhoria",
};

const STATUS_ACAO_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const RESULTADO_LABEL: Record<string, string> = {
  ACEITA: "Ação aceita — eficácia confirmada",
  REJEITADA: "Ação rejeitada — não resolveu a causa",
};

function faltando(rotulo: string): string {
  return `<span class="doc-falta">${esc(rotulo)}</span>`;
}

/** Ações em aberto: nem concluídas, nem canceladas. */
export function acoesEmAberto(
  acoes: readonly SgsstNaoConformidadeAcao[]
): SgsstNaoConformidadeAcao[] {
  return acoes.filter((a) => a.status !== "CONCLUIDA" && a.status !== "CANCELADA");
}

/**
 * Ações em aberto cujo prazo já passou.
 *
 * Ação cancelada ou concluída não atrasa. Ação sem prazo não pode atrasar — e é
 * cobrada como pendência à parte, porque a falta do prazo é o problema.
 */
export function acoesAtrasadas(
  acoes: readonly SgsstNaoConformidadeAcao[],
  hoje: Date
): SgsstNaoConformidadeAcao[] {
  const hojeIso = comoIso(hoje);
  return acoesEmAberto(acoes).filter((a) => !!a.prazo && a.prazo < hojeIso);
}

/** Data local em "YYYY-MM-DD". `toISOString()` desloca o fuso e erra o dia. */
function comoIso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Verdadeiro quando a NC está fechada sem verificação de eficácia registrada. */
export function concluidaSemVerificacao(nc: SgsstNaoConformidade): boolean {
  return nc.status === "CONCLUIDA" && !nc.resultado_verificacao;
}

export function pendenciasNc(
  dados: NcDocumentoDados,
  hoje = new Date()
): string[] {
  const { nc, acoes } = dados;
  const p: string[] = [];

  if (concluidaSemVerificacao(nc)) {
    p.push(
      "Não conformidade concluída sem verificação de eficácia — o status diz resolvido e não há prova de que a ação resolveu"
    );
  }

  if (acoes.length === 0) {
    p.push(
      "Nenhuma ação definida — a NR-01 1.5.5.2 exige plano de ação com prazo e responsável"
    );
  }

  const semResponsavel = acoes.filter((a) => !a.responsavel?.nome?.trim());
  if (semResponsavel.length > 0) {
    p.push(`${semResponsavel.length} ação(ões) sem responsável designado`);
  }

  const semPrazo = acoes.filter((a) => !a.prazo);
  if (semPrazo.length > 0) {
    p.push(`${semPrazo.length} ação(ões) sem prazo — plano sem prazo não é plano`);
  }

  const atrasadas = acoesAtrasadas(acoes, hoje);
  if (atrasadas.length > 0) {
    p.push(`${atrasadas.length} ação(ões) com prazo vencido`);
  }

  if (!nc.causa?.trim()) {
    p.push(
      "Causa não registrada — sem análise de causa a ação trata o sintoma e a NC reaparece"
    );
  }

  if (!nc.responsavel?.nome?.trim()) {
    p.push("Responsável pelo tratamento não designado");
  }

  if (!nc.prazo) {
    p.push("Sem prazo de tratamento definido");
  }

  if (!dados.empresa?.nome?.trim()) {
    p.push("Identificação da organização ausente");
  }

  return p;
}

export function montarHtmlNc(dados: NcDocumentoDados, hoje = new Date()): string {
  const { nc, acoes, empresa, geradoPor } = dados;
  const emitidoEm = new Date().toLocaleString("pt-BR");
  const hojeIso = comoIso(hoje);
  const atrasadas = acoesAtrasadas(acoes, hoje);

  // Prazo mais curto primeiro; sem prazo no fim, onde chama atenção. A ordem é
  // guardada porque a foto de cada ação sai numerada conforme a linha da tabela.
  const acoesOrdenadas = [...acoes].sort((a, b) =>
    (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999")
  );

  const linhasAcoes = acoesOrdenadas
    .map((a, indice) => {
      const emAberto = a.status !== "CONCLUIDA" && a.status !== "CANCELADA";
      const atrasada = emAberto && !!a.prazo && a.prazo < hojeIso;

      return `<tr>
        <td><strong>${indice + 1}.</strong> ${esc(a.descricao)}</td>
        <td>${esc(TIPO_ACAO_LABEL[a.tipo] ?? a.tipo)}</td>
        <td>${esc(a.responsavel?.nome) || faltando("não designado")}</td>
        <td>${
          a.prazo
            ? atrasada
              ? `<span class="doc-inapto">${dataBr(a.prazo)} (vencido)</span>`
              : dataBr(a.prazo)
            : faltando("sem prazo")
        }</td>
        <td>${esc(CRITICIDADE_LABEL[a.prioridade] ?? a.prioridade)}</td>
        <td>${esc(STATUS_ACAO_LABEL[a.status] ?? a.status)}${
          a.data_conclusao ? `<br><span class="doc-neutro">${dataBr(a.data_conclusao)}</span>` : ""
        }</td>
        <td>${esc(a.evidencia) || "—"}</td>
      </tr>`;
    })
    .join("");

  const fotosDasAcoes = blocoDeFotos(
    acoesOrdenadas.flatMap((a, indice) => {
      const doGrupo = dados.fotosPorAcao?.get(a.id);
      if (!doGrupo || doGrupo.fotos.length === 0) return [];

      const rotulo = `Ação ${indice + 1}`;
      return doGrupo.fotos.map((f) => ({ ...f, rotulo }));
    }),
    { colunas: 3 }
  );

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    ${estilosFotosDocumento}
    <div class="doc">

      <div class="doc-cab">
        <h1>Relatório de Não Conformidade</h1>
        <p class="doc-sub">
          ${nc.codigo ? `Nº ${esc(nc.codigo)} · ` : ""}Plano de ação — NR-01 item 1.5.5.2
        </p>
      </div>

      ${
        concluidaSemVerificacao(nc)
          ? `<div class="doc-aviso">
              <strong>Esta não conformidade está concluída sem verificação de eficácia.</strong>
              O status afirma que o problema foi resolvido, e não há registro de que a ação
              tomada resolveu. Fechar sem verificar é o furo mais comum do ciclo.
             </div>`
          : ""
      }

      ${
        atrasadas.length > 0
          ? `<div class="doc-aviso">
              <strong>${atrasadas.length} ação(ões) com prazo vencido.</strong>
             </div>`
          : ""
      }

      <div class="doc-ident">
        <table>
          <tr>
            <td class="rot">Organização</td>
            <td><strong>${esc(empresa?.nome) || faltando("não informada")}</strong></td>
            <td class="rot">CNPJ</td>
            <td>${esc(empresa?.cnpj) || "—"}</td>
          </tr>
          <tr>
            <td class="rot">Obra</td>
            <td>${
              nc.projeto ? `[${esc(nc.projeto.codigo)}] ${esc(nc.projeto.nome)}` : "—"
            }</td>
            <td class="rot">Área</td>
            <td>${esc(nc.area?.nome) || "—"}</td>
          </tr>
        </table>
      </div>

      <div class="doc-bloco">
        <div class="tit">Identificação da não conformidade</div>
        <div class="corpo">
          <table class="doc-grid">
            <tr>
              <td class="rot">Título</td>
              <td colspan="3"><strong>${esc(nc.titulo)}</strong></td>
            </tr>
            <tr>
              <td class="rot">Origem</td>
              <td>${esc(ORIGEM_LABEL[nc.origem_tipo] ?? nc.origem_tipo)}</td>
              <td class="rot">Criticidade</td>
              <td><strong>${esc(
                CRITICIDADE_LABEL[nc.criticidade] ?? nc.criticidade
              )}</strong></td>
            </tr>
            <tr>
              <td class="rot">Identificada em</td>
              <td>${dataBr(nc.data_identificacao)}</td>
              <td class="rot">Prazo de tratamento</td>
              <td>${nc.prazo ? dataBr(nc.prazo) : faltando("não definido")}</td>
            </tr>
            <tr>
              <td class="rot">Responsável</td>
              <td>${esc(nc.responsavel?.nome) || faltando("não designado")}</td>
              <td class="rot">Status</td>
              <td><strong>${esc(STATUS_LABEL[nc.status] ?? nc.status)}</strong></td>
            </tr>
          </table>
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Descrição do desvio</div>
        <div class="corpo"><p>${esc(nc.descricao)}</p></div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Análise de causa</div>
        <div class="corpo">
          ${
            nc.causa?.trim()
              ? `<p>${esc(nc.causa)}</p>`
              : `<p class="doc-aviso">Causa não registrada. Sem análise de causa a ação
                  trata o sintoma, e a mesma não conformidade volta a aparecer.</p>`
          }
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Plano de ação</div>
        <div class="corpo">
          ${
            acoes.length === 0
              ? `<p class="doc-aviso">Nenhuma ação definida. A NR-01 1.5.5.2 exige plano de
                  ação com prazo e responsável para as medidas de prevenção.</p>`
              : `<table class="doc-tabela">
                  <thead>
                    <tr>
                      <th>Ação</th><th>Tipo</th><th>Responsável</th><th>Prazo</th>
                      <th>Prioridade</th><th>Status</th><th>Evidência</th>
                    </tr>
                  </thead>
                  <tbody>${linhasAcoes}</tbody>
                 </table>
                 ${fotosDasAcoes}`
          }
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Verificação de eficácia</div>
        <div class="corpo">
          ${
            nc.resultado_verificacao
              ? `<table class="doc-grid">
                  <tr>
                    <td class="rot">Resultado</td>
                    <td colspan="3"><strong class="${
                      nc.resultado_verificacao === "ACEITA" ? "doc-apto" : "doc-inapto"
                    }">${esc(
                      RESULTADO_LABEL[nc.resultado_verificacao] ?? nc.resultado_verificacao
                    )}</strong></td>
                  </tr>
                  <tr>
                    <td class="rot">Verificado por</td>
                    <td>${esc(nc.verificador?.nome) || faltando("não registrado")}</td>
                    <td class="rot">Data</td>
                    <td>${
                      nc.data_verificacao
                        ? dataBr(nc.data_verificacao)
                        : faltando("não registrada")
                    }</td>
                  </tr>
                  ${
                    nc.observacao_verificacao
                      ? `<tr>
                          <td class="rot">Observação</td>
                          <td colspan="3">${esc(nc.observacao_verificacao)}</td>
                         </tr>`
                      : ""
                  }
                 </table>`
              : `<p class="doc-vazio">
                  Verificação de eficácia ainda não registrada. A ação só fecha o ciclo
                  quando alguém confirma que ela resolveu a causa.
                 </p>
                 <table class="doc-grid">
                   <tr>
                     <td class="rot">Verificado por</td>
                     <td>______________________________</td>
                     <td class="rot">Data</td>
                     <td>____/____/______</td>
                   </tr>
                   <tr>
                     <td class="rot">Resultado</td>
                     <td colspan="3">
                       ( ) Ação aceita — eficácia confirmada &nbsp;&nbsp;
                       ( ) Ação rejeitada — não resolveu a causa
                     </td>
                   </tr>
                 </table>`
          }
        </div>
      </div>

      ${
        nc.observacoes
          ? `<div class="doc-bloco">
              <div class="tit">Observações</div>
              <div class="corpo"><p>${esc(nc.observacoes)}</p></div>
             </div>`
          : ""
      }

      ${blocoDeFotos(dados.fotos?.fotos ?? [], {
        titulo: "Evidência fotográfica do desvio",
        omitidas: dados.fotos?.omitidas,
        vazio:
          "Nenhuma foto anexada. O desvio e o resultado do tratamento estão " +
          "descritos apenas por escrito.",
      })}

      <div class="doc-assin">
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(nc.responsavel?.nome) || "&nbsp;"}</div>
          <hr>
          <p>Responsável pelo tratamento</p>
        </div>
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(nc.verificador?.nome) || "&nbsp;"}</div>
          <hr>
          <p>Responsável pela verificação de eficácia</p>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${geradoPor ? ` por ${esc(geradoPor)}` : ""} ·
        Não conformidade e plano de ação — NR-01 item 1.5.5.2
      </div>
    </div>
  `;
}

function nomeArquivo(nc: SgsstNaoConformidade): string {
  const base = nc.codigo || nc.titulo || "NC";
  return `NC_${base.replace(/[^\w-]+/g, "_").slice(0, 48)}.pdf`;
}

export async function gerarPdfNc(dados: NcDocumentoDados): Promise<void> {
  await emitirPdfTimbrado({
    html: montarHtmlNc(dados),
    nomeArquivo: nomeArquivo(dados.nc),
    identificacao: `NC ${dados.nc.codigo || ""} — ${dados.nc.titulo}`.slice(0, 88),
  });
}
