import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";
import { estilosDocumentoSgsst } from "@/lib/sgsstDocumentoEstilos";
import { BASE_LEGAL_PCMSO, type ReferenciaLegal } from "@/utils/sgsstBaseLegal";
import {
  matrizExamesDoGhe,
  riscosDoGhe,
  cabecalhoDoGhe,
  quadroDeFuncoes,
  divergenciaDeQuantidade,
  ROTULO_OCASIAO,
  type GheBasico,
  type FuncaoDoGhe,
  type RiscoDoInventario,
  type OrigemDoVinculo,
} from "@/utils/sgsstGhe";
import {
  FAIXA_ETARIA_LABEL,
  type SgsstPcmso,
  type SgsstPcmsoExame,
} from "@/hooks/sgsst/useSgsstPcmso";

/**
 * Emissão do documento-base do PCMSO.
 *
 * Antes desta função o módulo guardava dados mas não produzia documento: se um
 * auditor pedisse o programa impresso, não havia o que entregar. O layout segue
 * a ordem dos itens da NR-07 7.5, e cada seção obrigatória avisa quando está
 * vazia em vez de sair em branco no PDF — um campo faltando é autuação.
 */

export interface PcmsoDocumentoDados {
  pcmso: SgsstPcmso;
  exames: SgsstPcmsoExame[];
  /** `empresas` não tem `razao_social`; o nome legal da organização é `nome`. */
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  /** Nome de quem gerou, para o rodapé de rastreabilidade. */
  geradoPor?: string | null;

  /**
   * Funções avaliadas pelo programa, para o quadro de descrição das atividades.
   *
   * Opcional: quando não vem, a seção não é impressa. Isto é deliberado — um
   * quadro vazio afirmaria que o programa não avalia função nenhuma, e a
   * ausência do dado no chamador não é essa afirmação.
   */
  funcoes?: readonly FuncaoDoGhe[];

  /** GHEs da organização. Sem eles, a seção de grupos não sai. */
  ghes?: readonly GheBasico[];

  /** Funções de cada GHE, por `ghe.id`. */
  funcoesPorGhe?: Map<string, FuncaoDoGhe[]>;

  /** Códigos dos GHEs de cada função, por `funcao.id`. */
  ghesPorFuncao?: Map<string, string[]>;

  /**
   * Inventário de riscos do PGR, de onde saem os riscos por GHE.
   *
   * `undefined` significa "não foi consultado" e faz a tabela de riscos do grupo
   * dizer isso, em vez de imprimir "nenhum risco" — que é conclusão diferente.
   */
  inventario?: readonly RiscoDoInventario[];

  /** Colaboradores ativos por `funcao.id`, para confrontar com a quantidade declarada. */
  ativosPorFuncao?: Map<string, number>;
}

