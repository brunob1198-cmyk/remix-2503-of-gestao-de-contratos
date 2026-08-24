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
  SgsstInspecao,
  SgsstInspecaoItem,
  SgsstInspecaoNaoConformidade,
} from "@/hooks/sgsst/useSgsstInspecoes";

/**
 * Emissão do relatório de inspeção de segurança.
 *
 * A inspeção existe para gerar ação, e a ação depende de alguém ler o achado. O
 * relatório é o que circula: vai para o encarregado da frente, para o cliente na
 * auditoria, para o arquivo que comprova a periodicidade.
 *
 * Três decisões:
 *
 * 1. **O índice de conformidade não conta o "não aplicável" como conforme.** É a
 *    conta que mais se falseia: um checklist com 40 itens, 5 conformes e 35 não
 *    aplicáveis não tem 100% de conformidade — tem 5 itens verificados. O
 *    denominador é só o que foi de fato avaliado, e o documento diz quantos ficaram
 *    fora da conta.
 *
 * 2. **Item obrigatório ainda pendente aparece como pendência, não como neutro.**
 *    Inspeção com item obrigatório em branco não está concluída, e o relatório não
 *    deve deixar isso parecer detalhe.
 *
 * 3. **A inspeção que ainda não foi executada sai marcada.** Relatório de inspeção
 *    planejada, impresso e arquivado, viraria comprovação de uma verificação que
 *    não aconteceu.
 */

export interface InspecaoDocumentoDados {
  inspecao: SgsstInspecao;
  itens: readonly SgsstInspecaoItem[];
  naoConformidades: readonly SgsstInspecaoNaoConformidade[];
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  geradoPor?: string | null;
  /** Fotos gerais da inspeção — o percurso, a área, o que foi verificado. */
  fotos?: FotosPreparadas;
  /**
   * Fotos de cada não conformidade, por id.
   *
   * Saem logo abaixo da tabela de não conformidades, com o número da NC no rótulo.
   * O campo `evidencia` da NC é texto livre: dava para escrever "foto 03" sem que
   * a foto 03 existisse. Aqui a foto está ao lado da linha que ela sustenta.
   */
  fotosPorNaoConformidade?: ReadonlyMap<string, FotosPreparadas>;
}

const RESPOSTA_LABEL: Record<string, string> = {
  CONFORME: "Conforme",
  NAO_CONFORME: "Não conforme",
  NAO_APLICAVEL: "Não aplicável",
  PENDENTE: "Pendente",
};

const CRITICIDADE_LABEL: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

const STATUS_NC_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  EM_TRATAMENTO: "Em tratamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

function faltando(rotulo: string): string {
  return `<span class="doc-falta">${esc(rotulo)}</span>`;
}

export interface ResumoConformidade {
  /** Itens com resposta Conforme. */
  conformes: number;
  naoConformes: number;
  /** Itens avaliados: conformes + não conformes. É o denominador. */
  avaliados: number;
  /** Itens fora da conta, e o motivo de estarem fora. */
  naoAplicaveis: number;
  pendentes: number;
  /** Percentual sobre os avaliados; nulo quando nada foi avaliado. */
  percentual: number | null;
}

/**
 * Índice de conformidade da inspeção.
 *
 * "Não aplicável" e "pendente" saem do denominador: o primeiro não é uma
 * verificação, o segundo não aconteceu ainda. Somá-los aos conformes inflaria o
 * índice exatamente no caso em que ele deveria alertar.
 */
export function resumoConformidadeInspecao(
  itens: readonly SgsstInspecaoItem[]
): ResumoConformidade {
  const conformes = itens.filter((i) => i.resposta === "CONFORME").length;
  const naoConformes = itens.filter((i) => i.resposta === "NAO_CONFORME").length;
  const naoAplicaveis = itens.filter((i) => i.resposta === "NAO_APLICAVEL").length;
  const pendentes = itens.filter((i) => i.resposta === "PENDENTE").length;
  const avaliados = conformes + naoConformes;

  return {
    conformes,
    naoConformes,
    avaliados,
    naoAplicaveis,
    pendentes,
    percentual: avaliados === 0 ? null : (conformes / avaliados) * 100,
  };
}

function percentualBr(valor: number | null): string {
  return valor === null ? "—" : `${valor.toFixed(1).replace(".", ",")}%`;
}

