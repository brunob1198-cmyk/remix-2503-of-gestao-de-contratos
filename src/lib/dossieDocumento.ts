import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import {
  estilosDocumentoSgsst,
  escDoc as esc,
  dataBrDoc as dataBr,
} from "@/lib/sgsstDocumentoEstilos";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";
import { enderecoComComplemento } from "@/utils/cep";
import type {
  SgsstColaboradorDados,
  SgsstColaboradorTreinamento,
} from "@/hooks/sgsst/useSgsstColaboradores";
import type { SgsstAso } from "@/hooks/sgsst/useSgsstAsosAndExames";
import type { SgsstEpiEntrega } from "@/hooks/sgsst/useSgsstEpis";
import type { SgsstTreinamentoParticipante } from "@/hooks/sgsst/useSgsstTreinamentos";

/**
 * Emissão do Dossiê SST do colaborador.
 *
 * É o documento que reúne, numa folha, tudo o que o sistema sabe sobre a situação
 * de segurança de um trabalhador: cadastro, função, ASO, treinamentos, EPIs
 * recebidos e o que ainda falta em relação ao que a função dele exige.
 *
 * É o que se entrega quando o cliente audita uma frente de serviço e pede "me
 * mostre a documentação deste aqui". Antes disso, a resposta exigia abrir cinco
 * telas e montar a pasta à mão.
 *
 * Três decisões que definem o documento:
 *
 * 1. **A situação vem antes do histórico.** A primeira coisa impressa é se o
 *    trabalhador está apto a trabalhar hoje: ASO válido, treinamentos obrigatórios
 *    da função em dia. O histórico vem depois. Um dossiê que começa pela lista
 *    cronológica obriga quem confere a fazer a conta de cabeça.
 *
 * 2. **Ausência é declarada, não omitida.** Sem ASO, sem treinamento, sem função
 *    definida — cada uma dessas ausências aparece dita, com a consequência. Uma
 *    seção que simplesmente não aparece porque está vazia lê como "não se aplica".
 *
 * 3. **Os treinamentos aparecem nas duas origens que o sistema tem.** Há os
 *    lançados no dossiê com certificado anexado, e há a matrícula em turma. São
 *    tabelas diferentes, e um dossiê que mostrasse só uma delas pareceria
 *    incompleto para quem cadastrou pela outra.
 */

/** Pendência do trabalhador em relação ao que a função exige. */
export interface PendenciaDossie {
  tipo: "TREINAMENTO" | "EPI";
  itemNome: string;
  situacao: "NUNCA_FEITO" | "VENCIDO";
  vencimento?: string | null;
}

export interface DossieDados {
  colaborador: SgsstColaboradorDados;
  /** Treinamentos lançados no próprio dossiê, com certificado anexado. */
  treinamentosDoDossie: readonly SgsstColaboradorTreinamento[];
  /** Matrículas em turmas do módulo de Treinamentos. */
  matriculas: readonly SgsstTreinamentoParticipante[];
  asos: readonly SgsstAso[];
  entregasEpi: readonly SgsstEpiEntrega[];
  /** Do cruzamento com as exigências da função. */
  pendencias: readonly PendenciaDossie[];
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  geradoPor?: string | null;
}

const VINCULO_LABEL: Record<string, string> = {
  CLT: "CLT",
  PJ: "Pessoa jurídica",
  Terceirizado: "Terceirizado",
  Estagiario: "Estagiário",
  Outro: "Outro",
};

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  afastado: "Afastado",
  desligado: "Desligado",
};

function faltando(rotulo: string): string {
  return `<span class="doc-falta">${esc(rotulo)}</span>`;
}

/** Data local em "YYYY-MM-DD" — `toISOString()` desloca o fuso e erra o dia. */
function comoIso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export function nomeDoColaborador(c: SgsstColaboradorDados): string {
  return c.nome || c.profile?.nome || c.recurso?.nome || "(sem nome)";
}

