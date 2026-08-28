import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";
import {
  estilosDocumentoSgsst,
  escDoc as esc,
  dataBrDoc as dataBr,
} from "@/lib/sgsstDocumentoEstilos";
import {
  ocasioesDoGrupo,
  pendenciasDaGuia,
  type GrupoDaGuia,
} from "@/utils/sgsstGuiaExame";

/**
 * Guia de encaminhamento para exame ocupacional.
 *
 * É o documento que o empregador entrega ao trabalhador para ele ir ao médico. Não
 * é o ASO: o ASO é a resposta, este é o pedido.
 *
 * DUAS COISAS QUE ESTE DOCUMENTO NUNCA TRAZ
 *
 * 1. Resultado ou achado clínico. Não existe ainda.
 * 2. Conclusão de aptidão, nem em branco. Campo de aptidão em papel emitido pelo
 *    empregador é justamente o que não pode existir — a aptidão é declaração do
 *    médico examinador, no ASO dele.
 *
 * O QUE ELE TRAZ, E POR QUÊ
 *
 * Os RISCOS a que o trabalhador está exposto. A NR-07 planeja o exame a partir do
 * risco (7.4.2, e o PCMSO se apoia no inventário da NR-01): sem essa lista o
 * médico examinador teria de adivinhar o escopo, ou pedir exame que não se aplica.
 * É a informação que transforma a guia de um bilhete em um encaminhamento.
 */

export interface GuiaExameDados {
  grupo: GrupoDaGuia;
  trabalhador: {
    nome: string;
    cpf?: string | null;
    rg?: string | null;
    matricula?: string | null;
    dataAdmissao?: string | null;
    funcaoNome?: string | null;
    setor?: string | null;
  };
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  /**
   * Riscos da função, como o médico precisa ler.
   *
   * `null` significa "não foi consultado" e o documento diz isso. Imprimir lista
   * vazia afirmaria que a função não tem risco — e mandaria o médico examinar sem
   * saber a que o trabalhador se expõe.
   */
  riscos:
    | {
        categoria: string;
        agente: string;
        exposicao?: string | null;
        tempoExposicao?: string | null;
      }[]
    | null;
  clinica?: {
    nome: string;
    cnpj?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    uf?: string | null;
    telefone?: string | null;
    responsavelTecnico?: string | null;
  } | null;
  pcmso?: {
    codigo?: string | null;
    titulo?: string | null;
    medicoResponsavel?: string | null;
    crmMedico?: string | null;
  } | null;
  responsavelSst?: string | null;
  geradoPor?: string | null;
}

function linha(rotulo: string, valor: unknown, faltaTexto = "não informado"): string {
  const v = valor === null || valor === undefined ? "" : String(valor).trim();
  const conteudo = v ? esc(v) : `<span class="doc-falta">${faltaTexto}</span>`;
  return `<tr><td class="rot">${esc(rotulo)}</td><td>${conteudo}</td></tr>`;
}

