import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";
import { estilosDocumentoSgsst } from "@/lib/sgsstDocumentoEstilos";
import type { SgsstAso } from "@/hooks/sgsst/useSgsstAsosAndExames";
import {
  AGENTES_RISCO_ASO,
  CATEGORIAS_RISCO_ASO,
  CATEGORIA_RISCO_ASO_LABEL,
  agentesDaCategoria,
  nomesDosRiscos,
  situacaoDosRiscos,
} from "@/utils/sgsstRiscosAso";
import {
  ATIVIDADES_ESPECIFICAS,
  ATIVIDADE_ESPECIFICA_LABEL,
  conclusaoPendente,
  type AptidaoAtividade,
} from "@/utils/sgsstAptidaoAso";

/**
 * Emissão do ASO — Atestado de Saúde Ocupacional.
 *
 * É o documento que sai da empresa e vai para a mão do trabalhador. A NR-07
 * 7.5.15.1 lista o conteúdo obrigatório, e esta folha segue a estrutura das fichas
 * de ASO em uso: campos de MARCAÇÃO onde a norma tem vocabulário fechado, e texto
 * apenas onde ele é de fato livre.
 *
 * Três decisões, e a primeira é a razão de esta versão existir:
 *
 * 1. **O sistema não conclui a aptidão.** A coluna `aptidao` nascia
 *    `NOT NULL DEFAULT 'APTO'`, e o PDF imprimia "APTO" em corpo grande e verde —
 *    ou seja, um ASO que ninguém preencheu saía com a aparência de uma conclusão
 *    médica assinada. Agora, sem conclusão registrada, a folha sai com as caixas
 *    de marcação **em branco**, para o examinador preencher e assinar. O sistema
 *    guarda o que foi respondido e cala sobre o que não foi.
 *
 * 2. **Os perigos são marcados, não redigidos.** Antes era um campo de texto só.
 *    Toda ficha de ASO traz os agentes em lista por categoria, e texto livre não se
 *    conta nem se confere: "Ruído", "ruido excessivo" e "exposição a ruído" são o
 *    mesmo agente e três strings. A descrição em texto continua, como complemento.
 *
 * 3. **Ausência de risco é afirmação, não silêncio.** A NR-07 pede os perigos "ou a
 *    sua inexistência". Lista vazia é "ninguém preencheu"; para dizer que não há
 *    risco existe uma marcação própria.
 *
 * A identificação da organização vem congelada no próprio ASO
 * (`empresa_nome` / `empresa_cnpj`): ler de `empresas` na hora de imprimir
 * falsearia atestados antigos se a empresa mudasse de nome.
 */

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

function nomeColaborador(aso: SgsstAso): string {
  return (
    aso.colaborador?.profile?.nome ||
    aso.colaborador?.recurso?.nome ||
    aso.colaborador?.nome ||
    "Trabalhador não identificado"
  );
}

function faltando(rotulo: string): string {
  return `<span class="doc-falta">${esc(rotulo)}</span>`;
}

/** Uma caixa de marcação com o rótulo ao lado. */
function opcao(rotulo: string, marcada: boolean): string {
  // O quadrado sai VAZIO: o X é desenhado pelo CSS, em fundo, e não por um
  // caractere. Um "X" de texto aqui voltaria a ser posicionado pela métrica de
  // fonte do rasterizador — que é o que fazia o X sair do quadrado, ou não sair
  // de jeito nenhum. Ver a nota em `.doc-marca` nos estilos.
  return `<span class="doc-opcao${marcada ? " marcada" : ""}"><span class="doc-marca${
    marcada ? " marcada" : ""
  }"></span>${esc(rotulo)}</span>`;
}

/** Linha de categoria com as opções ao lado. */
function linhaDeOpcoes(categoria: string, opcoes: string): string {
  return `<tr><td class="cat">${esc(categoria)}</td><td>${opcoes}</td></tr>`;
}

/**
 * As seis ocasiões de exame da NR-07 7.5.4.
 *
 * O `tipo` do sistema tem sete valores, e dois deles — "Complementar" e "Outros" —
 * não correspondem a nenhuma ocasião da norma. Nesses casos NADA é marcado e o
 * valor gravado sai como texto ao lado: marcar uma caixa aproximada faria a folha
 * afirmar uma classificação normativa que o registro não tem.
 */
export const OCASIOES_EXAME_ASO: readonly { rotulo: string; tipos: readonly string[] }[] = [
  { rotulo: "Admissional", tipos: ["Admissional"] },
  { rotulo: "Periódico", tipos: ["Periódico"] },
  { rotulo: "Retorno ao trabalho", tipos: ["Retorno ao Trabalho"] },
  { rotulo: "Mudança de riscos ocupacionais", tipos: ["Mudança de Risco/Função"] },
  { rotulo: "Demissional", tipos: ["Demissional"] },
  { rotulo: "Monitoração pontual", tipos: [] },
];