/**
 * ASO que vale hoje: o de maior validade entre os não vencidos.
 *
 * Não é simplesmente o mais recente por data de emissão. Um exame de retorno ao
 * trabalho emitido depois de um periódico pode ter validade menor, e o que
 * responde "está apto?" é a validade, não a emissão.
 */
export function asoVigente(
  asos: readonly SgsstAso[],
  hoje: Date
): SgsstAso | null {
  const hojeIso = comoIso(hoje);

  const validos = asos
    .filter((a) => a.status !== "CANCELADO" && a.validade >= hojeIso)
    .sort((a, b) => b.validade.localeCompare(a.validade));

  return validos[0] ?? null;
}

export type SituacaoAptidao =
  | "APTO"
  | "APTO_COM_RESTRICAO"
  | "INAPTO"
  | "ASO_VENCIDO"
  /**
   * Existe ASO vigente, e o medico nao registrou a conclusao.
   *
   * Estado proprio porque nao e nenhum dos outros: nao e falta de ASO, nao e prazo
   * perdido e nao e conclusao medica. Antes caia no `return "APTO"` do fim da
   * funcao — o dossie afirmava aptidao a partir de um campo vazio.
   */
  | "ASO_SEM_CONCLUSAO"
  | "SEM_ASO";

/**
 * Situação ocupacional do trabalhador hoje.
 *
 * "Sem ASO" e "ASO vencido" são estados diferentes e devem ser ditos diferentes:
 * o primeiro é cadastro incompleto, o segundo é prazo perdido. Nenhum dos dois é
 * "inapto" — inapto é conclusão médica, e o sistema não pode emiti-la por conta.
 */
export function situacaoOcupacional(
  asos: readonly SgsstAso[],
  hoje: Date
): SituacaoAptidao {
  if (asos.filter((a) => a.status !== "CANCELADO").length === 0) return "SEM_ASO";

  const vigente = asoVigente(asos, hoje);
  if (!vigente) return "ASO_VENCIDO";

  if (vigente.aptidao === "INAPTO") return "INAPTO";
  if (vigente.aptidao === "APTO_COM_RESTRICAO") return "APTO_COM_RESTRICAO";
  if (vigente.aptidao === "APTO") return "APTO";

  // Sem conclusao registrada. O `return "APTO"` que estava aqui fazia o dossie
  // afirmar aptidao a partir de um campo vazio — e como a coluna nascia com
  // DEFAULT APTO, o vazio era o caso comum.
  return "ASO_SEM_CONCLUSAO";
}

export const SITUACAO_APTIDAO_LABEL: Record<SituacaoAptidao, string> = {
  APTO: "Apto para a função",
  APTO_COM_RESTRICAO: "Apto com restrições",
  INAPTO: "Inapto",
  ASO_VENCIDO: "ASO vencido",
  ASO_SEM_CONCLUSAO: "ASO sem conclusão médica",
  SEM_ASO: "Sem ASO registrado",
};

/** Classe de cor para a situação. Só APTO é positivo. */
function classeDaSituacao(situacao: SituacaoAptidao): string {
  if (situacao === "APTO") return "doc-apto";
  if (situacao === "APTO_COM_RESTRICAO") return "doc-restr";
  return "doc-inapto";
}