function secaoRiscos(riscos: GuiaExameDados["riscos"]): string {
  if (riscos === null) {
    return `<p class="doc-falta">Riscos da função não consultados nesta emissão.</p>`;
  }

  if (riscos.length === 0) {
    return `
      <p class="doc-aviso">
        ⚠ Nenhum risco ocupacional está vinculado à função deste trabalhador no
        cadastro. O escopo do exame precisa ser definido pelo médico examinador com
        base em avaliação própria do posto de trabalho.
      </p>
    `;
  }

  return `
    <p>
      Riscos ocupacionais a que o trabalhador está exposto na função, conforme o
      inventário da organização. Servem de base para o médico examinador definir o
      escopo do exame (NR-07 item 7.4.2).
    </p>
    <table class="doc-tabela">
      <thead>
        <tr>
          <th style="width:18%">Categoria</th>
          <th>Agente / fator de risco</th>
          <th style="width:20%">Exposição</th>
        </tr>
      </thead>
      <tbody>
        ${riscos
          .map(
            (r) => `
              <tr>
                <td><strong>${esc(r.categoria)}</strong></td>
                <td>${esc(r.agente) || "—"}</td>
                <td>${
                  [r.exposicao, r.tempoExposicao].filter(Boolean).map(esc).join(" · ") ||
                  `<span class="doc-falta">não caracterizada</span>`
                }</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function montarHtmlGuiaExame(dados: GuiaExameDados): string {
  const { grupo, trabalhador, empresa, clinica, pcmso } = dados;
  const emitidoEm = new Date().toLocaleString("pt-BR");
  const ocasioes = ocasioesDoGrupo(grupo);

  const agendamento = grupo.exames.find((e) => e.data_agendada);

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    <div class="doc">

      <div class="doc-cab doc-centro">
        <h1>Guia de Encaminhamento para Exame Ocupacional</h1>
        <p class="doc-sub">
          Solicitação de exame médico ocupacional · NR-07 ·
          ${ocasioes.length === 1 ? esc(ocasioes[0]) : "múltiplas ocasiões"}
        </p>
      </div>

      <p class="doc-aviso">
        Este documento é uma <strong>solicitação de exame</strong> e não atesta
        aptidão. O Atestado de Saúde Ocupacional (ASO) é emitido pelo médico
        examinador após a realização do exame.
      </p>

      <h2 class="doc-sec">1. Empregador</h2>
      <div class="doc-bloco"><table class="doc-grid">
        ${linha("Organização", empresa?.nome)}
        ${linha("CNPJ", empresa?.cnpj)}
        ${linha("Programa", pcmso?.codigo ? `${pcmso.codigo} — ${pcmso.titulo ?? ""}` : pcmso?.titulo)}
      </table></div>

      <h2 class="doc-sec">2. Trabalhador</h2>
      <div class="doc-bloco"><table class="doc-grid">
        ${linha("Nome", trabalhador.nome)}
        ${linha("CPF", trabalhador.cpf)}
        ${linha("Identidade (RG)", trabalhador.rg)}
        ${linha("Matrícula", trabalhador.matricula)}
        ${linha("Função", trabalhador.funcaoNome, "função não cadastrada")}
        ${linha("Setor", trabalhador.setor)}
        ${
          trabalhador.dataAdmissao
            ? `<tr><td class="rot">Admissão</td><td>${dataBr(trabalhador.dataAdmissao)}</td></tr>`
            : ""
        }
      </table></div>

      <h2 class="doc-sec">3. Exames solicitados</h2>
      ${
        ocasioes.length > 1
          ? `<p class="doc-aviso">⚠ Esta guia reúne exames de mais de uma ocasião.</p>`
          : ""
      }
      <table class="doc-tabela">
        <thead>
          <tr>
            <th style="width:6%">#</th>
            <th>Exame</th>
            <th style="width:22%">Ocasião</th>
            <th style="width:18%">Natureza</th>
            <th style="width:16%">Solicitado em</th>
          </tr>
        </thead>
        <tbody>
          ${grupo.exames
            .map(
              (e, i) => `
                <tr>
                  <td class="doc-num">${i + 1}</td>
                  <td><strong>${esc(e.nome_exame)}</strong>${
                    e.observacoes ? `<br><small>${esc(e.observacoes)}</small>` : ""
                  }</td>
                  <td>${esc(e.tipo)}</td>
                  <td>${e.natureza === "CLINICO" ? "Clínico" : "Complementar"}</td>
                  <td>${e.data_solicitacao ? dataBr(e.data_solicitacao) : "—"}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>

      <h2 class="doc-sec">4. Riscos ocupacionais da função</h2>
      ${secaoRiscos(dados.riscos)}

      <h2 class="doc-sec">5. Local de realização</h2>
      ${
        clinica
          ? `<div class="doc-bloco"><table class="doc-grid">
              ${linha("Clínica", clinica.nome)}
              ${linha("CNPJ", clinica.cnpj)}
              ${linha("Endereço", [clinica.endereco, clinica.cidade, clinica.uf].filter(Boolean).join(" — "))}
              ${linha("Telefone", clinica.telefone)}
              ${linha("Responsável técnico", clinica.responsavelTecnico)}
              ${
                agendamento?.data_agendada
                  ? `<tr><td class="rot">Agendamento</td><td>${dataBr(
                      agendamento.data_agendada
                    )}${agendamento.hora_agendada ? ` às ${esc(agendamento.hora_agendada)}` : ""}</td></tr>`
                  : `<tr><td class="rot">Agendamento</td><td><span class="doc-falta">sem data marcada</span></td></tr>`
              }
            </table></div>`
          : `<p class="doc-aviso">⚠ Clínica de destino não definida. Confirme com a empresa onde o exame deve ser realizado.</p>`
      }

      <h2 class="doc-sec">6. Solicitante</h2>
      <div class="doc-bloco"><table class="doc-grid">
        ${linha("Médico coordenador do PCMSO", pcmso?.medicoResponsavel)}
        ${linha("CRM", pcmso?.crmMedico)}
        ${linha("Responsável pela SST", dados.responsavelSst)}
      </table></div>

      <div class="doc-assin">
        <div>
          <div class="nome">${esc(pcmso?.medicoResponsavel) || "________________________"}</div>
          <div class="papel">Médico coordenador do PCMSO${
            pcmso?.crmMedico ? ` · ${esc(pcmso.crmMedico)}` : ""
          }</div>
        </div>
        <div>
          <div class="nome">${esc(trabalhador.nome)}</div>
          <div class="papel">Ciência do trabalhador</div>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${dados.geradoPor ? ` por ${esc(dados.geradoPor)}` : ""} ·
        ${grupo.exames.length} exame(s) solicitado(s) ·
        Documento gerado pelo sistema de Gestão de Contratos.
      </div>
    </div>
  `;
}

/** Pendências mostradas antes de emitir, no mesmo padrão dos outros documentos. */
export function pendenciasGuiaExame(dados: GuiaExameDados): string[] {
  return pendenciasDaGuia({
    grupo: dados.grupo,
    riscosDaFuncao: dados.riscos,
    temFuncao: !!dados.trabalhador.funcaoNome?.trim(),
    temClinica: !!dados.clinica,
    temMedicoCoordenador: !!dados.pcmso?.medicoResponsavel?.trim(),
  });
}

export async function gerarPdfGuiaExame(dados: GuiaExameDados): Promise<void> {
  const nome = `Guia_Exame_${(dados.trabalhador.nome || "trabalhador")
    .replace(/[^\w-]+/g, "_")
    .slice(0, 40)}.pdf`;

  await emitirPdfTimbrado({
    html: montarHtmlGuiaExame(dados),
    nomeArquivo: nome,
    identificacao: `Guia de exame — ${dados.trabalhador.nome}`,
  });
}
