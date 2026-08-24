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
  SgsstApr,
  SgsstAprEtapa,
  SgsstAprRisco,
  SgsstAprMedida,
  SgsstAprParticipante,
} from "@/hooks/sgsst/useSgsstApr";

/**
 * Emissão da Análise Preliminar de Riscos.
 *
 * A APR é o documento que a equipe lê **antes** de começar a atividade, e o que o
 * cliente pede na auditoria de obra. Existia só na tela.
 *
 * A estrutura do documento é a da própria análise: etapa → riscos da etapa →
 * medidas de controle de cada risco. Achatar isso numa lista de riscos perderia a
 * informação que faz a APR ser preliminar: em que momento da tarefa cada perigo
 * aparece.
 *
 * Duas decisões que valem registro:
 *
 * 1. **Risco sem medida de controle sai marcado.** É a falha mais comum e a mais
 *    séria numa APR: identificar o perigo e não dizer o que fazer a respeito. O
 *    documento não pode deixar isso passar como linha em branco.
 *
 * 2. **A hierarquia de controle sai impressa junto do tipo da medida.** "EPI"
 *    ao lado de "Engenharia" parece equivalente na tela; na norma não é. A NR-01
 *    1.5.4.4.3 estabelece ordem de prioridade, e uma APR cujas únicas medidas são
 *    EPI está dizendo que nada foi eliminado nem contido na fonte.
 */

export interface AprDocumentoDados {
  apr: SgsstApr;
  etapas: readonly SgsstAprEtapa[];
  /** Riscos de todas as etapas, achatados. */
  riscos: readonly SgsstAprRisco[];
  /** Medidas de todos os riscos, achatadas. */
  medidas: readonly SgsstAprMedida[];
  participantes: readonly SgsstAprParticipante[];
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  geradoPor?: string | null;
  /** Fotos da APR como um todo. */
  fotos?: FotosPreparadas;
  /**
   * Fotos por etapa, dentro do bloco da etapa.
   *
   * A APR circula ANTES do serviço, e a foto da etapa mostra a condição que o
   * texto descreve. Numa galeria ao fim, a mesma foto viraria ilustração: quem lê
   * a etapa 4 no campo não vai folhear até o fim para achar a foto dela.
   */
  fotosPorEtapa?: ReadonlyMap<string, FotosPreparadas>;
}

/** Status em que a APR não vale como análise aprovada. */
const STATUS_NAO_APROVADO = new Set(["RASCUNHO", "EM_ANALISE", "REJEITADA", "CANCELADA"]);

/**
 * Ordem da hierarquia de controle — NR-01 1.5.4.4.3.
 *
 * Menor número, mais alto na hierarquia. Serve para ordenar as medidas de um
 * risco e para saber se sobrou só EPI.
 */
const ORDEM_HIERARQUIA: Record<string, number> = {
  Eliminação: 0,
  Substituição: 1,
  Engenharia: 2,
  Administrativa: 3,
  EPI: 4,
};

const STATUS_MEDIDA_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  implementado: "Implementado",
  cancelado: "Cancelado",
};

function faltando(rotulo: string): string {
  return `<span class="doc-falta">${esc(rotulo)}</span>`;
}

function nomeDoParticipante(p: SgsstAprParticipante): string {
  return (
    p.colaborador_dados?.profile?.nome || p.colaborador_dados?.recurso?.nome || "(sem nome)"
  );
}

/** Riscos de uma etapa, na ordem em que foram levantados. */
export function riscosDaEtapa(
  dados: AprDocumentoDados,
  etapaId: string
): SgsstAprRisco[] {
  return dados.riscos.filter((r) => r.etapa_id === etapaId);
}

/** Medidas de um risco, da mais alta para a mais baixa na hierarquia. */
export function medidasDoRisco(
  dados: AprDocumentoDados,
  riscoId: string
): SgsstAprMedida[] {
  return dados.medidas
    .filter((m) => m.apr_risco_id === riscoId)
    .sort(
      (a, b) => (ORDEM_HIERARQUIA[a.tipo] ?? 9) - (ORDEM_HIERARQUIA[b.tipo] ?? 9)
    );
}

/**
 * Verdadeiro quando o risco só tem EPI como controle.
 *
 * Não é erro por si — há risco em que o EPI é o controle possível. É informação:
 * a NR-01 põe o EPI no fim da hierarquia, e quem assina a APR precisa ver que
 * nada mais foi tentado antes.
 */
export function somenteEpi(medidas: readonly SgsstAprMedida[]): boolean {
  return medidas.length > 0 && medidas.every((m) => m.tipo === "EPI");
}