export function pendenciasDossie(dados: DossieDados, hoje = new Date()): string[] {
  const { colaborador, asos, pendencias, treinamentosDoDossie, matriculas } = dados;
  const p: string[] = [];

  const situacao = situacaoOcupacional(asos, hoje);
  if (situacao === "SEM_ASO") {
    p.push("Sem ASO registrado — a NR-07 exige exame admissional antes do início");
  } else if (situacao === "ASO_VENCIDO") {
    p.push("ASO vencido — o trabalhador não tem aptidão vigente");
  } else if (situacao === "INAPTO") {
    p.push("Último ASO conclui INAPTO");
  } else if (situacao === "ASO_SEM_CONCLUSAO") {
    // Vigente e sem conclusão não é aptidão: o médico ainda não assinou o campo.
    p.push("ASO vigente sem conclusão médica — a aptidão não foi atestada");
  }

  if (!colaborador.funcao_id) {
    p.push(
      "Sem função definida — sem função não há como saber que treinamento ou EPI é exigido dele"
    );
  }

  const treinamentoPendente = pendencias.filter((x) => x.tipo === "TREINAMENTO");
  if (treinamentoPendente.length > 0) {
    p.push(`${treinamentoPendente.length} treinamento(s) obrigatório(s) da função em falta`);
  }

  const epiPendente = pendencias.filter((x) => x.tipo === "EPI");
  if (epiPendente.length > 0) {
    p.push(`${epiPendente.length} EPI(s) obrigatório(s) da função em falta`);
  }

  if (treinamentosDoDossie.length === 0 && matriculas.length === 0) {
    p.push("Nenhum treinamento registrado, em nenhuma das duas origens");
  }

  if (!colaborador.cpf?.trim()) {
    p.push("CPF não informado — o dossiê não identifica o trabalhador com segurança");
  }

  if (!colaborador.data_admissao) {
    p.push("Data de admissão não registrada");
  }

  if (!dados.empresa?.nome?.trim()) {
    p.push("Identificação da organização ausente");
  }

  return p;
}

function secaoSituacao(dados: DossieDados, hoje: Date): string {
  const { asos, pendencias } = dados;
  const situacao = situacaoOcupacional(asos, hoje);
  const vigente = asoVigente(asos, hoje);

  const treinamentoPendente = pendencias.filter((p) => p.tipo === "TREINAMENTO").length;
  const epiPendente = pendencias.filter((p) => p.tipo === "EPI").length;

  return `
    <div class="doc-bloco">
      <div class="tit">Situação hoje</div>
      <div class="corpo">
        <div class="doc-cards">
          <div class="doc-card">
            <div class="rot">Saúde ocupacional</div>
            <div class="val ${classeDaSituacao(situacao)}">${esc(
              SITUACAO_APTIDAO_LABEL[situacao]
            )}</div>
            <div class="sub">${
              vigente ? `ASO válido até ${dataBr(vigente.validade)}` : "sem ASO vigente"
            }</div>
          </div>
          <div class="doc-card">
            <div class="rot">Treinamentos em falta</div>
            <div class="val ${treinamentoPendente > 0 ? "doc-inapto" : "doc-apto"}">${treinamentoPendente}</div>
            <div class="sub">exigidos pela função</div>
          </div>
          <div class="doc-card">
            <div class="rot">EPIs em falta</div>
            <div class="val ${epiPendente > 0 ? "doc-inapto" : "doc-apto"}">${epiPendente}</div>
            <div class="sub">exigidos pela função</div>
          </div>
        </div>

        ${
          pendencias.length === 0
            ? `<p class="doc-conclusao doc-apto">
                Nenhuma pendência em relação às exigências da função registrada.
               </p>`
            : `<table class="doc-tabela">
                <thead>
                  <tr><th>Tipo</th><th>Item exigido pela função</th><th>Situação</th><th>Venceu em</th></tr>
                </thead>
                <tbody>
                  ${pendencias
                    .map(
                      (p) => `<tr>
                        <td>${p.tipo === "TREINAMENTO" ? "Treinamento" : "EPI"}</td>
                        <td>${esc(p.itemNome)}</td>
                        <td><span class="doc-inapto">${
                          p.situacao === "NUNCA_FEITO" ? "Nunca realizado" : "Vencido"
                        }</span></td>
                        <td>${p.vencimento ? dataBr(p.vencimento) : "—"}</td>
                      </tr>`
                    )
                    .join("")}
                </tbody>
               </table>`
        }
      </div>
    </div>
  `;
}

