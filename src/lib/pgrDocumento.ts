import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";
import {
  estilosDocumentoSgsst,
  escDoc as esc,
  dataBrDoc as dataBr,
} from "@/lib/sgsstDocumentoEstilos";
import type {
  SgsstPgr,
  SgsstPgrInventario,
  SgsstPgrMedidaControle,
  InventarioFuncao,
} from "@/hooks/sgsst/useSgsstPgr";
import { RESULTADO_VERIFICACAO_LABEL } from "@/hooks/sgsst/useSgsstPgr";
import {
  resumoConformidade,
  RESULTADO_AVALIACAO_LABEL,
  TIPO_EXPOSICAO_LABEL,
} from "@/utils/sgsstPgrInventario";
import { calcularRevisao, textoPrazoRevisao } from "@/utils/sgsstPgrRevisao";

/**
 * Emissão do PGR — Programa de Gerenciamento de Riscos, NR-01.
 *
 * O módulo guardava inventário e medidas, mas não produzia documento: pedido o
 * PGR impresso, não havia o que entregar. O layout segue a estrutura que a NR-01
 * pede — identificação, inventário de riscos (1.5.7.3.2) e plano de ação
 * (1.5.5.2) — e cada seção obrigatória avisa quando está vazia em vez de sair em
 * branco. Campo faltando é autuação, e sair em branco esconde isso de quem
 * assina.
 *
 * A identificação da organização vem congelada do próprio PGR
 * (`empresa_nome`/`empresa_cnpj`), não da empresa atual: se a empresa for
 * renomeada, os PGRs já emitidos não podem passar a mostrar o nome novo.
 */

export interface PgrDocumentoDados {
  pgr: SgsstPgr;
  inventario: SgsstPgrInventario[];
  /** Medidas de controle, indexadas pelo id do item de inventário. */
  medidasPorItem: Record<string, SgsstPgrMedidaControle[]>;
  /** Grupos expostos, indexados pelo id do item de inventário. */
  funcoesPorItem: Record<string, InventarioFuncao[]>;
  geradoPor?: string | null;
}

function bloco(valor: string | null | undefined, avisoSeVazio: string): string {
  if (valor && valor.trim()) {
    return `<div class="doc-bloco">${esc(valor)}</div>`;
  }
  return `<div class="doc-aviso">${esc(avisoSeVazio)}</div>`;
}

/** Tom da classificação, para o nível de risco saltar aos olhos na tabela. */
function classeClassificacao(classificacao?: string | null): string {
  switch (classificacao) {
    case "CRÍTICO":
    case "ALTO":
      return "doc-pior";
    case "MODERADO":
      return "doc-neutro";
    case "BAIXO":
      return "doc-melhor";
    default:
      return "";
  }
}

function medicaoTexto(item: SgsstPgrInventario): string {
  if (item.tecnica_avaliacao !== "QUANTITATIVA") {
    return "Avaliação qualitativa";
  }

  if (item.intensidade_medida === null || item.intensidade_medida === undefined) {
    return '<span class="doc-falta">medição não informada</span>';
  }

  const unidade = item.unidade_medida ? ` ${esc(item.unidade_medida)}` : "";
  const limite =
    item.limite_tolerancia_aplicado !== null && item.limite_tolerancia_aplicado !== undefined
      ? ` (LT ${String(item.limite_tolerancia_aplicado).replace(".", ",")}${unidade})`
      : "";
  const resultado = item.resultado_avaliacao
    ? ` — ${RESULTADO_AVALIACAO_LABEL[item.resultado_avaliacao]}`
    : '<span class="doc-falta"> — conclusão não declarada</span>';

  const medida = String(item.intensidade_medida).replace(".", ",");
  const data = item.data_medicao ? `<br><small>medido em ${dataBr(item.data_medicao)}</small>` : "";

  return `${medida}${unidade}${limite}${resultado}${data}`;
}