export function pendenciasApr(dados: AprDocumentoDados): string[] {
  const { apr, etapas, riscos, participantes } = dados;
  const p: string[] = [];

  if (STATUS_NAO_APROVADO.has(apr.status)) {
    p.push(`APR com status ${apr.status} — não vale como análise aprovada`);
  }

  if (etapas.length === 0) {
    p.push("Nenhuma etapa descrita — a APR não decompõe a atividade");
  }

  const etapasSemRisco = etapas.filter((e) => riscosDaEtapa(dados, e.id).length === 0);
  if (etapasSemRisco.length > 0) {
    p.push(`${etapasSemRisco.length} etapa(s) sem risco levantado`);
  }

  const semMedida = riscos.filter((r) => medidasDoRisco(dados, r.id).length === 0);
  if (semMedida.length > 0) {
    p.push(
      `${semMedida.length} risco(s) sem medida de controle — identificar o perigo sem dizer o que fazer não protege ninguém`
    );
  }

  if (participantes.length === 0) {
    p.push("Nenhum participante registrado — ninguém assinou ciência da análise");
  }

  if (!apr.responsavel?.nome?.trim()) {
    p.push("Responsável técnico pela análise não designado");
  }

  if (!apr.validade) {
    p.push("Sem validade definida — análise sem prazo passa a valer indefinidamente");
  }

  if (!dados.empresa?.nome?.trim()) {
    p.push("Identificação da organização ausente");
  }

  return p;
}