export function montarHtmlDossie(dados: DossieDados, hoje = new Date()): string {
  const {
    colaborador: c,
    treinamentosDoDossie,
    matriculas,
    asos,
    entregasEpi,
    empresa,
    geradoPor,
  } = dados;

  const emitidoEm = new Date().toLocaleString("pt-BR");
  const hojeIso = comoIso(hoje);
  const endereco = enderecoComComplemento(c.endereco, c.endereco_complemento);

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    <div class="doc">

      <div class="doc-cab">
        <h1>Dossiê de Saúde e Segurança do Trabalhador</h1>
        <p class="doc-sub">
          ${esc(nomeDoColaborador(c))}${c.matricula ? ` · matrícula ${esc(c.matricula)}` : ""}
        </p>
      </div>

      ${
        c.status !== "ativo"
          ? `<div class="doc-aviso">
              <strong>Trabalhador com status ${esc(
                STATUS_LABEL[c.status] ?? c.status
              )}.</strong> As pendências abaixo referem-se ao último vínculo registrado.
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
        </table>
      </div>

      ${secaoSituacao(dados, hoje)}

      <div class="doc-bloco">
        <div class="tit">Identificação</div>
        <div class="corpo">
          <table class="doc-grid">
            <tr>
              <td class="rot">Nome</td>
              <td colspan="3"><strong>${esc(nomeDoColaborador(c))}</strong></td>
            </tr>
            <tr>
              <td class="rot">CPF</td>
              <td>${esc(c.cpf) || faltando("não informado")}</td>
              <td class="rot">RG</td>
              <td>${esc(c.rg) || "—"}</td>
            </tr>
            <tr>
              <td class="rot">Nascimento</td>
              <td>${c.data_nascimento ? dataBr(c.data_nascimento) : "—"}</td>
              <td class="rot">Telefone</td>
              <td>${esc(c.telefone) || "—"}</td>
            </tr>
            <tr>
              <td class="rot">Endereço</td>
              <td colspan="3">${esc(endereco) || faltando("não informado")}${
                c.cep ? ` · CEP ${esc(c.cep)}` : ""
              }</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Vínculo e função</div>
        <div class="corpo">
          <table class="doc-grid">
            <tr>
              <td class="rot">Função SST</td>
              <td>${
                c.funcao?.nome
                  ? `${esc(c.funcao.nome)}${c.funcao.cbo ? ` (CBO ${esc(c.funcao.cbo)})` : ""}`
                  : faltando("não definida")
              }</td>
              <td class="rot">Vínculo</td>
              <td>${esc(VINCULO_LABEL[c.tipo_vinculo] ?? c.tipo_vinculo)}</td>
            </tr>
            <tr>
              <td class="rot">Admissão</td>
              <td>${
                c.data_admissao ? dataBr(c.data_admissao) : faltando("não registrada")
              }</td>
              <td class="rot">Status</td>
              <td><strong>${esc(STATUS_LABEL[c.status] ?? c.status)}</strong></td>
            </tr>
            <tr>
              <td class="rot">Obra</td>
              <td>${
                c.projeto ? `[${esc(c.projeto.codigo)}] ${esc(c.projeto.nome)}` : "—"
              }</td>
              <td class="rot">Setor</td>
              <td>${esc(c.area?.nome) || "—"}</td>
            </tr>
            ${
              c.data_demissao
                ? `<tr>
                    <td class="rot">Desligamento</td>
                    <td colspan="3">${dataBr(c.data_demissao)}</td>
                   </tr>`
                : ""
            }
          </table>
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Exames ocupacionais (ASO) — NR-07</div>
        <div class="corpo">
          ${
            asos.length === 0
              ? `<p class="doc-aviso">Nenhum ASO registrado. A NR-07 exige exame
                  admissional antes do início das atividades.</p>`
              : `<table class="doc-tabela">
                  <thead>
                    <tr><th>Emissão</th><th>Tipo</th><th>Aptidão</th><th>Validade</th><th>Médico examinador</th></tr>
                  </thead>
                  <tbody>
                    ${[...asos]
                      .sort((a, b) => b.data_emissao.localeCompare(a.data_emissao))
                      .map((a) => {
                        const vencido = a.validade < hojeIso;
                        return `<tr>
                          <td>${dataBr(a.data_emissao)}</td>
                          <td>${esc(a.tipo)}</td>
                          <td>${
                            // Sem conclusão a célula diz isso, e não fica vazia:
                            // célula vazia numa coluna chamada "aptidão" é lida
                            // como falha de impressão.
                            !a.aptidao
                              ? `<span class="doc-falta">sem conclusão</span>`
                              : a.aptidao === "INAPTO"
                                ? `<span class="doc-inapto">${esc(a.aptidao)}</span>`
                                : esc(a.aptidao)
                          }</td>
                          <td>${
                            vencido
                              ? `<span class="doc-inapto">${dataBr(a.validade)} (vencido)</span>`
                              : dataBr(a.validade)
                          }</td>
                          <td>${esc(a.medico_responsavel) || "—"}${
                            a.crm_medico ? ` · CRM ${esc(a.crm_medico)}` : ""
                          }</td>
                        </tr>`;
                      })
                      .join("")}
                  </tbody>
                 </table>`
          }
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Treinamentos e capacitações — NR-01 item 1.7</div>
        <div class="corpo">
          ${
            treinamentosDoDossie.length === 0 && matriculas.length === 0
              ? `<p class="doc-aviso">Nenhum treinamento registrado, em nenhuma das duas
                  origens do sistema (dossiê e turmas).</p>`
              : ""
          }

          ${
            matriculas.length > 0
              ? `<p class="doc-neutro">Matrículas em turmas do módulo de Treinamentos:</p>
                 <table class="doc-tabela">
                  <thead>
                    <tr><th>Treinamento</th><th>Turma</th><th>Resultado</th><th>Conclusão</th><th>Validade</th><th>Certificado</th></tr>
                  </thead>
                  <tbody>
                    ${[...matriculas]
                      .sort((a, b) =>
                        (b.data_conclusao ?? "").localeCompare(a.data_conclusao ?? "")
                      )
                      .map((m) => {
                        const vencido = !!m.validade && m.validade < hojeIso;
                        return `<tr>
                          <td>${esc(m.turma?.treinamento?.nome) || "—"}</td>
                          <td>${esc(m.turma?.codigo_turma) || "—"}</td>
                          <td>${
                            m.resultado === "APROVADO"
                              ? esc(m.resultado)
                              : `<span class="doc-inapto">${esc(m.resultado)}</span>`
                          }</td>
                          <td>${m.data_conclusao ? dataBr(m.data_conclusao) : "—"}</td>
                          <td>${
                            m.validade
                              ? vencido
                                ? `<span class="doc-inapto">${dataBr(m.validade)} (vencido)</span>`
                                : dataBr(m.validade)
                              : "não expira"
                          }</td>
                          <td>${esc(m.certificado) || faltando("sem numeração")}</td>
                        </tr>`;
                      })
                      .join("")}
                  </tbody>
                 </table>`
              : ""
          }

          ${
            treinamentosDoDossie.length > 0
              ? `<p class="doc-neutro">Lançados no dossiê, com certificado anexado:</p>
                 <table class="doc-tabela">
                  <thead>
                    <tr><th>Treinamento</th><th>Carga horária</th><th>Conclusão</th><th>Validade</th><th>Certificado anexado</th></tr>
                  </thead>
                  <tbody>
                    ${[...treinamentosDoDossie]
                      .sort((a, b) =>
                        (b.data_conclusao ?? "").localeCompare(a.data_conclusao ?? "")
                      )
                      .map((t) => {
                        const vencido = !!t.data_validade && t.data_validade < hojeIso;
                        return `<tr>
                          <td>${esc(t.nome_treinamento)}</td>
                          <td>${t.carga_horaria ? `${esc(t.carga_horaria)} h` : "—"}</td>
                          <td>${t.data_conclusao ? dataBr(t.data_conclusao) : "—"}</td>
                          <td>${
                            t.data_validade
                              ? vencido
                                ? `<span class="doc-inapto">${dataBr(t.data_validade)} (vencido)</span>`
                                : dataBr(t.data_validade)
                              : "não expira"
                          }</td>
                          <td>${
                            t.certificado_url || t.certificado_r2_key
                              ? "Sim"
                              : faltando("não anexado")
                          }</td>
                        </tr>`;
                      })
                      .join("")}
                  </tbody>
                 </table>`
              : ""
          }
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">EPIs recebidos — NR-06</div>
        <div class="corpo">
          ${
            entregasEpi.length === 0
              ? `<p class="doc-aviso">Nenhuma entrega de EPI registrada. A NR-06 6.6.1
                  obriga o registro do fornecimento.</p>`
              : `<table class="doc-tabela">
                  <thead>
                    <tr><th>Data</th><th>EPI</th><th>CA</th><th>Qtd.</th><th>Motivo</th></tr>
                  </thead>
                  <tbody>
                    ${[...entregasEpi]
                      .sort((a, b) => b.data_entrega.localeCompare(a.data_entrega))
                      .map(
                        (e) => `<tr>
                          <td>${dataBr(e.data_entrega)}</td>
                          <td>${esc(e.epi?.nome) || "—"}</td>
                          <td>${esc(e.epi?.ca) || faltando("sem CA")}</td>
                          <td class="doc-num">${esc(e.quantidade)}</td>
                          <td>${esc(e.motivo)}</td>
                        </tr>`
                      )
                      .join("")}
                  </tbody>
                 </table>
                 <p class="doc-neutro">
                   A ficha de entrega assinada, com uma assinatura por fornecimento,
                   é emitida na tela de EPI. Este dossiê traz o histórico consolidado.
                 </p>`
          }
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Grade de EPI e habilitação</div>
        <div class="corpo">
          <table class="doc-grid">
            <tr>
              <td class="rot">Calçado</td><td>${esc(c.tamanho_calcado) || "—"}</td>
              <td class="rot">Camisa</td><td>${esc(c.tamanho_camisa) || "—"}</td>
            </tr>
            <tr>
              <td class="rot">Calça</td><td>${esc(c.tamanho_calca) || "—"}</td>
              <td class="rot">CNH</td>
              <td>${
                c.cnh_numero
                  ? `${esc(c.cnh_numero)}${
                      c.cnh_categoria ? ` cat. ${esc(c.cnh_categoria)}` : ""
                    }${
                      c.cnh_validade
                        ? c.cnh_validade < hojeIso
                          ? ` · <span class="doc-inapto">vencida em ${dataBr(
                              c.cnh_validade
                            )}</span>`
                          : ` · válida até ${dataBr(c.cnh_validade)}`
                        : ""
                    }`
                  : "—"
              }</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="doc-assin">
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(nomeDoColaborador(c))}</div>
          <hr>
          <p>Assinatura do trabalhador</p>
          <p>${esc(c.cpf) || "&nbsp;"}</p>
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
        Dossiê de saúde e segurança — situação apurada na data da emissão
      </div>
    </div>
  `;
}

function nomeArquivo(dados: DossieDados): string {
  const base = nomeDoColaborador(dados.colaborador);
  return `Dossie_SST_${base.replace(/[^\w-]+/g, "_").slice(0, 48)}.pdf`;
}

export async function gerarPdfDossie(dados: DossieDados): Promise<void> {
  await emitirPdfTimbrado({
    html: montarHtmlDossie(dados),
    nomeArquivo: nomeArquivo(dados),
    identificacao: `Dossiê SST — ${nomeDoColaborador(dados.colaborador)}`.slice(0, 88),
  });
}