export function pendenciasInspecao(dados: InspecaoDocumentoDados): string[] {
  const { inspecao, itens, naoConformidades } = dados;
  const p: string[] = [];

  if (inspecao.status !== "CONCLUIDA") {
    p.push(
      `Inspeção com status ${inspecao.status} — o relatório não comprova verificação concluída`
    );
  }

  if (!inspecao.data_execucao) {
    p.push("Sem data de execução registrada");
  }

  if (itens.length === 0) {
    p.push("Nenhum item de verificação — não há o que a inspeção tenha inspecionado");
  }

  const obrigatoriosPendentes = itens.filter(
    (i) => i.obrigatorio && i.resposta === "PENDENTE"
  );
  if (obrigatoriosPendentes.length > 0) {
    p.push(`${obrigatoriosPendentes.length} item(ns) obrigatório(s) sem resposta`);
  }

  // Item não conforme sem NC registrada é achado que morre no papel.
  const naoConformes = itens.filter((i) => i.resposta === "NAO_CONFORME");
  const semNc = naoConformes.filter(
    (i) => !naoConformidades.some((nc) => nc.item_id === i.id)
  );
  if (semNc.length > 0) {
    p.push(
      `${semNc.length} item(ns) não conforme(s) sem não conformidade aberta — achado sem tratamento não gera ação`
    );
  }

  const semResponsavel = naoConformidades.filter((nc) => !nc.responsavel?.nome?.trim());
  if (semResponsavel.length > 0) {
    p.push(`${semResponsavel.length} não conformidade(s) sem responsável designado`);
  }

  const semPrazo = naoConformidades.filter((nc) => !nc.prazo);
  if (semPrazo.length > 0) {
    p.push(`${semPrazo.length} não conformidade(s) sem prazo de tratamento`);
  }

  if (!inspecao.responsavel?.nome?.trim()) {
    p.push("Responsável pela inspeção não designado");
  }

  if (!dados.empresa?.nome?.trim()) {
    p.push("Identificação da organização ausente");
  }

  return p;
}

