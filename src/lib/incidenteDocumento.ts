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
  SgsstIncidente,
  SgsstIncidenteAcao,
  SgsstIncidenteEnvolvido,
  SgsstIncidenteInvestigacao,
} from "@/hooks/sgsst/useSgsstIncidentes";
import type { SgsstCat } from "@/hooks/sgsst/useSgsstCats";

/**
 * Emissão do relatório de investigação de acidente.
 *
 * POR QUE ISTO EXISTIA EM TODOS OS MÓDULOS MENOS NESTE
 *
 * APR, ASO, CAT, checklist, dossiê, ficha de EPI, guia de exame, inspeção, NC,
 * PCMSO, PGR, PT, relatório analítico e relatório gerencial todos tinham gerador.
 * Incidente era o único sem — e é o documento que a fiscalização pede primeiro.
 *
 * A tela guardava tudo o que o documento precisa (envolvidos com papel no evento,
 * a cadeia de causas, plano de ação, dias perdidos e debitados, fotos com selo) e
 * nada disso saía do sistema.
 *
 * QUATRO DECISÕES
 *
 * 1. **A cadeia de causas sai como cadeia, não como três parágrafos soltos.**
 *    Investigação de acidente vale pelo encadeamento imediata → básica → raiz: é
 *    ele que mostra se a análise chegou ao fator gerencial ou parou no
 *    "trabalhador foi imprudente". Numerar e nomear os elos torna visível onde a
 *    análise parou.
 *
 * 2. **Contradição do registro sai impressa no topo.** Tipo classificado como
 *    quase acidente com dias perdidos, afastamento sem CAT, encerramento sem
 *    investigação. O documento que esconde a contradição é pior que a ausência do
 *    documento, porque dá aparência de conformidade ao que não está conforme.
 *
 * 3. **Dias debitados aparecem ao lado dos perdidos, com o total.** A NBR 14280
 *    debita 6.000 dias por óbito ou invalidez total. Mostrar só os perdidos faz um
 *    óbito pesar menos que um afastamento de trinta dias.
 *
 * 4. **Seção de investigação sai mesmo vazia, quando é acidente.** A NR-01 1.5.5.5
 *    exige a análise. Seção em branco cobra; ausência da seção esconde.
 */

export interface IncidenteDocumentoDados {
  incidente: SgsstIncidente;
  envolvidos: readonly SgsstIncidenteEnvolvido[];
  investigacao: SgsstIncidenteInvestigacao | null;
  acoes: readonly SgsstIncidenteAcao[];
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  geradoPor?: string | null;
  /** CATs vinculadas a este incidente. */
  cats?: readonly SgsstCat[];
  /**
   * Fotos do local da ocorrência.
   *
   * Não há campo equivalente por ação do plano, ao contrário do relatório de NC:
   * `EntidadeEvidencia` não tem `INCIDENTE_ACAO` — só a NC permite anexar foto na
   * ação. Deixar o campo aqui esperando dado que o app não produz seria capacidade
   * declarada e nunca ligada, que é justamente o defeito que este módulo já tinha.
   */
  fotos?: FotosPreparadas;
}

const GRAVIDADE_LABEL: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

