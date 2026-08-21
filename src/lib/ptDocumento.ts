import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import {
  estilosDocumentoSgsst,
  escDoc as esc,
  dataBrDoc as dataBr,
} from "@/lib/sgsstDocumentoEstilos";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";
import {
  avaliarLiberacaoEntrada,
  avaliarMedicao,
  MOMENTO_LABEL,
  OXIGENIO_MINIMO_ENTRADA,
  OXIGENIO_MAXIMO,
  INFLAMAVEIS_MAXIMO_LIE,
  PAPEL_VIGIA,
} from "@/utils/sgsstAtmosfera";
import type {
  SgsstPt,
  SgsstPtChecklistItem,
  SgsstPtParticipante,
  SgsstPtRisco,
  SgsstPtMedicaoAtmosfera,
} from "@/hooks/sgsst/useSgsstPt";

/**
 * Emissão da Permissão de Trabalho.
 *
 * De todos os documentos do SGSST, este é o que menos podia existir só na tela.
 * A PT é o papel que fica **no local da atividade** enquanto ela acontece: é onde
 * o vigia confere a medição, onde cada executante assina que foi informado dos
 * riscos, e é o que o fiscal pede na entrada do espaço confinado. Uma PT que só
 * existe no banco não cumpre a função dela.
 *
 * Duas decisões que atravessam o documento:
 *
 * 1. **A liberação sai impressa, e o impedimento também.** O sistema já sabe
 *    avaliar se a entrada está liberada (medição atmosférica dentro da faixa,
 *    vigia designado, equipamento calibrado). Imprimir só os dados e deixar a
 *    conclusão para quem lê seria jogar de volta ao papel o trabalho que o
 *    sistema faz. Se não está liberada, o documento diz isso no alto, em
 *    destaque, com os motivos.
 *
 * 2. **PT em rascunho sai marcada como não válida.** Uma PT impressa e afixada no
 *    local, sem aprovação, autoriza na prática um trabalho que ninguém autorizou.
 *    É o único documento deste sistema em que o erro custa vida.
 */

/** Status em que a PT não autoriza trabalho nenhum. */
const STATUS_NAO_AUTORIZA = new Set([
  "RASCUNHO",
  "EM_ANALISE",
  "REJEITADA",
  "SUSPENSA",
  "CANCELADA",
]);

/** A avaliação atmosférica só se aplica a esta modalidade. */
const TIPO_ESPACO_CONFINADO = "Espaço Confinado";

export interface PtDocumentoDados {
  pt: SgsstPt;
  riscos: readonly SgsstPtRisco[];
  checklist: readonly SgsstPtChecklistItem[];
  participantes: readonly SgsstPtParticipante[];
  medicoes: readonly SgsstPtMedicaoAtmosfera[];
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  geradoPor?: string | null;
}

function faltando(rotulo: string): string {
  return `<span class="doc-falta">${esc(rotulo)}</span>`;
}