function gruposTexto(item: SgsstPgrInventario, funcoes: InventarioFuncao[]): string {
  const nomes = funcoes.map((f) => f.funcao?.nome).filter(Boolean) as string[];
  const partes: string[] = [];

  if (nomes.length > 0) partes.push(esc(nomes.join(", ")));
  if (item.grupos_expostos?.trim()) partes.push(esc(item.grupos_expostos));

  if (partes.length === 0) {
    return '<span class="doc-falta">grupos expostos não identificados</span>';
  }

  const quantidade = item.trabalhadores_expostos
    ? `<br><small>${item.trabalhadores_expostos} trabalhador(es)</small>`
    : "";

  return partes.join(" · ") + quantidade;
}

/**
 * Coluna "medidas existentes" da linha do inventario.
 *
 * Sai das medidas do gerenciador que ja estao IMPLANTADAS, porque e isso que a
 * alinea "h" da NR-01 pergunta: o que ja existe de controle. Medida pendente e
 * promessa e aparece no plano de acao, mais abaixo no documento, nao aqui.
 *
 * O texto legado entra como reserva: itens cadastrados antes de o gerenciador
 * existir so tem ele, e deixa-los sair como "nenhuma registrada" seria o
 * documento sub-reportar controle que existe.
 */
function medidasExistentesTexto(
  item: SgsstPgrInventario,
  medidas: SgsstPgrMedidaControle[]
): string {
  const implantadas = medidas.filter((m) => m.status === "implementado");

  if (implantadas.length > 0) {
    return implantadas
      .map((m) => `<strong>${esc(m.tipo)}:</strong> ${esc(m.descricao)}`)
      .join("<br>");
  }

  if (item.medidas_existentes) {
    return esc(item.medidas_existentes);
  }

  return '<span class="doc-falta">nenhuma registrada</span>';
}

function linhaInventario(
  item: SgsstPgrInventario,
  indice: number,
  funcoes: InventarioFuncao[],
  medidas: SgsstPgrMedidaControle[]
): string {
  const exposicao = item.tipo_exposicao
    ? TIPO_EXPOSICAO_LABEL[item.tipo_exposicao] +
      (item.tempo_exposicao ? `<br><small>${esc(item.tempo_exposicao)}</small>` : "")
    : '<span class="doc-falta">não caracterizada</span>';

  return `
    <tr>
      <td class="doc-num">${indice}</td>
      <td>
        <strong>${esc(item.perigo)}</strong>
        <br><small>${esc(item.atividade)}</small>
        ${item.fonte_geradora ? `<br><small>Fonte: ${esc(item.fonte_geradora)}</small>` : ""}
      </td>
      <td>${esc(item.consequencia) || '<span class="doc-falta">não informada</span>'}</td>
      <td>${
        esc(item.area?.nome) ||
        esc(item.descricao_local) ||
        '<span class="doc-falta">não informado</span>'
      }</td>
      <td>${exposicao}</td>
      <td>${gruposTexto(item, funcoes)}</td>
      <td>${medicaoTexto(item)}</td>
      <td class="doc-num">${item.probabilidade} × ${item.severidade} = ${
        item.nivel_risco ?? item.probabilidade * item.severidade
      }</td>
      <td class="${classeClassificacao(item.classificacao)}">${esc(item.classificacao) || "—"}</td>
      <td>${medidasExistentesTexto(item, medidas)}</td>
    </tr>
  `;
}

function linhaMedida(medida: SgsstPgrMedidaControle, perigo: string): string {
  const afericao = medida.resultado_verificacao
    ? `${RESULTADO_VERIFICACAO_LABEL[medida.resultado_verificacao]}${
        medida.data_verificacao ? `<br><small>${dataBr(medida.data_verificacao)}</small>` : ""
      }${
        medida.verificador?.nome ? `<br><small>por ${esc(medida.verificador.nome)}</small>` : ""
      }`
    : '<span class="doc-falta">não aferida</span>';

  return `
    <tr>
      <td>${esc(perigo)}</td>
      <td>${esc(medida.descricao)}</td>
      <td>${esc(medida.tipo)}</td>
      <td>${esc(medida.responsavel?.nome) || '<span class="doc-falta">sem responsável</span>'}</td>
      <td>${medida.prazo ? dataBr(medida.prazo) : '<span class="doc-falta">sem prazo</span>'}</td>
      <td>${esc(medida.status)}</td>
      <td>${
        esc(medida.forma_acompanhamento) ||
        '<span class="doc-falta">não definida</span>'
      }</td>
      <td>${afericao}</td>
    </tr>
  `;
}