function esc(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dataBr(iso?: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

/** Texto multilinha vira parágrafos; vazio vira aviso de pendência. */
/**
 * Seção de base legal.
 *
 * Compartilhada entre PGR e PCMSO: cada documento passa a sua lista, porque as
 * normas centrais de um são periféricas no outro.
 *
 * A tabela traz a pertinência de cada norma, e não só a sigla. Lista de siglas
 * obriga quem lê a supor por que a norma está ali; a pertinência é o que permite
 * conferir o escopo do documento.
 */
function secaoBaseLegal(referencias: readonly ReferenciaLegal[]): string {
  return `
    <p>
      As referências abaixo são a base legal <strong>observada</strong> na elaboração
      deste programa. A declaração de conformidade é do profissional que assina o
      documento; esta lista informa o escopo normativo considerado.
    </p>

    <table class="doc-tabela">
      <thead>
        <tr><th>Norma</th><th>Do que trata</th><th>Por que se aplica a este programa</th></tr>
      </thead>
      <tbody>
        ${referencias
          .map(
            (r) => `
              <tr>
                <td><strong>${esc(r.norma)}</strong></td>
                <td>${esc(r.ementa)}</td>
                <td>${esc(r.pertinencia)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function bloco(texto: string | null | undefined, aviso: string): string {
  const t = (texto ?? "").trim();
  if (!t) {
    return `<p class="doc-aviso">⚠ ${esc(aviso)}</p>`;
  }
  return t
    .split(/\n{2,}|\r?\n/)
    .filter((p) => p.trim())
    .map((p) => `<p>${esc(p.trim())}</p>`)
    .join("");
}

const ORDEM_TIPO = [
  "Admissional",
  "Periódico",
  "Retorno ao Trabalho",
  "Mudança de Risco/Função",
  "Demissional",
  "Outros",
];

/** Agrupa o quadro por função, que é o agrupamento adotado no lugar do GHE. */
function quadroExames(exames: SgsstPcmsoExame[]): string {
  if (exames.length === 0) {
    return `<p class="doc-aviso">⚠ Nenhum exame previsto. O planejamento de exames é obrigatório (NR-07 7.5).</p>`;
  }

  const porFuncao = new Map<string, SgsstPcmsoExame[]>();
  for (const ex of exames) {
    const chave = ex.funcao?.nome ?? "Todas as funções";
    if (!porFuncao.has(chave)) porFuncao.set(chave, []);
    porFuncao.get(chave)!.push(ex);
  }

  const grupos = [...porFuncao.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));

  return grupos
    .map(([funcao, lista]) => {
      const linhas = [...lista]
        .sort(
          (a, b) =>
            ORDEM_TIPO.indexOf(a.tipo_exame) - ORDEM_TIPO.indexOf(b.tipo_exame) ||
            a.nome_exame.localeCompare(b.nome_exame, "pt-BR")
        )
        .map((ex) => {
          const risco = ex.risco
            ? `${ex.risco.codigo ? `[${esc(ex.risco.codigo)}] ` : ""}${esc(ex.risco.nome)}`
            : ex.grupo_risco
              ? `<em>${esc(ex.grupo_risco)}</em>`
              : `<span class="doc-falta">não vinculado</span>`;

          const faixa =
            ex.faixa_etaria && ex.faixa_etaria !== "TODAS"
              ? esc(FAIXA_ETARIA_LABEL[ex.faixa_etaria])
              : "Todas";

          return `<tr>
            <td><strong>${esc(ex.nome_exame)}</strong></td>
            <td>${esc(ex.tipo_exame)}</td>
            <td class="doc-centro-txt">${esc(ex.periodicidade_meses)} m</td>
            <td class="doc-centro-txt">${faixa}</td>
            <td>${risco}</td>
            <td>${ex.base_legal ? esc(ex.base_legal) : `<span class="doc-falta">—</span>`}</td>
            <td>${
              ex.justificativa_tecnica
                ? esc(ex.justificativa_tecnica)
                : `<span class="doc-falta">sem justificativa técnica</span>`
            }</td>
          </tr>`;
        })
        .join("");

      return `
        <h3 class="doc-grupo">Função: ${esc(funcao)}</h3>
        <table class="doc-tabela">
          <thead>
            <tr>
              <th style="width:19%">Exame / Procedimento</th>
              <th style="width:12%">Tipo</th>
              <th style="width:7%">Period.</th>
              <th style="width:11%">Faixa etária</th>
              <th style="width:17%">Risco associado</th>
              <th style="width:12%">Base legal</th>
              <th style="width:22%">Justificativa técnica</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>`;
    })
    .join("");
}



/**
 * Quadro de funções avaliadas com a descrição detalhada das atividades.
 *
 * É a primeira coisa que os modelos de PCMSO trazem, e não por formalidade: a
 * descrição da atividade é o que permite conferir se o exame previsto faz sentido
 * para o que a pessoa efetivamente faz. Sem ela, "audiometria — periódico — 12
 * meses" é uma linha que ninguém consegue contestar nem confirmar.
 *
 * Função sem descrição aparece no quadro com a lacuna MARCADA. Omiti-la faria o
 * documento parecer completo com uma função de menos; marcá-la diz ao leitor
 * exatamente onde falta levantamento.
 */
function secaoQuadroFuncoes(
  funcoes: readonly FuncaoDoGhe[],
  ghesPorFuncao?: Map<string, string[]>
): string {
  const linhas = quadroDeFuncoes({ funcoes, ghesPorFuncao });
  if (linhas.length === 0) {
    return `<p class="doc-aviso">⚠ Nenhuma função cadastrada para este programa.</p>`;
  }

  const temGhe = linhas.some((l) => l.ghes.length > 0);
  const semDescricao = linhas.filter((l) => !l.descricao).length;

  const aviso =
    semDescricao > 0
      ? `<p class="doc-aviso">⚠ ${semDescricao} ${
          semDescricao === 1 ? "função está" : "funções estão"
        } sem descrição detalhada das atividades.</p>`
      : "";

  return `
    <p>
      As funções abaixo são as avaliadas por este programa. A descrição das
      atividades é a base para o dimensionamento dos exames das seções seguintes.
    </p>
    ${aviso}
    <table class="doc-tabela">
      <thead>
        <tr>
          <th style="width:4%">#</th>
          <th style="width:20%">Função</th>
          <th style="width:9%">CBO</th>
          ${temGhe ? `<th style="width:10%">GHE</th>` : ""}
          <th>Descrição detalhada das atividades</th>
        </tr>
      </thead>
      <tbody>
        ${linhas
          .map(
            (l) => `
              <tr>
                <td>${l.ordem}</td>
                <td><strong>${esc(l.nome)}</strong></td>
                <td>${esc(l.cbo) || "—"}</td>
                ${
                  temGhe
                    ? `<td>${
                        l.ghes.length ? esc(l.ghes.join(", ")) : `<span class="doc-falta">sem GHE</span>`
                      }</td>`
                    : ""
                }
                <td>${
                  l.descricao
                    ? esc(l.descricao)
                    : `<span class="doc-falta">descrição das atividades não cadastrada</span>`
                }</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

/** "grupo", "função" ou "grupo e função" — de onde a previsão veio. */
function textoDaOrigem(origens: readonly OrigemDoVinculo[]): string {
  if (origens.length === 0) return "";
  if (origens.length > 1) return "grupo e função";
  return origens[0] === "GRUPO" ? "grupo" : "função";
}

/**
 * Seção de GHE: um bloco por grupo, com cabeçalho, riscos e matriz de exames.
 *
 * A matriz repete o formato dos modelos de mercado (exame nas linhas, ocasião nas
 * colunas) porque é o formato que o médico examinador e o auditor já leem. Só as
 * colunas efetivamente usadas são impressas: coluna inteira vazia consome largura
 * de que as outras precisam, e numa página A4 isso decide se o texto da célula
 * quebra ou não.
 *
 * A coluna de origem existe para o documento não afirmar que todo o grupo faz um
 * exame que é de uma função específica dentro dele.
 */
function secaoGhes(dados: PcmsoDocumentoDados): string {
  const ghes = (dados.ghes ?? []).filter((g) => (g.status ?? "ativo") !== "inativo");
  if (ghes.length === 0) return "";

  const blocos = ghes
    .slice()
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }))
    .map((ghe) => {
      const funcoes = dados.funcoesPorGhe?.get(ghe.id) ?? [];
      const funcaoIds = funcoes.map((f) => f.id);

      const matriz = matrizExamesDoGhe({
        exames: dados.exames,
        gheId: ghe.id,
        funcaoIdsDoGhe: funcaoIds,
      });
      const riscos = riscosDoGhe({
        inventario: dados.inventario,
        gheId: ghe.id,
        funcaoIdsDoGhe: funcaoIds,
      });

      const contada = dados.ativosPorFuncao
        ? funcaoIds.reduce((s, id) => s + (dados.ativosPorFuncao!.get(id) ?? 0), 0)
        : null;
      const divergencia = divergenciaDeQuantidade({
        declarada: ghe.quantidade_trabalhadores,
        contada,
      });

      const cabecalho = cabecalhoDoGhe(ghe);

      const tabelaRiscos =
        riscos.situacao === "DESCONHECIDO"
          ? `<p class="doc-falta">Inventário de riscos do PGR não consultado nesta emissão.</p>`
          : riscos.situacao === "SEM_RISCO"
            ? `<p class="doc-aviso">⚠ Nenhum risco do inventário do PGR alcança este grupo.</p>`
            : `
              <table class="doc-tabela">
                <thead>
                  <tr>
                    <th style="width:18%">Risco ambiental</th>
                    <th style="width:26%">Agente</th>
                    <th>Danos à saúde</th>
                    <th style="width:14%">Levantado para</th>
                  </tr>
                </thead>
                <tbody>
                  ${riscos.riscos
                    .map(
                      (r) => `
                        <tr>
                          <td><strong>${esc(r.categoria)}</strong></td>
                          <td>${esc(r.agente) || "—"}</td>
                          <td>${
                            r.danos
                              ? esc(r.danos)
                              : `<span class="doc-falta">dano à saúde não descrito</span>`
                          }</td>
                          <td>${esc(textoDaOrigem(r.origens))}</td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>
            `;

      const tabelaExames =
        matriz.situacao === "DESCONHECIDO"
          ? `<p class="doc-falta">Exames previstos não consultados nesta emissão.</p>`
          : matriz.situacao === "SEM_EXAME"
            ? `<p class="doc-aviso">⚠ Nenhum exame previsto para este grupo nem para suas funções.</p>`
            : `
              <table class="doc-tabela">
                <thead>
                  <tr>
                    <th>Exame</th>
                    ${matriz.ocasioesUsadas
                      .map((o) => `<th style="text-align:center">${esc(ROTULO_OCASIAO[o])}</th>`)
                      .join("")}
                    <th style="width:14%">Previsto para</th>
                  </tr>
                </thead>
                <tbody>
                  ${matriz.linhas
                    .map((l) => {
                      const origens = new Set<OrigemDoVinculo>();
                      for (const o of matriz.ocasioesUsadas) {
                        for (const org of l.celulas[o].origens) origens.add(org);
                      }
                      return `
                        <tr>
                          <td>${esc(l.exame)}</td>
                          ${matriz.ocasioesUsadas
                            .map((o) => {
                              const c = l.celulas[o];
                              if (!c.previsto) return `<td style="text-align:center">—</td>`;
                              // A periodicidade substitui o "X" no periódico: o X
                              // diz que há exame, a periodicidade diz quando — e é
                              // a segunda informação que se confere na auditoria.
                              const conteudo = c.periodicidade
                                ? esc(c.periodicidade)
                                : "<strong>X</strong>";
                              return `<td style="text-align:center">${conteudo}</td>`;
                            })
                            .join("")}
                          <td>${esc(textoDaOrigem([...origens]))}</td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            `;

      return `
        <div class="doc-bloco">
          <div class="tit">${esc(ghe.codigo)} — ${esc(ghe.nome)}</div>

          <table class="doc-grid">
            ${cabecalho
              .map((l) => `<tr><td class="rot">${esc(l.rotulo)}</td><td>${esc(l.valor)}</td></tr>`)
              .join("")}
            <tr>
              <td class="rot">Funções do grupo</td>
              <td>${
                funcoes.length
                  ? esc(funcoes.map((f) => f.nome).join(", "))
                  : `<span class="doc-falta">nenhuma função vinculada</span>`
              }</td>
            </tr>
            <tr>
              <td class="rot">Trabalhadores</td>
              <td>${
                divergencia.declarada !== null
                  ? `${divergencia.declarada} declarado(s)`
                  : `<span class="doc-falta">quantidade não declarada</span>`
              }${
                divergencia.contada !== null ? ` · ${divergencia.contada} ativo(s) no cadastro` : ""
              }</td>
            </tr>
          </table>

          ${
            divergencia.aviso
              ? `<p class="doc-aviso">⚠ ${esc(divergencia.aviso)}</p>`
              : ""
          }
          ${ghe.descricao ? `<p>${esc(ghe.descricao)}</p>` : ""}

          <h3 class="doc-grupo">Riscos ambientais do grupo</h3>
          ${tabelaRiscos}

          <h3 class="doc-grupo">Exames por ocasião</h3>
          ${tabelaExames}
        </div>
      `;
    })
    .join("");

  return `
    <p>
      O Grupo Homogêneo de Exposição reúne funções submetidas à mesma exposição,
      de modo que o levantamento de riscos e o planejamento de exames sejam feitos
      uma vez para o conjunto. Os grupos abaixo são compartilhados com o PGR: o
      risco listado é o do inventário daquele programa, não um levantamento
      próprio deste documento.
    </p>
    <p>
      A coluna <em>previsto para</em> distingue o que é do grupo inteiro do que é
      de uma função específica dentro dele. Onde há periodicidade, ela aparece na
      célula do exame periódico.
    </p>
    ${blocos}
  `;
}

export function montarHtmlPcmso(dados: PcmsoDocumentoDados): string {
  const { pcmso, exames, empresa, geradoPor } = dados;
  const emitidoEm = new Date().toLocaleString("pt-BR");
  const empresaNome = empresa?.nome || "—";

  const secaoFuncoes = dados.funcoes?.length
    ? secaoQuadroFuncoes(dados.funcoes, dados.ghesPorFuncao)
    : "";
  const secaoGrupos = secaoGhes(dados);

  /**
   * Numeração calculada, não escrita à mão.
   *
   * As duas seções novas são condicionais — sem função cadastrada ou sem GHE, não
   * saem. Números fixos deixariam buracos ("1, 2, 4, 6") num documento de
   * conformidade, e buraco de numeração é a primeira coisa que se interpreta como
   * página faltando.
   */
  const n = (() => {
    let i = 2; // 1 = Objetivo, 2 = Base legal.
    const atribuir = (existe: boolean) => (existe ? ++i : i);
    const funcoes = atribuir(!!secaoFuncoes);
    const agravos = ++i;
    const ghe = atribuir(!!secaoGrupos);
    const exames = ++i;
    const criterios = ++i;
    const observacoes = ++i;
    return { funcoes, agravos, ghe, exames, criterios, observacoes };
  })();

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    <div class="doc">

      <div class="doc-cab">
        <h1>Programa de Controle Médico de Saúde Ocupacional</h1>
        <p class="doc-sub">Documento-base · NR-07 · Exercício ${esc(
          pcmso.ano_referencia ?? dataBr(pcmso.data_inicio).slice(-4)
        )}</p>
      </div>

      <div class="doc-ident">
        <table>
          <tr>
            <td class="rot">Organização</td><td><strong>${esc(empresaNome)}</strong></td>
            <td class="rot">CNPJ</td><td>${esc(empresa?.cnpj) || "—"}</td>
          </tr>
          <tr>
            <td class="rot">Programa</td><td>${esc(pcmso.titulo)}</td>
            <td class="rot">Código</td><td>${esc(pcmso.codigo) || "—"}</td>
          </tr>
          <tr>
            <td class="rot">Escopo</td>
            <td>${
              pcmso.projeto
                ? esc(`[${pcmso.projeto.codigo}] ${pcmso.projeto.nome}`)
                : "Geral da organização"
            }</td>
            <td class="rot">Vigência</td>
            <td>${dataBr(pcmso.data_inicio)} — ${
              pcmso.data_revisao ? dataBr(pcmso.data_revisao) : "revisão não definida"
            }</td>
          </tr>
          <tr>
            <td class="rot">Médico coordenador</td>
            <td>${esc(pcmso.medico_responsavel) || "—"}</td>
            <td class="rot">CRM</td><td>${esc(pcmso.crm_medico) || "—"}</td>
          </tr>
          <tr>
            <td class="rot">Responsável SST</td><td>${esc(pcmso.responsavel) || "—"}</td>
            <td class="rot">Situação</td><td>${esc(pcmso.status)}</td>
          </tr>
        </table>
      </div>

      <h2 class="doc-sec">1. Objetivo do programa</h2>
      ${bloco(pcmso.objetivo, "Objetivo não preenchido.")}

      <h2 class="doc-sec">2. Base legal <span class="doc-sub">requisitos legais e infralegais</span></h2>
      ${secaoBaseLegal(BASE_LEGAL_PCMSO)}

      ${
        secaoFuncoes
          ? `<h2 class="doc-sec">${n.funcoes}. Funções avaliadas <span class="doc-sub">descrição detalhada das atividades</span></h2>${secaoFuncoes}`
          : ""
      }

      <h2 class="doc-sec">${n.agravos}. Agravos à saúde relacionados aos riscos ocupacionais</h2>
      ${bloco(
        pcmso.agravos_saude,
        "Obrigatório pela NR-07 item 7.5. Preencha em Editar Dados antes de emitir o programa."
      )}

      ${
        secaoGrupos
          ? `<h2 class="doc-sec">${n.ghe}. Exames por GHE <span class="doc-sub">grupo homogêneo de exposição</span></h2>${secaoGrupos}`
          : ""
      }

      <h2 class="doc-sec">${n.exames}. Planejamento de exames médicos e complementares${
        secaoGrupos ? ` <span class="doc-sub">por função</span>` : ""
      }</h2>
      ${quadroExames(exames)}

      <h2 class="doc-sec">${n.criterios}. Critérios de interpretação dos achados e conduta</h2>
      ${bloco(
        pcmso.criterios_conduta,
        "Obrigatório pela NR-07 item 7.5. Precisa ser conhecido por todos os médicos que realizam os exames."
      )}

      ${
        pcmso.observacoes
          ? `<h2 class="doc-sec">${n.observacoes}. Observações complementares</h2>${bloco(
              pcmso.observacoes,
              ""
            )}`
          : ""
      }

      <div class="doc-assin">
        <div>
          <div class="nome">${esc(pcmso.medico_responsavel) || "________________________"}</div>
          <div class="papel">Médico coordenador do PCMSO${
            pcmso.crm_medico ? ` · ${esc(pcmso.crm_medico)}` : ""
          }</div>
        </div>
        <div>
          <div class="nome">${esc(pcmso.responsavel) || "________________________"}</div>
          <div class="papel">Responsável pela SST na organização</div>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${geradoPor ? ` por ${esc(geradoPor)}` : ""} ·
        ${exames.length} exame(s) previsto(s) ·
        Documento gerado pelo sistema de Gestão de Contratos.
      </div>
    </div>
  `;
}

/**
 * Itens obrigatórios ainda vazios. A tela usa isto para avisar antes de emitir,
 * em vez de deixar o usuário descobrir a pendência com o PDF na mão.
 */
export function pendenciasPcmso(pcmso: SgsstPcmso, exames: SgsstPcmsoExame[]): string[] {
  const p: string[] = [];
  if (!pcmso.agravos_saude?.trim()) p.push("Agravos à saúde relacionados aos riscos (NR-07 7.5)");
  if (!pcmso.criterios_conduta?.trim()) p.push("Critérios de interpretação e conduta (NR-07 7.5)");
  if (exames.length === 0) p.push("Nenhum exame previsto no programa");
  if (!pcmso.medico_responsavel?.trim()) p.push("Médico coordenador do PCMSO");
  if (!pcmso.crm_medico?.trim()) p.push("CRM do médico coordenador");

  const semRisco = exames.filter((e) => !e.risco_catalogo_id && !e.grupo_risco?.trim()).length;
  if (semRisco > 0) p.push(`${semRisco} exame(s) sem risco associado`);

  const semJustificativa = exames.filter((e) => !e.justificativa_tecnica?.trim()).length;
  if (semJustificativa > 0) p.push(`${semJustificativa} exame(s) sem justificativa técnica`);

  return p;
}

export async function gerarPdfPcmso(dados: PcmsoDocumentoDados): Promise<void> {
  const nome = `PCMSO_${(dados.pcmso.codigo || dados.pcmso.titulo)
    .replace(/[^\w-]+/g, "_")
    .slice(0, 40)}.pdf`;

  await emitirPdfTimbrado({
    html: montarHtmlPcmso(dados),
    nomeArquivo: nome,
    identificacao: `PCMSO ${dados.pcmso.codigo || dados.pcmso.titulo}`,
  });
}