/** Data e hora, para o que precisa de hora: a PT vale por turno, não por dia. */
function dataHoraBr(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function nomeDoParticipante(p: SgsstPtParticipante): string {
  return (
    p.colaborador_dados?.profile?.nome ||
    p.colaborador_dados?.recurso?.nome ||
    "(sem nome)"
  );
}

/** Verdadeiro quando a PT é de espaço confinado, ou já tem medição registrada. */
export function exigeAvaliacaoAtmosferica(dados: PtDocumentoDados): boolean {
  return dados.pt.tipo === TIPO_ESPACO_CONFINADO || dados.medicoes.length > 0;
}

/**
 * Pendências da PT, na ordem em que impedem o trabalho.
 *
 * A primeira checagem é o status: PT não aprovada não autoriza nada, e isso
 * precede qualquer discussão sobre medição ou vigia.
 */
export function pendenciasPt(dados: PtDocumentoDados, hoje = new Date()): string[] {
  const { pt, riscos, participantes, checklist, medicoes } = dados;
  const p: string[] = [];

  if (STATUS_NAO_AUTORIZA.has(pt.status)) {
    p.push(`PT com status ${pt.status} — não autoriza a execução do trabalho`);
  }

  if (!pt.validade_fim) {
    p.push("Sem fim de validade — a permissão vale para o turno autorizado, não indefinidamente");
  }

  if (participantes.length === 0) {
    p.push("Nenhum participante registrado — ninguém assinou ciência dos riscos");
  }

  if (riscos.length === 0) {
    p.push("Nenhum risco levantado na PT");
  }

  const obrigatoriosPendentes = checklist.filter(
    (i) => i.obrigatorio && i.resposta === "Pendente"
  );
  if (obrigatoriosPendentes.length > 0) {
    p.push(
      `${obrigatoriosPendentes.length} item(ns) obrigatório(s) do checklist ainda pendente(s)`
    );
  }

  const naoConformes = checklist.filter((i) => i.resposta === "Não Conforme");
  if (naoConformes.length > 0) {
    p.push(`${naoConformes.length} item(ns) do checklist em não conformidade`);
  }

  if (exigeAvaliacaoAtmosferica(dados)) {
    // A regra completa da NR-33 já existe avaliada; aqui ela só é reaproveitada.
    const liberacao = avaliarLiberacaoEntrada({
      medicoes,
      responsabilidades: participantes.map((x) => x.responsabilidade),
      hoje,
    });
    p.push(...liberacao.impedimentos);

    if (!dados.pt.plano_resgate?.trim()) {
      p.push("Plano de resgate não descrito — a NR-33 o exige antes da entrada, não depois");
    }
    if (!dados.pt.ventilacao_adotada?.trim()) {
      p.push("Ventilação adotada não descrita");
    }
  }

  return p;
}

/** Bloco de assinatura de uma pessoa, em linha de tabela. */
function linhaAssinatura(nome: string, papel: string, extra?: string): string {
  return `<tr>
    <td>${esc(nome)}</td>
    <td>${esc(papel)}</td>
    <td>${extra ? esc(extra) : ""}</td>
    <td class="doc-assin-linha"></td>
  </tr>`;
}

function secaoAtmosfera(dados: PtDocumentoDados, hoje: Date): string {
  const { medicoes, participantes } = dados;

  const liberacao = avaliarLiberacaoEntrada({
    medicoes,
    responsabilidades: participantes.map((p) => p.responsabilidade),
    hoje,
  });

  const linhas = [...medicoes]
    // Mais recente primeiro: é a que vale.
    .sort((a, b) => (b.medido_em ?? "").localeCompare(a.medido_em ?? ""))
    .map((m) => {
      const avaliacao = avaliarMedicao(m, hoje);
      const vigente = m.id === liberacao.medicaoVigente?.id;

      return `<tr>
        <td>${dataHoraBr(m.medido_em)}${vigente ? " <strong>(vigente)</strong>" : ""}</td>
        <td>${esc(MOMENTO_LABEL[m.momento] ?? m.momento)}</td>
        <td>${
          m.oxigenio_percentual !== null && m.oxigenio_percentual !== undefined
            ? `${esc(m.oxigenio_percentual)}%`
            : faltando("não medido")
        }</td>
        <td>${
          m.inflamaveis_percentual_lie !== null && m.inflamaveis_percentual_lie !== undefined
            ? `${esc(m.inflamaveis_percentual_lie)}% LIE`
            : faltando("não medido")
        }</td>
        <td>${
          m.contaminante_nome
            ? `${esc(m.contaminante_nome)}: ${esc(m.contaminante_valor)} ${esc(
                m.contaminante_unidade
              )}`
            : "—"
        }</td>
        <td>${esc(m.equipamento) || "—"}${
          m.calibracao_validade ? ` · calib. até ${dataBr(m.calibracao_validade)}` : ""
        }</td>
        <td>${
          avaliacao.liberado
            ? `<span class="doc-apto">Aprovada</span>`
            : `<span class="doc-inapto">Reprovada</span>`
        }</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="doc-bloco">
      <div class="tit">Avaliação atmosférica — NR-33</div>
      <div class="corpo">
        ${
          medicoes.length === 0
            ? `<p class="doc-aviso"><strong>Nenhuma medição registrada.</strong> A NR-33
                proíbe a entrada sem avaliação atmosférica prévia. Este documento não
                autoriza entrada.</p>`
            : `<table class="doc-tabela">
                <thead>
                  <tr>
                    <th>Medido em</th><th>Momento</th><th>O₂</th><th>Inflamáveis</th>
                    <th>Contaminante</th><th>Equipamento</th><th>Situação</th>
                  </tr>
                </thead>
                <tbody>${linhas}</tbody>
               </table>
               <p class="doc-neutro">
                 Critérios: oxigênio entre ${OXIGENIO_MINIMO_ENTRADA}% e ${OXIGENIO_MAXIMO}%
                 (NR-33 33.5.15.2); inflamáveis abaixo de ${INFLAMAVEIS_MAXIMO_LIE}% do LIE
                 (Anexo II); contaminantes conforme o limite informado na medição.
               </p>`
        }

        <table class="doc-grid">
          <tr>
            <td class="rot">Ventilação adotada</td>
            <td colspan="3">${
              esc(dados.pt.ventilacao_adotada) || faltando("não descrita")
            }</td>
          </tr>
          <tr>
            <td class="rot">Bloqueio de energias</td>
            <td>${
              dados.pt.bloqueio_energias === true
                ? "Executado"
                : dados.pt.bloqueio_energias === false
                  ? faltando("não executado")
                  : faltando("não informado")
            }</td>
            <td class="rot">Vigia designado</td>
            <td>${
              dados.participantes.some(
                (x) => (x.responsabilidade ?? "").trim().toLowerCase() === PAPEL_VIGIA.toLowerCase()
              )
                ? "Sim"
                : faltando("nenhum")
            }</td>
          </tr>
          <tr>
            <td class="rot">Plano de resgate</td>
            <td colspan="3">${esc(dados.pt.plano_resgate) || faltando("não descrito")}</td>
          </tr>
        </table>

        ${
          liberacao.liberado
            ? `<p class="doc-conclusao doc-apto">
                Entrada LIBERADA pelos critérios registrados nesta permissão.
               </p>`
            : `<div class="doc-aviso">
                <strong>Entrada NÃO liberada.</strong> Impedimentos registrados:
                <ul>${liberacao.impedimentos.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
               </div>`
        }
      </div>
    </div>
  `;
}

export function montarHtmlPt(dados: PtDocumentoDados, hoje = new Date()): string {
  const { pt, riscos, checklist, participantes, empresa, geradoPor } = dados;
  const emitidoEm = new Date().toLocaleString("pt-BR");
  const naoAutoriza = STATUS_NAO_AUTORIZA.has(pt.status);

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    <div class="doc">

      <div class="doc-cab">
        <h1>Permissão de Trabalho</h1>
        <p class="doc-sub">
          ${esc(pt.tipo)}${pt.codigo ? ` · Nº ${esc(pt.codigo)}` : " · sem numeração"}
        </p>
      </div>

      ${
        naoAutoriza
          ? `<div class="doc-aviso">
              <strong>Status ${esc(pt.status)}: esta permissão NÃO autoriza a execução do trabalho.</strong>
              Documento emitido para conferência interna. Afixar esta folha no local da
              atividade autorizaria na prática um trabalho que ninguém aprovou.
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
              pt.projeto ? `[${esc(pt.projeto.codigo)}] ${esc(pt.projeto.nome)}` : "—"
            }</td>
            <td class="rot">Status</td>
            <td><strong>${esc(pt.status)}</strong></td>
          </tr>
        </table>
      </div>

      <div class="doc-bloco">
        <div class="tit">Atividade autorizada</div>
        <div class="corpo">
          <table class="doc-grid">
            <tr>
              <td class="rot">Título</td>
              <td colspan="3"><strong>${esc(pt.titulo)}</strong></td>
            </tr>
            <tr>
              <td class="rot">Atividade</td>
              <td colspan="3">${esc(pt.atividade)}</td>
            </tr>
            <tr>
              <td class="rot">Local de execução</td>
              <td>${esc(pt.local_execucao) || faltando("não informado")}</td>
              <td class="rot">Área</td>
              <td>${esc(pt.area?.nome) || "—"}</td>
            </tr>
            <tr>
              <td class="rot">Início autorizado</td>
              <td>${dataHoraBr(pt.data_inicio)}</td>
              <td class="rot">Fim da validade</td>
              <td>${
                pt.validade_fim
                  ? dataHoraBr(pt.validade_fim)
                  : faltando("não definido — a PT vale para o turno autorizado")
              }</td>
            </tr>
            <tr>
              <td class="rot">Responsável</td>
              <td>${esc(pt.responsavel?.nome) || faltando("não designado")}</td>
              <td class="rot">APR vinculada</td>
              <td>${
                pt.apr
                  ? `${esc(pt.apr.codigo) || "APR"} — ${esc(pt.apr.titulo)}`
                  : faltando("nenhuma")
              }</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Riscos e classificação</div>
        <div class="corpo">
          ${
            riscos.length === 0
              ? `<p class="doc-aviso">Nenhum risco levantado nesta PT. Permissão sem risco
                  identificado não descreve o trabalho que está autorizando.</p>`
              : `<table class="doc-tabela">
                  <thead>
                    <tr><th>Perigo</th><th>Risco</th><th>Consequência</th><th>Classificação</th></tr>
                  </thead>
                  <tbody>
                    ${riscos
                      .map(
                        (r) => `<tr>
                          <td>${esc(r.perigo)}</td>
                          <td>${esc(r.risco)}</td>
                          <td>${esc(r.consequencia) || "—"}</td>
                          <td>${esc(r.classificacao) || "—"}</td>
                        </tr>`
                      )
                      .join("")}
                  </tbody>
                 </table>`
          }
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Checklist de verificação</div>
        <div class="corpo">
          ${
            checklist.length === 0
              ? `<p class="doc-vazio">Nenhum item de verificação cadastrado.</p>`
              : `<table class="doc-tabela">
                  <thead>
                    <tr><th>Item</th><th>Obrigatório</th><th>Resposta</th><th>Observação</th></tr>
                  </thead>
                  <tbody>
                    ${checklist
                      .map(
                        (i) => `<tr>
                          <td>${esc(i.item)}</td>
                          <td>${i.obrigatorio ? "Sim" : "Não"}</td>
                          <td>${
                            i.resposta === "Não Conforme" || i.resposta === "Pendente"
                              ? `<span class="doc-inapto">${esc(i.resposta)}</span>`
                              : esc(i.resposta)
                          }</td>
                          <td>${esc(i.observacao) || "—"}</td>
                        </tr>`
                      )
                      .join("")}
                  </tbody>
                 </table>`
          }
        </div>
      </div>

      ${exigeAvaliacaoAtmosferica(dados) ? secaoAtmosfera(dados, hoje) : ""}

      <div class="doc-bloco">
        <div class="tit">Equipe autorizada — ciência dos riscos</div>
        <div class="corpo">
          ${
            participantes.length === 0
              ? `<p class="doc-aviso">Nenhum participante registrado. Sem equipe nomeada não
                  há como comprovar que alguém foi informado dos riscos.</p>`
              : `<table class="doc-tabela">
                  <thead>
                    <tr><th>Nome</th><th>Responsabilidade</th><th>Função</th><th>Assinatura</th></tr>
                  </thead>
                  <tbody>
                    ${participantes
                      .map((p) =>
                        linhaAssinatura(
                          nomeDoParticipante(p),
                          p.responsabilidade || "—",
                          p.funcao?.nome ?? undefined
                        )
                      )
                      .join("")}
                  </tbody>
                 </table>
                 <p class="doc-neutro">
                   Cada assinatura declara ciência dos riscos e das medidas de controle
                   descritas nesta permissão.
                 </p>`
          }
        </div>
      </div>

      ${
        pt.observacoes
          ? `<div class="doc-bloco">
              <div class="tit">Observações</div>
              <div class="corpo"><p>${esc(pt.observacoes)}</p></div>
             </div>`
          : ""
      }

      <div class="doc-assin">
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(pt.responsavel?.nome) || "&nbsp;"}</div>
          <hr>
          <p>Responsável pela emissão da PT</p>
        </div>
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">&nbsp;</div>
          <hr>
          <p>Responsável pelo encerramento</p>
          <p>Data e hora: ____/____/______  ____:____</p>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${geradoPor ? ` por ${esc(geradoPor)}` : ""} ·
        Esta folha deve permanecer no local da atividade durante toda a execução
      </div>
    </div>
  `;
}

function nomeArquivo(pt: SgsstPt): string {
  const base = pt.codigo || pt.titulo || "PT";
  return `PT_${base.replace(/[^\w-]+/g, "_").slice(0, 48)}.pdf`;
}

export async function gerarPdfPt(dados: PtDocumentoDados): Promise<void> {
  await emitirPdfTimbrado({
    html: montarHtmlPt(dados),
    nomeArquivo: nomeArquivo(dados.pt),
    identificacao: `PT ${dados.pt.codigo || ""} — ${dados.pt.atividade}`.slice(0, 88),
  });
}