/** Verdadeiro quando o tipo gravado não cai em nenhuma ocasião da norma. */
export function tipoForaDaNorma(tipo: string): boolean {
  return !OCASIOES_EXAME_ASO.some((o) => o.tipos.includes(tipo));
}

/**
 * As faixas de validade que a ficha traz como opção.
 *
 * A validade é uma data no banco, então a faixa é DEDUZIDA da diferença entre
 * emissão e validade. Faixa que não bate com nenhuma cai em "outro", com a data
 * impressa — em vez de arredondar para a caixa mais próxima.
 */
export function faixaDeValidade(
  dataEmissao?: string | null,
  validade?: string | null
): "SEIS_MESES" | "UM_ANO" | "DOIS_ANOS" | "OUTRO" {
  if (!dataEmissao || !validade) return "OUTRO";

  const emissao = new Date(`${dataEmissao.slice(0, 10)}T12:00:00`);
  const fim = new Date(`${validade.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(emissao.getTime()) || Number.isNaN(fim.getTime())) return "OUTRO";

  const meses =
    (fim.getFullYear() - emissao.getFullYear()) * 12 + (fim.getMonth() - emissao.getMonth());

  // Tolerância de um dia no dia do mês: 10/03 a 10/09 é seis meses ainda que a
  // contagem em dias não feche redonda.
  const mesmoDia = Math.abs(fim.getDate() - emissao.getDate()) <= 1;

  if (meses === 6 && mesmoDia) return "SEIS_MESES";
  if (meses === 12 && mesmoDia) return "UM_ANO";
  if (meses === 24 && mesmoDia) return "DOIS_ANOS";
  return "OUTRO";
}

/**
 * Campos obrigatórios ainda vazios, na linguagem da norma.
 *
 * A conclusão de aptidão entra como pendência quando não preenchida — mas isso não
 * impede a emissão: a folha em branco no campo da conclusão é exatamente o que vai
 * para a mão do médico.
 */
export function pendenciasAso(aso: SgsstAso): string[] {
  const p: string[] = [];

  if (conclusaoPendente(aso.aptidao)) {
    p.push("Conclusão de aptidão — a preencher e assinar pelo médico examinador");
  }

  const riscos = situacaoDosRiscos({
    codigos: aso.riscos_marcados,
    semRiscoEspecifico: aso.sem_risco_especifico,
  });

  if (riscos === "NAO_PREENCHIDO") {
    p.push("Perigos e fatores de risco (ou a afirmação de que não há) — NR-07 7.5.15.1 b");
  }
  if (riscos === "CONTRADITORIO") {
    p.push("Perigos marcados junto com a declaração de que não há risco específico");
  }

  if (!aso.medico_responsavel?.trim()) p.push("Médico examinador");
  if (!aso.crm_medico?.trim()) p.push("CRM do médico examinador");
  if (!aso.medico_coordenador?.trim()) p.push("Médico coordenador do PCMSO");
  if (!aso.crm_coordenador?.trim()) p.push("CRM do coordenador");
  if (!aso.colaborador?.cpf?.trim()) p.push("CPF do trabalhador");
  if (!aso.empresa_cnpj?.trim()) p.push("CNPJ da organização");

  const temExames = (aso.exames?.length ?? 0) > 0 || !!aso.exame_id;
  if (!temExames) p.push("Indicação e data dos exames realizados");
  if (!aso.data_exame_clinico) p.push("Data do exame clínico-ocupacional");

  if (aso.tipo === "Mudança de Risco/Função" && !aso.nova_funcao?.trim()) {
    p.push("Nova função — o ASO de mudança não diz para qual função ele está apto");
  }

  if (aso.aptidao === "APTO_COM_RESTRICAO" && !aso.descricao_restricao?.trim()) {
    p.push("Descrição da restrição (aptidão com restrição)");
  }

  return p;
}

/** Tabela dos exames, com a ordem referencial/sequencial e a data. */
function tabelaExames(aso: SgsstAso): string {
  const linhas = (aso.exames ?? [])
    .map((v) => v.exame)
    .filter((e): e is NonNullable<typeof e> => !!e);

  // Compatibilidade: ASOs antigos podem ter só o vínculo único.
  if (linhas.length === 0 && aso.exame) {
    linhas.push({
      id: aso.exame.id,
      nome_exame: aso.exame.nome_exame,
      tipo: aso.tipo,
      data_realizacao: aso.exame.data_realizacao,
      resultado: null,
      status: "REALIZADO",
    } as never);
  }

  if (linhas.length === 0) {
    return `<p class="doc-aviso">Nenhum exame vinculado. A indicação e a data dos
      exames realizados são obrigatórias no ASO — NR-07 7.5.15.1 alínea "c".</p>`;
  }

  return `
    <table class="doc-tabela">
      <thead>
        <tr>
          <th style="width:46%">Tipo de exame</th>
          <th style="width:22%">Ordem do exame</th>
          <th style="width:16%">Data</th>
          <th style="width:16%">Resultado</th>
        </tr>
      </thead>
      <tbody>
        ${linhas
          .map((e) => {
            // A ordem é REFERENCIAL (linha de base) ou SEQUENCIAL (acompanhamento
            // comparado contra ela). Não informada sai como falta, e não como
            // "sequencial" por suposição: um resultado alterado só é interpretável
            // contra a referência certa.
            const ordem = (e as { ordem_exame?: string | null }).ordem_exame;
            return `<tr>
              <td><strong>${esc(e.nome_exame)}</strong></td>
              <td>${
                ordem === "REFERENCIAL"
                  ? "Referencial"
                  : ordem === "SEQUENCIAL"
                    ? "Sequencial"
                    : faltando("não informada")
              }</td>
              <td>${e.data_realizacao ? dataBr(e.data_realizacao) : faltando("sem data")}</td>
              <td>${e.resultado ? esc(e.resultado) : "—"}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;
}

/** A grade de perigos por categoria, mais a afirmação de inexistência. */
function gradeDeRiscos(aso: SgsstAso): string {
  const marcados = new Set(aso.riscos_marcados ?? []);
  const situacao = situacaoDosRiscos({
    codigos: aso.riscos_marcados,
    semRiscoEspecifico: aso.sem_risco_especifico,
  });

  const linhas = CATEGORIAS_RISCO_ASO.map((categoria) =>
    linhaDeOpcoes(
      CATEGORIA_RISCO_ASO_LABEL[categoria],
      agentesDaCategoria(categoria)
        .map((a) => opcao(a.nome, marcados.has(a.codigo)))
        .join("")
    )
  ).join("");

  // Agente marcado que não está no catálogo: veio de algum lugar e não pode
  // desaparecer da folha só porque o catálogo mudou depois da emissão.
  const doCatalogo = new Set(AGENTES_RISCO_ASO.map((a) => a.codigo));
  const foraDoCatalogo = [...marcados].filter((c) => !doCatalogo.has(c));

  const avisos: string[] = [];
  if (situacao === "NAO_PREENCHIDO") {
    avisos.push(`<p class="doc-aviso">Nenhum perigo marcado e nenhuma afirmação de que
      não há risco específico. A NR-07 7.5.15.1 alínea "b" exige uma das duas — o campo
      em branco não equivale a "sem risco".</p>`);
  }
  if (situacao === "CONTRADITORIO") {
    avisos.push(`<p class="doc-aviso"><strong>Declaração contraditória.</strong> Há
      perigos marcados e, ao mesmo tempo, a afirmação de que a atividade não tem risco
      específico.</p>`);
  }

  return `
    <table class="doc-opcoes">${linhas}</table>

    <div style="margin-top:6px">
      ${opcao(
        "Não há risco específico para a atividade",
        situacao === "SEM_RISCO_DECLARADO" || situacao === "CONTRADITORIO"
      )}
    </div>

    ${
      foraDoCatalogo.length > 0
        ? `<p class="doc-neutro" style="margin-top:4px">Outros agentes registrados:
           ${esc(foraDoCatalogo.join(", "))}</p>`
        : ""
    }

    ${
      aso.descricao_riscos?.trim()
        ? `<p style="margin-top:6px"><strong>Complemento:</strong>
           ${esc(aso.descricao_riscos.trim())}</p>`
        : ""
    }

    ${avisos.join("")}`;
}

/** As três respostas possíveis de uma aptidão por atividade, em linha. */
function linhaAtividade(rotulo: string, resposta?: AptidaoAtividade | null): string {
  return `<tr>
    <td>${esc(rotulo)}</td>
    <td style="width:34%">
      ${opcao("Apto", resposta === "APTO")}
      ${opcao("Inapto", resposta === "INAPTO")}
      ${opcao("Não se aplica", resposta === "NAO_SE_APLICA")}
    </td>
  </tr>`;
}

export function montarHtmlAso(aso: SgsstAso, geradoPor?: string | null): string {
  const semConclusao = conclusaoPendente(aso.aptidao);
  const faixa = faixaDeValidade(aso.data_emissao, aso.validade);

  const respostasAtividade: Record<string, AptidaoAtividade | null | undefined> = {
    ALTURA: aso.apto_altura,
    ESPACO_CONFINADO: aso.apto_espaco_confinado,
    MAQUINAS: aso.apto_maquinas,
  };

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    <div class="doc">

      <div class="doc-cab">
        <h1>Ficha — Atestado de Saúde Ocupacional (ASO)</h1>
        <p class="doc-sub">
          Emitida conforme a NR-07${
            aso.numero_documento ? ` · Nº ${esc(aso.numero_documento)}` : " · sem numeração"
          }
        </p>
      </div>

      <div class="doc-ident">
        <table>
          <tr>
            <td class="rot">Unidade</td>
            <td>${esc(aso.unidade) || "—"}</td>
            <td class="rot">Data</td>
            <td>${dataBr(aso.data_emissao)}</td>
          </tr>
        </table>
      </div>

      <div class="doc-bloco">
        <div class="tit">Identificação da organização</div>
        <div class="corpo">
          <table class="doc-grid">
            <tr>
              <td class="rot">Razão social</td>
              <td><strong>${esc(aso.empresa_nome) || faltando("não registrada na emissão")}</strong></td>
              <td class="rot">CNPJ</td>
              <td>${esc(aso.empresa_cnpj) || faltando("não registrado")}</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Identificação do trabalhador</div>
        <div class="corpo">
          <table class="doc-grid">
            <tr>
              <td class="rot">Nome completo</td>
              <td colspan="3"><strong>${esc(nomeColaborador(aso))}</strong></td>
            </tr>
            <tr>
              <td class="rot">CPF</td>
              <td>${esc(aso.colaborador?.cpf) || faltando("não informado")}</td>
              <td class="rot">Identidade</td>
              <td>${esc(aso.colaborador?.rg) || faltando("não informada")}</td>
            </tr>
            <tr>
              <td class="rot">Função atual</td>
              <td>${esc(aso.colaborador?.funcao?.nome) || "—"}</td>
              <td class="rot">Nova função</td>
              <td>${
                aso.nova_funcao?.trim()
                  ? esc(aso.nova_funcao.trim())
                  : aso.tipo === "Mudança de Risco/Função"
                    ? faltando("não informada")
                    : "N/A"
              }</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Tipo de exame ocupacional</div>
        <div class="corpo">
          <div>
            ${OCASIOES_EXAME_ASO.map((o) => opcao(o.rotulo, o.tipos.includes(aso.tipo))).join("")}
          </div>
          ${
            tipoForaDaNorma(aso.tipo)
              ? `<p class="doc-neutro" style="margin-top:4px">Registrado no sistema como
                 <strong>${esc(aso.tipo)}</strong>, que não corresponde a nenhuma das
                 ocasiões da NR-07 7.5.4 — por isso nenhuma opção acima está marcada.</p>`
              : ""
          }
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">
          Perigos e fatores de risco identificados no inventário de riscos do PGR,
          ou a sua inexistência
        </div>
        <div class="corpo">${gradeDeRiscos(aso)}</div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Exames médicos realizados</div>
        <div class="corpo">
          ${tabelaExames(aso)}
          <table class="doc-grid">
            <tr>
              <td class="rot">Exame clínico-ocupacional realizado em</td>
              <td>${
                aso.data_exame_clinico
                  ? dataBr(aso.data_exame_clinico)
                  : faltando("data não registrada")
              }</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Atestado médico</div>
        <div class="corpo">
          <p class="doc-neutro">
            Atesto que o trabalhador acima identificado se submeteu aos exames médicos
            ocupacionais indicados nesta ficha, sendo considerado:
          </p>

          <table class="doc-opcoes">
            <tr>
              <td class="cat">Para a função</td>
              <td>
                ${opcao("Apto", aso.aptidao === "APTO")}
                ${opcao("Apto com restrição", aso.aptidao === "APTO_COM_RESTRICAO")}
                ${opcao("Inapto", aso.aptidao === "INAPTO")}
              </td>
            </tr>
          </table>

          ${
            semConclusao
              ? /* Sem conclusão registrada, a folha NÃO afirma nada. As caixas
                   acima saem em branco e esta linha diz por quê. Antes o sistema
                   imprimia "APTO" em corpo grande e verde por causa de um DEFAULT
                   no banco — uma conclusão médica que ninguém tinha feito. */
                `<p class="doc-aviso">Conclusão de aptidão não registrada no sistema.
                 As opções acima estão em branco para preenchimento e assinatura do
                 médico examinador. <strong>Esta folha não atesta aptidão enquanto o
                 campo não for preenchido.</strong></p>`
              : ""
          }

          <p class="doc-neutro" style="margin-top:8px">E também foi considerado:</p>
          <table class="doc-opcoes">
            ${ATIVIDADES_ESPECIFICAS.map((atividade) =>
              linhaAtividade(
                ATIVIDADE_ESPECIFICA_LABEL[atividade],
                respostasAtividade[atividade]
              )
            ).join("")}
          </table>
          <p class="doc-neutro">
            "Não se aplica" não é o mesmo que inapto: significa que a atividade não faz
            parte do trabalho. Campo em branco significa que a aptidão para aquela
            atividade não foi avaliada — e não autoriza a atividade.
          </p>
        </div>
      </div>

      ${
        aso.aptidao === "APTO_COM_RESTRICAO"
          ? `<div class="doc-bloco">
              <div class="tit">Restrição</div>
              <div class="corpo">
                ${
                  aso.descricao_restricao?.trim()
                    ? `<p>${esc(aso.descricao_restricao.trim())}</p>
                       <table class="doc-grid" style="margin-top:5px">
                         <tr>
                           <td class="rot">Início</td><td>${dataBr(aso.data_inicio_restricao)}</td>
                           <td class="rot">Término</td><td>${dataBr(aso.data_termino_restricao)}</td>
                         </tr>
                       </table>`
                    : `<p class="doc-aviso">Aptidão com restrição exige a descrição da
                       restrição — sem ela, quem escala o trabalhador não sabe o que
                       evitar.</p>`
                }
              </div>
            </div>`
          : ""
      }

      <div class="doc-bloco">
        <div class="tit">Validade deste ASO</div>
        <div class="corpo">
          <div>
            ${opcao("Seis meses", faixa === "SEIS_MESES")}
            ${opcao("Um ano", faixa === "UM_ANO")}
            ${opcao("Dois anos", faixa === "DOIS_ANOS")}
            ${opcao("Outro", faixa === "OUTRO")}
          </div>
          <table class="doc-grid" style="margin-top:5px">
            <tr>
              <td class="rot">Válido até</td>
              <td>${dataBr(aso.validade)}</td>
              <td class="rot">PCMSO</td>
              <td>${
                aso.pcmso ? esc(`${aso.pcmso.codigo ?? ""} ${aso.pcmso.titulo}`.trim()) : "—"
              }</td>
            </tr>
          </table>
        </div>
      </div>

      ${
        aso.observacoes?.trim()
          ? `<div class="doc-bloco"><div class="tit">Observações</div>
             <div class="corpo"><p>${esc(aso.observacoes.trim())}</p></div></div>`
          : ""
      }

      <div class="doc-assin">
        <div>
          <div class="nome">${esc(aso.medico_responsavel) || "&nbsp;"}</div>
          <div class="papel">
            Médico que realizou o exame clínico-ocupacional<br/>
            ${aso.crm_medico ? esc(aso.crm_medico) : faltando("CRM não informado")}<br/>
            Carimbo e assinatura · Data: ____/____/______
          </div>
        </div>
        <div>
          <div class="nome">${esc(aso.medico_coordenador) || "&nbsp;"}</div>
          <div class="papel">
            Médico responsável pelo PCMSO<br/>
            ${aso.crm_coordenador ? esc(aso.crm_coordenador) : faltando("CRM não informado")}<br/>
            Carimbo e assinatura
          </div>
        </div>
        <div>
          <div class="nome">&nbsp;</div>
          <div class="papel">
            Recebi a 2ª via deste ASO na presente data e fui informado, durante o exame
            clínico, das razões da realização dos exames complementares a que fui
            submetido e do significado dos seus resultados.<br/>
            ____/____/______ · Assinatura do trabalhador
          </div>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(new Date().toLocaleString("pt-BR"))}${
          geradoPor ? ` por ${esc(geradoPor)}` : ""
        } · Situação: ${esc(aso.status)}
      </div>
    </div>
  `;
}

export async function gerarPdfAso(aso: SgsstAso, geradoPor?: string | null): Promise<void> {
  const identificador = aso.numero_documento || nomeColaborador(aso);
  const nome = `ASO_${identificador.replace(/[^\w-]+/g, "_").slice(0, 40)}.pdf`;

  await emitirPdfTimbrado({
    html: montarHtmlAso(aso, geradoPor),
    nomeArquivo: nome,
    identificacao: `ASO ${identificador}`,
  });
}

/** Reexportado para a tela montar o mesmo resumo que a folha imprime. */
export { nomesDosRiscos };