export function montarHtmlInspecao(dados: InspecaoDocumentoDados): string {
  const { inspecao, itens, naoConformidades, empresa, geradoPor } = dados;
  const emitidoEm = new Date().toLocaleString("pt-BR");
  const resumo = resumoConformidadeInspecao(itens);
  const naoConcluida = inspecao.status !== "CONCLUIDA";

  const ordenados = [...itens].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const linhasItens = ordenados
    .map((i) => {
      const problema = i.resposta === "NAO_CONFORME";
      const pendente = i.resposta === "PENDENTE";

      return `<tr>
        <td class="doc-num">${esc(i.ordem)}</td>
        <td>${esc(i.descricao)}${
          i.categoria ? `<br><span class="doc-neutro">${esc(i.categoria)}</span>` : ""
        }</td>
        <td>${i.obrigatorio ? "Sim" : "Não"}</td>
        <td>${
          problema
            ? `<span class="doc-inapto">${esc(RESPOSTA_LABEL[i.resposta])}</span>`
            : pendente
              ? `<span class="doc-restr">${esc(RESPOSTA_LABEL[i.resposta])}</span>`
              : esc(RESPOSTA_LABEL[i.resposta] ?? i.resposta)
        }</td>
        <td>${esc(i.observacao) || "—"}</td>
      </tr>`;
    })
    .join("");

  // Ordenadas pelo prazo, e NUMERADAS nessa ordem. O número existe para a foto ter
  // a que se referir: "NC 2" debaixo da foto liga a imagem à linha da tabela, e sem
  // essa ligação a foto do desvio poderia ser lida como sendo de outro desvio.
  const ncOrdenadas = [...naoConformidades].sort((a, b) =>
    (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999")
  );

  const linhasNc = ncOrdenadas
    .map(
      (nc, indice) => `<tr>
        <td><strong>NC ${indice + 1}.</strong> ${esc(nc.descricao)}${
          nc.evidencia ? `<br><span class="doc-neutro">${esc(nc.evidencia)}</span>` : ""
        }</td>
        <td>${esc(CRITICIDADE_LABEL[nc.criticidade] ?? nc.criticidade)}</td>
        <td>${esc(nc.responsavel?.nome) || faltando("não designado")}</td>
        <td>${nc.prazo ? dataBr(nc.prazo) : faltando("sem prazo")}</td>
        <td>${esc(STATUS_NC_LABEL[nc.status] ?? nc.status)}</td>
      </tr>`
    )
    .join("");

  const fotosDasNc = blocoDeFotos(
    ncOrdenadas.flatMap((nc, indice) => {
      const doGrupo = dados.fotosPorNaoConformidade?.get(nc.id);
      if (!doGrupo || doGrupo.fotos.length === 0) return [];

      const rotulo = `NC ${indice + 1}`;
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
        <h1>Relatório de Inspeção de Segurança</h1>
        <p class="doc-sub">
          ${esc(inspecao.tipo)}${inspecao.codigo ? ` · Nº ${esc(inspecao.codigo)}` : ""}
        </p>
      </div>

      ${
        naoConcluida
          ? `<div class="doc-aviso">
              <strong>Status ${esc(inspecao.status)}: esta inspeção não foi concluída.</strong>
              O relatório não comprova verificação realizada — arquivá-lo como comprovação
              atestaria uma inspeção que não aconteceu.
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
              inspecao.projeto
                ? `[${esc(inspecao.projeto.codigo)}] ${esc(inspecao.projeto.nome)}`
                : "—"
            }</td>
            <td class="rot">Área</td>
            <td>${esc(inspecao.area?.nome) || "—"}</td>
          </tr>
        </table>
      </div>

      <div class="doc-bloco">
        <div class="tit">Identificação da inspeção</div>
        <div class="corpo">
          <table class="doc-grid">
            <tr>
              <td class="rot">Título</td>
              <td colspan="3"><strong>${esc(inspecao.titulo)}</strong></td>
            </tr>
            <tr>
              <td class="rot">Data planejada</td>
              <td>${dataBr(inspecao.data_planejada)}</td>
              <td class="rot">Data de execução</td>
              <td>${
                inspecao.data_execucao
                  ? dataBr(inspecao.data_execucao)
                  : faltando("não executada")
              }</td>
            </tr>
            <tr>
              <td class="rot">Responsável</td>
              <td>${esc(inspecao.responsavel?.nome) || faltando("não designado")}</td>
              <td class="rot">Status</td>
              <td><strong>${esc(inspecao.status)}</strong></td>
            </tr>
            ${
              inspecao.pgr || inspecao.apr || inspecao.pt
                ? `<tr>
                    <td class="rot">Vinculada a</td>
                    <td colspan="3">${[
                      inspecao.pgr ? `PGR: ${esc(inspecao.pgr.titulo)}` : "",
                      inspecao.apr ? `APR: ${esc(inspecao.apr.titulo)}` : "",
                      inspecao.pt ? `PT: ${esc(inspecao.pt.titulo)}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}</td>
                   </tr>`
                : ""
            }
          </table>
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Resultado da verificação</div>
        <div class="corpo">
          <div class="doc-cards">
            <div class="doc-card">
              <div class="rot">Conformidade</div>
              <div class="val">${percentualBr(resumo.percentual)}</div>
              <div class="sub">sobre ${resumo.avaliados} item(ns) avaliado(s)</div>
            </div>
            <div class="doc-card">
              <div class="rot">Conformes</div>
              <div class="val">${resumo.conformes}</div>
            </div>
            <div class="doc-card">
              <div class="rot">Não conformes</div>
              <div class="val">${resumo.naoConformes}</div>
            </div>
            <div class="doc-card">
              <div class="rot">Fora da conta</div>
              <div class="val">${resumo.naoAplicaveis + resumo.pendentes}</div>
              <div class="sub">${resumo.naoAplicaveis} n/a · ${resumo.pendentes} pendente(s)</div>
            </div>
          </div>
          <p class="doc-neutro">
            O índice considera apenas os itens efetivamente avaliados. Itens "não aplicável"
            e "pendente" ficam fora do cálculo — somá-los aos conformes inflaria o índice
            justamente quando ele deveria alertar.
          </p>
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Itens verificados</div>
        <div class="corpo">
          ${
            ordenados.length === 0
              ? `<p class="doc-aviso">Nenhum item de verificação cadastrado. Não há o que
                  esta inspeção tenha inspecionado.</p>`
              : `<table class="doc-tabela">
                  <thead>
                    <tr><th>#</th><th>Item</th><th>Obrigatório</th><th>Resposta</th><th>Observação</th></tr>
                  </thead>
                  <tbody>${linhasItens}</tbody>
                 </table>`
          }
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Não conformidades registradas</div>
        <div class="corpo">
          ${
            naoConformidades.length === 0
              ? resumo.naoConformes > 0
                ? `<p class="doc-aviso">${resumo.naoConformes} item(ns) foram marcados como
                    não conformes e nenhuma não conformidade foi aberta. Achado sem
                    tratamento não gera ação.</p>`
                : `<p class="doc-vazio">Nenhuma não conformidade registrada nesta inspeção.</p>`
              : `<table class="doc-tabela">
                  <thead>
                    <tr><th>Descrição / evidência</th><th>Criticidade</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr>
                  </thead>
                  <tbody>${linhasNc}</tbody>
                 </table>
                 ${fotosDasNc}`
          }
        </div>
      </div>

      ${
        inspecao.observacoes
          ? `<div class="doc-bloco">
              <div class="tit">Observações</div>
              <div class="corpo"><p>${esc(inspecao.observacoes)}</p></div>
             </div>`
          : ""
      }

      ${blocoDeFotos(dados.fotos?.fotos ?? [], {
        titulo: "Evidência fotográfica da inspeção",
        omitidas: dados.fotos?.omitidas,
      })}

      <div class="doc-assin">
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(inspecao.responsavel?.nome) || "&nbsp;"}</div>
          <hr>
          <p>Responsável pela inspeção</p>
        </div>
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">&nbsp;</div>
          <hr>
          <p>Ciência do responsável pela área</p>
          <p>Data: ____/____/______</p>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${geradoPor ? ` por ${esc(geradoPor)}` : ""} ·
        Relatório de inspeção de segurança
      </div>
    </div>
  `;
}

function nomeArquivo(inspecao: SgsstInspecao): string {
  const base = inspecao.codigo || inspecao.titulo || "Inspecao";
  return `Inspecao_${base.replace(/[^\w-]+/g, "_").slice(0, 48)}.pdf`;
}

export async function gerarPdfInspecao(dados: InspecaoDocumentoDados): Promise<void> {
  await emitirPdfTimbrado({
    html: montarHtmlInspecao(dados),
    nomeArquivo: nomeArquivo(dados.inspecao),
    identificacao: `Inspeção ${dados.inspecao.codigo || ""} — ${dados.inspecao.titulo}`.slice(
      0,
      88
    ),
  });
}