function blocoDaEtapa(dados: AprDocumentoDados, etapa: SgsstAprEtapa): string {
  const riscos = riscosDaEtapa(dados, etapa.id);

  const linhas = riscos
    .map((r) => {
      const medidas = medidasDoRisco(dados, r.id);
      const soEpi = somenteEpi(medidas);

      const textoMedidas =
        medidas.length === 0
          ? `<span class="doc-inapto">Nenhuma medida de controle definida</span>`
          : medidas
              .map(
                (m) => `<div>
                  <strong>${esc(m.tipo)}</strong>: ${esc(m.descricao)}
                  <span class="doc-neutro">
                    (${esc(STATUS_MEDIDA_LABEL[m.status] ?? m.status)}${
                      m.responsavel?.nome ? ` · ${esc(m.responsavel.nome)}` : ""
                    }${m.prazo ? ` · prazo ${dataBr(m.prazo)}` : ""})
                  </span>
                 </div>`
              )
              .join("") +
            (soEpi
              ? `<div class="doc-neutro">Somente EPI: a NR-01 1.5.4.4.3 põe o EPI no
                  fim da hierarquia de controle.</div>`
              : "");

      return `<tr>
        <td>${esc(r.perigo)}</td>
        <td>${esc(r.risco)}${
          r.consequencia ? `<br><span class="doc-neutro">${esc(r.consequencia)}</span>` : ""
        }</td>
        <td class="doc-num">${esc(r.probabilidade)} × ${esc(r.severidade)} = ${esc(
          r.nivel_risco ?? r.probabilidade * r.severidade
        )}</td>
        <td>${esc(r.classificacao) || "—"}</td>
        <td>${textoMedidas}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="doc-bloco">
      <div class="tit">Etapa ${esc(etapa.ordem)} — ${esc(etapa.descricao)}</div>
      <div class="corpo">
        ${
          etapa.responsavel?.nome
            ? `<p class="doc-neutro">Responsável pela etapa: ${esc(
                etapa.responsavel.nome
              )}</p>`
            : ""
        }
        ${
          riscos.length === 0
            ? `<p class="doc-aviso">Nenhum risco levantado nesta etapa.
                Etapa sem risco identificado não foi analisada — foi apenas listada.</p>`
            : `<table class="doc-tabela">
                <thead>
                  <tr>
                    <th>Perigo</th><th>Risco / consequência</th><th>P × S</th>
                    <th>Classificação</th><th>Medidas de controle</th>
                  </tr>
                </thead>
                <tbody>${linhas}</tbody>
               </table>`
        }
        ${
          etapa.observacoes
            ? `<p>${esc(etapa.observacoes)}</p>`
            : ""
        }
        ${blocoDeFotos(dados.fotosPorEtapa?.get(etapa.id)?.fotos ?? [], {
          colunas: 3,
          omitidas: dados.fotosPorEtapa?.get(etapa.id)?.omitidas,
        })}
      </div>
    </div>
  `;
}

export function montarHtmlApr(dados: AprDocumentoDados): string {
  const { apr, etapas, riscos, participantes, empresa, geradoPor } = dados;
  const emitidoEm = new Date().toLocaleString("pt-BR");
  const naoAprovado = STATUS_NAO_APROVADO.has(apr.status);

  const semMedida = riscos.filter((r) => medidasDoRisco(dados, r.id).length === 0).length;

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    ${estilosFotosDocumento}
    <div class="doc">

      <div class="doc-cab">
        <h1>Análise Preliminar de Riscos</h1>
        <p class="doc-sub">
          ${apr.codigo ? `Nº ${esc(apr.codigo)} · ` : ""}NR-01 item 1.5.4
        </p>
      </div>

      ${
        naoAprovado
          ? `<div class="doc-aviso">
              <strong>Status ${esc(apr.status)}: esta análise não está aprovada.</strong>
              Documento emitido para conferência interna — não serve como análise de risco
              validada da atividade.
             </div>`
          : ""
      }

      ${
        semMedida > 0
          ? `<div class="doc-aviso">
              <strong>${semMedida} risco(s) sem medida de controle.</strong> Identificar o
              perigo e não definir o que fazer a respeito deixa a análise incompleta.
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
              apr.projeto ? `[${esc(apr.projeto.codigo)}] ${esc(apr.projeto.nome)}` : "—"
            }</td>
            <td class="rot">Área</td>
            <td>${esc(apr.area?.nome) || "—"}</td>
          </tr>
        </table>
      </div>

      <div class="doc-bloco">
        <div class="tit">Atividade analisada</div>
        <div class="corpo">
          <table class="doc-grid">
            <tr>
              <td class="rot">Título</td>
              <td colspan="3"><strong>${esc(apr.titulo)}</strong></td>
            </tr>
            <tr>
              <td class="rot">Atividade</td>
              <td colspan="3">${esc(apr.atividade)}</td>
            </tr>
            ${
              apr.descricao
                ? `<tr>
                    <td class="rot">Descrição</td>
                    <td colspan="3">${esc(apr.descricao)}</td>
                   </tr>`
                : ""
            }
            <tr>
              <td class="rot">Data da análise</td>
              <td>${dataBr(apr.data)}</td>
              <td class="rot">Validade</td>
              <td>${
                apr.validade ? dataBr(apr.validade) : faltando("não definida")
              }</td>
            </tr>
            <tr>
              <td class="rot">Responsável técnico</td>
              <td>${esc(apr.responsavel?.nome) || faltando("não designado")}</td>
              <td class="rot">Status</td>
              <td><strong>${esc(apr.status)}</strong></td>
            </tr>
          </table>
        </div>
      </div>

      ${
        etapas.length === 0
          ? `<div class="doc-bloco">
              <div class="tit">Etapas da atividade</div>
              <div class="corpo">
                <p class="doc-aviso">Nenhuma etapa descrita. A APR analisa a atividade
                  decomposta em etapas — sem essa decomposição não há análise preliminar,
                  apenas um título.</p>
              </div>
             </div>`
          : etapas.map((e) => blocoDaEtapa(dados, e)).join("")
      }

      <div class="doc-bloco">
        <div class="tit">Equipe — ciência da análise</div>
        <div class="corpo">
          ${
            participantes.length === 0
              ? `<p class="doc-aviso">Nenhum participante registrado. Sem equipe nomeada não
                  há como comprovar que alguém tomou conhecimento dos riscos analisados.</p>`
              : `<table class="doc-tabela">
                  <thead>
                    <tr><th>Nome</th><th>Participação</th><th>Função</th><th>Assinatura</th></tr>
                  </thead>
                  <tbody>
                    ${participantes
                      .map(
                        (p) => `<tr>
                          <td>${esc(nomeDoParticipante(p))}</td>
                          <td>${esc(p.participacao) || "—"}</td>
                          <td>${esc(p.funcao?.nome) || "—"}</td>
                          <td class="doc-assin-linha"></td>
                        </tr>`
                      )
                      .join("")}
                  </tbody>
                 </table>
                 <p class="doc-neutro">
                   Cada assinatura declara ciência dos riscos e das medidas de controle
                   desta análise.
                 </p>`
          }
        </div>
      </div>

      ${
        apr.observacoes
          ? `<div class="doc-bloco">
              <div class="tit">Observações</div>
              <div class="corpo"><p>${esc(apr.observacoes)}</p></div>
             </div>`
          : ""
      }

      ${blocoDeFotos(dados.fotos?.fotos ?? [], {
        titulo: "Evidência fotográfica do local da atividade",
        omitidas: dados.fotos?.omitidas,
      })}

      <div class="doc-assin">
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(apr.responsavel?.nome) || "&nbsp;"}</div>
          <hr>
          <p>Responsável técnico pela análise</p>
        </div>
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">&nbsp;</div>
          <hr>
          <p>Aprovação da segurança do trabalho</p>
          <p>Data: ____/____/______</p>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${geradoPor ? ` por ${esc(geradoPor)}` : ""} ·
        Análise Preliminar de Riscos — NR-01 item 1.5.4
      </div>
    </div>
  `;
}

function nomeArquivo(apr: SgsstApr): string {
  const base = apr.codigo || apr.titulo || "APR";
  return `APR_${base.replace(/[^\w-]+/g, "_").slice(0, 48)}.pdf`;
}

export async function gerarPdfApr(dados: AprDocumentoDados): Promise<void> {
  await emitirPdfTimbrado({
    html: montarHtmlApr(dados),
    nomeArquivo: nomeArquivo(dados.apr),
    identificacao: `APR ${dados.apr.codigo || ""} — ${dados.apr.atividade}`.slice(0, 88),
  });
}