const STATUS_LABEL: Record<string, string> = {
  REGISTRADO: "Registrado",
  EM_INVESTIGACAO: "Em investigação",
  PLANO_ACAO: "Plano de ação definido",
  EM_TRATAMENTO: "Em tratamento",
  ENCERRADO: "Encerrado",
  CANCELADO: "Cancelado",
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

/**
 * Tipos que caracterizam acidente, e portanto exigem investigação pela NR-01
 * 1.5.5.5.
 *
 * "Quase Acidente" fica fora da lista, mas ver `houveLesao`: dias perdidos
 * mandam mais que o rótulo escolhido no cadastro.
 */
const TIPOS_DE_ACIDENTE = new Set([
  "Acidente",
  "Acidente com Afastamento",
  "Acidente sem Afastamento",
]);

function faltando(rotulo: string): string {
  return `<span class="doc-falta">${esc(rotulo)}</span>`;
}

/** Data local em "YYYY-MM-DD". `toISOString()` desloca o fuso e erra o dia. */
function comoIso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function inteiro(valor?: number | null): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

/**
 * Houve lesão com afastamento?
 *
 * Decidido por dias perdidos, não pelo campo `tipo`. Encontrado num registro
 * real: tipo "Quase Acidente" com 7 dias perdidos — e quase acidente, por
 * definição, não tem lesão. Julgar pelo rótulo deixaria o caso passar batido.
 */
export function houveLesao(incidente: SgsstIncidente): boolean {
  return inteiro(incidente.dias_perdidos) > 0 || inteiro(incidente.dias_debitados) > 0;
}

/** Exige investigação: é acidente pelo tipo, ou houve lesão de fato. */
export function exigeInvestigacao(incidente: SgsstIncidente): boolean {
  return TIPOS_DE_ACIDENTE.has(incidente.tipo) || houveLesao(incidente);
}

/**
 * O tipo declarado contradiz os dias lançados?
 *
 * Não é rigor de nomenclatura: o tipo alimenta a contagem de acidentes e os dias
 * alimentam a taxa de gravidade. Um registro com os dois em desacordo distorce os
 * dois indicadores em direções diferentes.
 */
export function tipoContradizOsDias(incidente: SgsstIncidente): boolean {
  return incidente.tipo === "Quase Acidente" && houveLesao(incidente);
}

/** Ações do plano que não foram concluídas nem canceladas. */
export function acoesEmAbertoDoIncidente(
  acoes: readonly SgsstIncidenteAcao[]
): SgsstIncidenteAcao[] {
  return acoes.filter((a) => a.status !== "CONCLUIDA" && a.status !== "CANCELADA");
}

/** Total de dias pela NBR 14280: perdidos mais debitados. */
export function diasTotais(incidente: SgsstIncidente): number {
  return inteiro(incidente.dias_perdidos) + inteiro(incidente.dias_debitados);
}

/**
 * O que o documento cobra antes de ser assinado.
 *
 * Ordem do mais grave para o menos: quem lê a primeira linha já sabe se pode
 * mandar o relatório adiante.
 */
export function pendenciasIncidente(
  dados: IncidenteDocumentoDados,
  hoje = new Date()
): string[] {
  const { incidente, investigacao, acoes, envolvidos } = dados;
  const p: string[] = [];

  if (tipoContradizOsDias(incidente)) {
    p.push(
      `Classificado como "Quase Acidente" com ${diasTotais(incidente)} dia(s) lançado(s) — ` +
        "quase acidente não tem lesão; a classificação ou os dias estão errados"
    );
  }

  if (exigeInvestigacao(incidente) && !investigacao?.descricao_investigacao?.trim()) {
    p.push(
      "Acidente sem investigação registrada — a NR-01 1.5.5.5 exige a análise do acidente"
    );
  }

  if (investigacao && !investigacao.causas_raiz?.trim()) {
    p.push(
      "Causa raiz não identificada — sem ela a ação trata o sintoma e o acidente repete"
    );
  }

  if (houveLesao(incidente) && incidente.cat_emitida !== true && (dados.cats?.length ?? 0) === 0) {
    p.push(
      "Acidente com afastamento sem CAT — o prazo legal é o primeiro dia útil seguinte, " +
        "e imediato em caso de óbito"
    );
  }

  if (incidente.cat_emitida === true && (dados.cats?.length ?? 0) === 0) {
    p.push(
      'Marcado como "CAT emitida" sem CAT registrada no sistema — a marcação é ' +
        "declaração, não documento"
    );
  }

  if (envolvidos.length === 0) {
    p.push("Nenhuma pessoa vinculada ao evento — sem vítima nem testemunha identificadas");
  }

  if (houveLesao(incidente) && !envolvidos.some((e) => e.tipo_envolvimento === "Vítima")) {
    p.push("Houve afastamento e nenhum envolvido está registrado como vítima");
  }

  if (acoes.length === 0) {
    p.push("Nenhuma ação corretiva ou preventiva definida");
  }

  const emAberto = acoesEmAbertoDoIncidente(acoes);
  const hojeIso = comoIso(hoje);
  const atrasadas = emAberto.filter((a) => !!a.prazo && a.prazo < hojeIso);
  if (atrasadas.length > 0) {
    p.push(`${atrasadas.length} ação(ões) com prazo vencido`);
  }

  const semResponsavel = acoes.filter((a) => !a.responsavel?.nome?.trim());
  if (semResponsavel.length > 0) {
    p.push(`${semResponsavel.length} ação(ões) sem responsável designado`);
  }

  const semPrazo = acoes.filter((a) => !a.prazo);
  if (semPrazo.length > 0) {
    p.push(`${semPrazo.length} ação(ões) sem prazo — plano sem prazo não é plano`);
  }

  if (incidente.status === "ENCERRADO" && emAberto.length > 0) {
    p.push(
      `Ocorrência encerrada com ${emAberto.length} ação(ões) em aberto`
    );
  }

  if (houveLesao(incidente) && !incidente.data_afastamento) {
    p.push("Dias perdidos lançados sem data de início do afastamento");
  }

  if (!incidente.local_ocorrencia?.trim()) {
    p.push("Local exato da ocorrência não informado");
  }

  if (!incidente.responsavel_registro?.nome?.trim()) {
    p.push("Responsável pelo registro não identificado");
  }

  if (!dados.empresa?.nome?.trim()) {
    p.push("Identificação da organização ausente");
  }

  return p;
}

/**
 * Um elo da cadeia de causas.
 *
 * O texto explicativo de cada elo vai no documento junto do conteúdo porque o
 * relatório é lido por quem não fez a investigação — encarregado, cliente,
 * auditor. Sem a explicação, "causa básica" e "causa imediata" viram sinônimos e a
 * cadeia perde a função.
 */
const ELOS_DA_CAUSA = [
  {
    campo: "causas_imediatas" as const,
    titulo: "1. Causa imediata",
    explica: "O ato ou a condição presente no momento do evento.",
  },
  {
    campo: "causas_basicas" as const,
    titulo: "2. Causa básica",
    explica: "O fator pessoal ou de trabalho que permitiu o ato ou a condição acima.",
  },
  {
    campo: "causas_raiz" as const,
    titulo: "3. Causa raiz",
    explica:
      "A falha de sistema ou de gestão que originou a causa básica. É aqui que a " +
      "análise deixa de culpar quem executa e passa a atacar o que se repete.",
  },
] as const;

export function montarHtmlIncidente(
  dados: IncidenteDocumentoDados,
  hoje = new Date()
): string {
  const { incidente, envolvidos, investigacao, acoes, empresa, geradoPor } = dados;
  const emitidoEm = new Date().toLocaleString("pt-BR");
  const hojeIso = comoIso(hoje);

  const perdidos = inteiro(incidente.dias_perdidos);
  const debitados = inteiro(incidente.dias_debitados);
  const total = perdidos + debitados;

  const emAberto = acoesEmAbertoDoIncidente(acoes);
  const atrasadas = emAberto.filter((a) => !!a.prazo && a.prazo < hojeIso);

  const linhasEnvolvidos = envolvidos
    .map((e) => {
      const nome =
        e.colaborador_dados?.profile?.nome ||
        e.colaborador_dados?.nome ||
        e.colaborador_dados?.recurso?.nome ||
        "";
      return `<tr>
        <td>${esc(nome) || faltando("não identificado")}</td>
        <td>${esc(e.colaborador_dados?.matricula) || "—"}</td>
        <td>${esc(e.funcao?.nome) || "—"}</td>
        <td><strong>${esc(e.tipo_envolvimento)}</strong></td>
        <td>${esc(e.descricao) || esc(e.observacoes) || "—"}</td>
      </tr>`;
    })
    .join("");

  // Prazo mais curto primeiro; sem prazo no fim, onde chama atenção. A ordem é
  // guardada porque a foto de cada ação sai numerada conforme a linha da tabela.
  const acoesOrdenadas = [...acoes].sort((a, b) =>
    (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999")
  );

  const linhasAcoes = acoesOrdenadas
    .map((a, indice) => {
      const aberta = a.status !== "CONCLUIDA" && a.status !== "CANCELADA";
      const vencida = aberta && !!a.prazo && a.prazo < hojeIso;

      return `<tr>
        <td><strong>${indice + 1}.</strong> ${esc(a.descricao)}</td>
        <td>${esc(TIPO_ACAO_LABEL[a.tipo] ?? a.tipo)}</td>
        <td>${esc(a.responsavel?.nome) || faltando("não designado")}</td>
        <td>${
          a.prazo
            ? vencida
              ? `<span class="doc-inapto">${dataBr(a.prazo)} (vencido)</span>`
              : dataBr(a.prazo)
            : faltando("sem prazo")
        }</td>
        <td>${esc(GRAVIDADE_LABEL[a.prioridade] ?? a.prioridade)}</td>
        <td>${esc(STATUS_ACAO_LABEL[a.status] ?? a.status)}${
          a.data_conclusao ? `<br><span class="doc-neutro">${dataBr(a.data_conclusao)}</span>` : ""
        }</td>
      </tr>`;
    })
    .join("");

  const origens = [
    incidente.pgr ? `PGR: ${esc(incidente.pgr.titulo)}` : "",
    incidente.apr ? `APR: ${esc(incidente.apr.titulo)}` : "",
    incidente.pt ? `PT: ${esc(incidente.pt.titulo)}` : "",
    incidente.inspecao ? `Inspeção: ${esc(incidente.inspecao.titulo)}` : "",
  ].filter(Boolean);

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    ${estilosFotosDocumento}
    <div class="doc">

      <div class="doc-cab">
        <h1>Relatório de Investigação de Acidente</h1>
        <p class="doc-sub">
          ${incidente.codigo ? `Nº ${esc(incidente.codigo)} · ` : ""}Análise de acidente — NR-01 item 1.5.5.5
        </p>
      </div>

      ${
        tipoContradizOsDias(incidente)
          ? `<div class="doc-aviso">
              <strong>Classificação em desacordo com os dias lançados.</strong>
              A ocorrência está registrada como “Quase Acidente” e tem ${total} dia(s)
              lançado(s). Quase acidente não produz lesão: ou a classificação está
              errada, ou os dias estão. Enquanto os dois divergem, a contagem de
              acidentes e a taxa de gravidade apontam para lados diferentes.
             </div>`
          : ""
      }

      ${
        exigeInvestigacao(incidente) && !investigacao?.descricao_investigacao?.trim()
          ? `<div class="doc-aviso">
              <strong>Acidente sem investigação registrada.</strong>
              A NR-01 item 1.5.5.5 exige a análise do acidente. Este relatório sai sem
              a seção preenchida, e a lacuna fica visível de propósito.
             </div>`
          : ""
      }

      ${
        houveLesao(incidente) && incidente.cat_emitida !== true && (dados.cats?.length ?? 0) === 0
          ? `<div class="doc-aviso">
              <strong>Acidente com afastamento sem CAT.</strong>
              O prazo legal de comunicação é o primeiro dia útil seguinte ao acidente, e
              imediato em caso de óbito.
             </div>`
          : ""
      }

      ${
        incidente.cat_emitida === true && (dados.cats?.length ?? 0) === 0
          ? `<div class="doc-aviso">
              <strong>Marcado como “CAT emitida” sem CAT registrada no sistema.</strong>
              A marcação é declaração de quem preencheu o registro; a CAT é documento.
              Numa fiscalização o que vale é a CAT.
             </div>`
          : ""
      }

      ${
        atrasadas.length > 0
          ? `<div class="doc-aviso">
              <strong>${atrasadas.length} ação(ões) do plano com prazo vencido.</strong>
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
              incidente.projeto
                ? `[${esc(incidente.projeto.codigo)}] ${esc(incidente.projeto.nome)}`
                : "—"
            }</td>
            <td class="rot">Canteiro</td>
            <td>${esc(incidente.site?.nome) || "—"}</td>
          </tr>
          <tr>
            <td class="rot">Setor / Área</td>
            <td>${esc(incidente.area?.nome) || "—"}</td>
            <td class="rot">Local exato</td>
            <td>${esc(incidente.local_ocorrencia) || faltando("não informado")}</td>
          </tr>
          <tr>
            <td class="rot">Data e hora</td>
            <td><strong>${dataBr(incidente.data_ocorrencia)}${
              incidente.hora_ocorrencia ? ` às ${esc(incidente.hora_ocorrencia)}` : ""
            }</strong></td>
            <td class="rot">Situação</td>
            <td>${esc(STATUS_LABEL[incidente.status] ?? incidente.status)}</td>
          </tr>
          <tr>
            <td class="rot">Tipo</td>
            <td>${esc(incidente.tipo)}</td>
            <td class="rot">Gravidade</td>
            <td>${esc(GRAVIDADE_LABEL[incidente.gravidade] ?? incidente.gravidade)}</td>
          </tr>
        </table>
      </div>

      <div class="doc-sec">Descrição do fato</div>
      <div class="doc-bloco">
        <div class="tit">${esc(incidente.titulo)}</div>
        <div class="corpo"><p>${esc(incidente.descricao) || faltando("sem descrição")}</p></div>
      </div>

      <div class="doc-sec">Pessoas envolvidas</div>
      ${
        envolvidos.length > 0
          ? `<table class="doc-tabela">
              <thead>
                <tr>
                  <th>Nome</th><th>Matrícula</th><th>Função</th>
                  <th>Papel no evento</th><th>Observações</th>
                </tr>
              </thead>
              <tbody>${linhasEnvolvidos}</tbody>
             </table>`
          : `<div class="doc-vazio">
              Nenhuma pessoa vinculada ao evento. Sem vítima nem testemunha
              identificadas, a apuração dos fatos não tem de quem partir.
             </div>`
      }

      <div class="doc-sec">Afastamento e dias computados</div>
      <div class="doc-cards">
        <div class="doc-card">
          <div class="doc-num">${perdidos}</div>
          <p>Dias perdidos</p>
        </div>
        <div class="doc-card">
          <div class="doc-num">${debitados}</div>
          <p>Dias debitados</p>
        </div>
        <div class="doc-card">
          <div class="doc-num">${total}</div>
          <p>Total computado</p>
        </div>
      </div>
      <div class="doc-bloco">
        <div class="corpo">
          <p>
            Início do afastamento: <strong>${
              incidente.data_afastamento ? dataBr(incidente.data_afastamento) : faltando("não informado")
            }</strong> ·
            Retorno ao trabalho: <strong>${
              incidente.data_retorno ? dataBr(incidente.data_retorno) : "não retornou / não informado"
            }</strong>
          </p>
          <p class="doc-neutro">
            Dias debitados são os que a NBR 14280 atribui à perda permanente — 6.000 para
            óbito ou invalidez total, e valores fixos por membro perdido. Eles entram na
            taxa de gravidade junto com os perdidos: sem eles, um óbito pesaria menos que
            um afastamento de trinta dias.
          </p>
        </div>
      </div>

      <div class="doc-sec">Investigação e cadeia de causas</div>
      ${
        investigacao
          ? `
        <div class="doc-bloco">
          <div class="tit">Descrição da investigação</div>
          <div class="corpo"><p>${
            esc(investigacao.descricao_investigacao) || faltando("não registrada")
          }</p></div>
        </div>

        ${
          investigacao.fatos_observados
            ? `<div class="doc-bloco">
                <div class="tit">Fatos observados no local</div>
                <div class="corpo"><p>${esc(investigacao.fatos_observados)}</p></div>
               </div>`
            : ""
        }

        ${ELOS_DA_CAUSA.map(
          (elo) => `
          <div class="doc-bloco">
            <div class="tit">${elo.titulo}</div>
            <div class="corpo">
              <p class="doc-neutro">${esc(elo.explica)}</p>
              <p>${esc(investigacao[elo.campo]) || faltando("não identificada")}</p>
            </div>
          </div>`
        ).join("")}

        ${
          investigacao.fatores_contribuintes
            ? `<div class="doc-bloco">
                <div class="tit">Fatores contribuintes</div>
                <div class="corpo"><p>${esc(investigacao.fatores_contribuintes)}</p></div>
               </div>`
            : ""
        }

        ${
          investigacao.risco_catalogo
            ? `<div class="doc-bloco">
                <div class="tit">Risco do catálogo associado</div>
                <div class="corpo"><p>${esc(investigacao.risco_catalogo.nome)} —
                  <span class="doc-neutro">${esc(investigacao.risco_catalogo.categoria)}</span></p></div>
               </div>`
            : ""
        }

        ${
          investigacao.conclusao
            ? `<div class="doc-conclusao">
                <div class="tit">Conclusão da investigação</div>
                <p>${esc(investigacao.conclusao)}</p>
               </div>`
            : `<div class="doc-vazio">Investigação sem conclusão registrada.</div>`
        }
      `
          : `<div class="doc-vazio">
              Nenhuma investigação registrada para esta ocorrência.
              ${
                exigeInvestigacao(incidente)
                  ? "Tratando-se de acidente, a análise é exigida pela NR-01 item 1.5.5.5."
                  : ""
              }
             </div>`
      }

      <div class="doc-sec">Plano de ação corretiva e preventiva</div>
      ${
        acoes.length > 0
          ? `<table class="doc-tabela">
              <thead>
                <tr>
                  <th>Ação</th><th>Tipo</th><th>Responsável</th>
                  <th>Prazo</th><th>Prioridade</th><th>Situação</th>
                </tr>
              </thead>
              <tbody>${linhasAcoes}</tbody>
             </table>`
          : `<div class="doc-vazio">
              Nenhuma ação definida. Investigação sem ação não previne a repetição.
             </div>`
      }

      ${
        (dados.cats?.length ?? 0) > 0
          ? `<div class="doc-sec">Comunicação de Acidente de Trabalho</div>
             <table class="doc-tabela">
               <thead>
                 <tr><th>Nº da CAT</th><th>Tipo</th><th>Data do acidente</th><th>Emissão</th><th>Afastamento</th></tr>
               </thead>
               <tbody>
                 ${dados
                   .cats!.map(
                     (c) => `<tr>
                       <td>${esc(c.numero_cat) || faltando("sem protocolo")}</td>
                       <td>${esc(c.tipo_cat)}</td>
                       <td>${dataBr(c.data_acidente)}</td>
                       <td>${dataBr(c.data_emissao)}</td>
                       <td>${inteiro(c.dias_afastamento)} dia(s)${
                         c.houve_obito ? " · <strong>ÓBITO</strong>" : ""
                       }</td>
                     </tr>`
                   )
                   .join("")}
               </tbody>
             </table>`
          : ""
      }

      ${
        origens.length > 0
          ? `<div class="doc-sec">Origem mapeada</div>
             <div class="doc-bloco">
               <div class="corpo"><p>${origens.join(" · ")}</p></div>
             </div>`
          : ""
      }

      ${
        incidente.observacoes
          ? `<div class="doc-bloco">
              <div class="tit">Observações</div>
              <div class="corpo"><p>${esc(incidente.observacoes)}</p></div>
             </div>`
          : ""
      }

      ${blocoDeFotos(dados.fotos?.fotos ?? [], {
        titulo: "Evidência fotográfica do local",
        omitidas: dados.fotos?.omitidas,
        vazio:
          "Nenhuma foto do local anexada. A cena do acidente está descrita apenas " +
          "por escrito, e o local já não está no estado em que foi encontrado.",
      })}

      <div class="doc-assin">
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(incidente.responsavel_registro?.nome) || "&nbsp;"}</div>
          <hr>
          <p>Responsável pelo registro</p>
        </div>
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(investigacao?.responsavel?.nome) || "&nbsp;"}</div>
          <hr>
          <p>Responsável pela investigação</p>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${geradoPor ? ` por ${esc(geradoPor)}` : ""} ·
        Investigação de acidente — NR-01 item 1.5.5.5 · Dias computados pela NBR 14280
      </div>
    </div>
  `;
}

function nomeArquivo(incidente: SgsstIncidente): string {
  const base = incidente.codigo || incidente.titulo || "Ocorrencia";
  return `Investigacao_${base.replace(/[^\w-]+/g, "_").slice(0, 48)}.pdf`;
}

export async function gerarPdfIncidente(dados: IncidenteDocumentoDados): Promise<void> {
  await emitirPdfTimbrado({
    html: montarHtmlIncidente(dados),
    nomeArquivo: nomeArquivo(dados.incidente),
    identificacao: `${dados.incidente.codigo || ""} — ${dados.incidente.titulo}`.slice(0, 88),
  });
}