export function montarHtmlPgr(dados: PgrDocumentoDados): string {
  const { pgr, inventario, medidasPorItem, funcoesPorItem, geradoPor } = dados;
  const emitidoEm = new Date().toLocaleString("pt-BR");

  const revisao = calcularRevisao({
    dataInicio: pgr.data_inicio,
    dataRevisao: pgr.data_revisao,
    periodicidadeMeses: pgr.periodicidade_revisao_meses,
    status: pgr.status,
    hoje: new Date(),
  });

  const conformidade = resumoConformidade(
    inventario.map((item) => ({
      ...item,
      totalFuncoes: (funcoesPorItem[item.id] ?? []).length,
    }))
  );

  // Ordena por nível de risco: o documento tem de começar pelo que mais importa,
  // não pela ordem em que foi digitado.
  const ordenado = [...inventario].sort(
    (a, b) =>
      (b.nivel_risco ?? b.probabilidade * b.severidade) -
      (a.nivel_risco ?? a.probabilidade * a.severidade)
  );

  const todasMedidas = ordenado.flatMap((item) =>
    (medidasPorItem[item.id] ?? []).map((m) => ({ medida: m, perigo: item.perigo }))
  );

  const criticos = inventario.filter(
    (i) => i.classificacao === "CRÍTICO" || i.classificacao === "ALTO"
  ).length;

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    <div class="doc">

      <div class="doc-cab">
        <h1>Programa de Gerenciamento de Riscos</h1>
        <p class="doc-sub">PGR · NR-01 · Versão ${esc(pgr.versao ?? 1)}</p>
      </div>

      <div class="doc-ident">
        <table>
          <tr>
            <td class="rot">Organização</td>
            <td><strong>${esc(pgr.empresa_nome) || "—"}</strong></td>
            <td class="rot">CNPJ</td>
            <td>${esc(pgr.empresa_cnpj) || "—"}</td>
          </tr>
          <tr>
            <td class="rot">Programa</td><td>${esc(pgr.titulo)}</td>
            <td class="rot">Código</td><td>${esc(pgr.codigo) || "—"}</td>
          </tr>
          <tr>
            <td class="rot">Obra</td>
            <td>${
              pgr.projeto
                ? esc(`[${pgr.projeto.codigo}] ${pgr.projeto.nome}`)
                : "Geral da organização"
            }</td>
            <td class="rot">Local</td>
            <td>${pgr.site ? esc(pgr.site.nome) : "—"}</td>
          </tr>
          <tr>
            <td class="rot">Início da vigência</td><td>${dataBr(pgr.data_inicio)}</td>
            <td class="rot">Situação</td><td>${esc(pgr.status)}</td>
          </tr>
          <tr>
            <td class="rot">Última revisão</td>
            <td>${pgr.data_revisao ? dataBr(pgr.data_revisao) : "nenhuma registrada"}</td>
            <td class="rot">Próxima revisão</td>
            <td>${
              revisao.vencimento
                ? `${esc(
                    // Formatado direto do Date, sem passar por toISOString(): ele
                    // converte para UTC e devolveria o dia anterior em fuso
                    // positivo.
                    revisao.vencimento.toLocaleDateString("pt-BR")
                  )} (${textoPrazoRevisao(revisao)})`
                : "—"
            }</td>
          </tr>
          <tr>
            <td class="rot">Responsável técnico</td>
            <td>${esc(pgr.responsavel_tecnico) || esc(pgr.responsavel?.nome) || "—"}</td>
            <td class="rot">Registro</td>
            <td>${esc(pgr.registro_responsavel) || "—"}</td>
          </tr>
        </table>
      </div>

      ${
        revisao.situacao === "VENCIDO"
          ? `<div class="doc-aviso">Revisão vencida: a NR-01 1.5.4.4.5 exige revisão a cada
             ${esc(pgr.periodicidade_revisao_meses ?? 24)} meses. Este programa está
             ${esc(Math.abs(revisao.diasRestantes ?? 0))} dia(s) em atraso.</div>`
          : ""
      }

      <h2 class="doc-sec">1. Objetivo</h2>
      ${bloco(pgr.objetivo, "Objetivo não preenchido.")}

      <h2 class="doc-sec">2. Metodologia de identificação e avaliação de riscos</h2>
      ${bloco(
        pgr.metodologia,
        "Metodologia não descrita. A NR-01 exige que o programa declare como os riscos foram identificados e avaliados."
      )}

      <h2 class="doc-sec">3. Panorama do inventário</h2>
      <div class="doc-cards">
        <div class="doc-card">
          <span class="rot">Itens no inventário</span>
          <strong>${conformidade.total}</strong>
        </div>
        <div class="doc-card">
          <span class="rot">Risco alto ou crítico</span>
          <strong class="${criticos > 0 ? "doc-pior" : "doc-melhor"}">${criticos}</strong>
        </div>
        <div class="doc-card">
          <span class="rot">Itens completos pela norma</span>
          <strong>${conformidade.completos} de ${conformidade.total}</strong>
        </div>
        <div class="doc-card">
          <span class="rot">Medidas no plano de ação</span>
          <strong>${todasMedidas.length}</strong>
        </div>
      </div>

      ${
        conformidade.incompletos > 0
          ? `<div class="doc-aviso">
              <strong>${conformidade.incompletos} item(ns) do inventário estão incompletos
              pela NR-01 1.5.7.3.2.</strong> As alíneas mais ausentes são:
              ${esc(
                conformidade.alineasMaisAusentes
                  .slice(0, 4)
                  .map((a) => `${a.titulo} (${a.ocorrencias})`)
                  .join("; ")
              )}. Os campos faltantes aparecem marcados nas tabelas a seguir.
             </div>`
          : ""
      }

      <h2 class="doc-sec">4. Inventário de riscos <span class="doc-sub">NR-01 1.5.7.3.2</span></h2>
      ${
        ordenado.length === 0
          ? `<div class="doc-aviso">Inventário vazio. Um PGR sem inventário de riscos não
             atende à NR-01.</div>`
          : `<table class="doc-tabela">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Perigo / atividade</th>
                  <th>Lesões ou agravos</th>
                  <th>Local</th>
                  <th>Exposição</th>
                  <th>Grupos expostos</th>
                  <th>Monitoramento</th>
                  <th>P × S</th>
                  <th>Nível</th>
                  <th>Medidas existentes</th>
                </tr>
              </thead>
              <tbody>
                ${ordenado
                  .map((item, i) =>
                    linhaInventario(
                      item,
                      i + 1,
                      funcoesPorItem[item.id] ?? [],
                      medidasPorItem[item.id] ?? []
                    )
                  )
                  .join("")}
              </tbody>
             </table>`
      }

      <h2 class="doc-sec">5. Plano de ação <span class="doc-sub">NR-01 1.5.5.2</span></h2>
      ${
        todasMedidas.length === 0
          ? `<div class="doc-aviso">Nenhuma medida de controle registrada. A norma exige plano
             de ação com medida, responsável, prazo, forma de acompanhamento e aferição dos
             resultados.</div>`
          : `<table class="doc-tabela">
              <thead>
                <tr>
                  <th>Perigo</th>
                  <th>Medida</th>
                  <th>Hierarquia</th>
                  <th>Responsável</th>
                  <th>Prazo</th>
                  <th>Situação</th>
                  <th>Acompanhamento</th>
                  <th>Aferição</th>
                </tr>
              </thead>
              <tbody>
                ${todasMedidas.map(({ medida, perigo }) => linhaMedida(medida, perigo)).join("")}
              </tbody>
             </table>`
      }

      <h2 class="doc-sec">6. Observações</h2>
      ${bloco(pgr.observacoes, "Sem observações registradas.")}

      <div class="doc-assin">
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">
            ${esc(pgr.responsavel_tecnico) || esc(pgr.responsavel?.nome) || "&nbsp;"}
          </div>
          <hr>
          <p>Responsável técnico</p>
          <p>${esc(pgr.registro_responsavel) || "&nbsp;"}</p>
        </div>
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">&nbsp;</div>
          <hr>
          <p>Representante da organização</p>
          <p>${esc(pgr.empresa_nome) || "&nbsp;"}</p>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${geradoPor ? ` por ${esc(geradoPor)}` : ""} ·
        Versão ${esc(pgr.versao ?? 1)} ·
        A NR-01 1.5.7.3.3 exige a guarda deste documento e do seu histórico de
        atualizações por 20 anos.
      </div>
    </div>
  `;
}

/**
 * Pendências que impedem o PGR de ser considerado completo.
 *
 * Mostradas antes de emitir, para o usuário decidir com informação em vez de
 * descobrir o furo depois de entregar o documento.
 */
export function pendenciasPgr(dados: PgrDocumentoDados): string[] {
  const { pgr, inventario, medidasPorItem, funcoesPorItem } = dados;
  const p: string[] = [];

  if (!pgr.empresa_nome?.trim()) p.push("Identificação da organização ausente no programa");
  if (!pgr.objetivo?.trim()) p.push("Objetivo não preenchido");
  if (!pgr.metodologia?.trim()) {
    p.push("Metodologia de identificação e avaliação de riscos não descrita");
  }
  if (!pgr.responsavel_tecnico?.trim() && !pgr.responsavel?.nome) {
    p.push("Responsável técnico não identificado");
  }

  if (inventario.length === 0) {
    p.push("Inventário de riscos vazio");
    return p;
  }

  const conformidade = resumoConformidade(
    inventario.map((item) => ({
      ...item,
      totalFuncoes: (funcoesPorItem[item.id] ?? []).length,
    }))
  );

  if (conformidade.incompletos > 0) {
    p.push(
      `${conformidade.incompletos} item(ns) do inventário incompletos pela NR-01 1.5.7.3.2`
    );
  }

  // Risco alto ou crítico sem nenhuma medida planejada é a pendência mais grave
  // possível: o programa reconhece o risco e não faz nada a respeito.
  const criticosSemMedida = inventario.filter(
    (i) =>
      (i.classificacao === "CRÍTICO" || i.classificacao === "ALTO") &&
      (medidasPorItem[i.id] ?? []).length === 0
  ).length;

  if (criticosSemMedida > 0) {
    p.push(
      `${criticosSemMedida} risco(s) alto ou crítico sem nenhuma medida no plano de ação`
    );
  }

  const semAcompanhamento = Object.values(medidasPorItem)
    .flat()
    .filter((m) => !m.forma_acompanhamento?.trim()).length;

  if (semAcompanhamento > 0) {
    p.push(`${semAcompanhamento} medida(s) sem forma de acompanhamento definida`);
  }

  const implementadasSemAfericao = Object.values(medidasPorItem)
    .flat()
    .filter((m) => m.status === "implementado" && !m.resultado_verificacao).length;

  if (implementadasSemAfericao > 0) {
    p.push(
      `${implementadasSemAfericao} medida(s) implementada(s) sem aferição de resultado`
    );
  }

  const revisao = calcularRevisao({
    dataInicio: pgr.data_inicio,
    dataRevisao: pgr.data_revisao,
    periodicidadeMeses: pgr.periodicidade_revisao_meses,
    status: pgr.status,
    hoje: new Date(),
  });

  if (revisao.situacao === "VENCIDO") {
    p.push(
      `Revisão vencida há ${Math.abs(revisao.diasRestantes ?? 0)} dia(s) — NR-01 1.5.4.4.5`
    );
  }

  return p;
}

export async function gerarPdfPgr(dados: PgrDocumentoDados): Promise<void> {
  const nome = `PGR_${(dados.pgr.codigo || dados.pgr.titulo)
    .replace(/[^\w-]+/g, "_")
    .slice(0, 40)}_v${dados.pgr.versao ?? 1}.pdf`;

  await emitirPdfTimbrado({
    html: montarHtmlPgr(dados),
    nomeArquivo: nome,
    identificacao: `PGR ${dados.pgr.codigo || dados.pgr.titulo} — v${dados.pgr.versao ?? 1}`,
  });
}
