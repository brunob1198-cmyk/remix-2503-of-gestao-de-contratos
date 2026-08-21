import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import {
  estilosDocumentoSgsst,
  escDoc as esc,
  dataBrDoc as dataBr,
} from "@/lib/sgsstDocumentoEstilos";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";
import {
  TIPO_TREINAMENTO_LABEL,
  type SgsstTreinamentoTurma,
  type SgsstTreinamentoParticipante,
} from "@/hooks/sgsst/useSgsstTreinamentos";

/**
 * Emissão do certificado de treinamento — NR-01 item 1.7.
 *
 * Era o único documento obrigatório do SGSST sem emissão: o módulo controlava a
 * validade de um certificado que não produzia. E é o mais pedido no dia a dia,
 * porque cada trabalhador leva o seu.
 *
 * A norma lista seis itens obrigatórios, e o documento traz os seis:
 * nome e assinatura do trabalhador, conteúdo programático, carga horária, data e
 * local, nome e qualificação do instrutor, e assinatura do responsável técnico.
 *
 * Campo que falta sai MARCADO, não omitido. Certificado com lacuna invisível é
 * pior que certificado com lacuna visível: o primeiro passa na conferência e cai
 * na fiscalização.
 */

export interface CertificadoDados {
  participante: SgsstTreinamentoParticipante;
  turma: SgsstTreinamentoTurma;
  /** Nome do trabalhador, já resolvido pela tela. */
  nomeTrabalhador: string;
  cpfTrabalhador?: string | null;
  funcaoTrabalhador?: string | null;
  geradoPor?: string | null;
}

function faltando(rotulo: string): string {
  return `<span class="doc-falta">${esc(rotulo)}</span>`;
}

/** Carga horária efetiva: a da turma manda, com o curso como reserva. */
export function cargaHoraria(dados: CertificadoDados): number | null {
  return dados.turma.carga_horaria ?? dados.turma.treinamento?.carga_horaria ?? null;
}

/**
 * Pendências do certificado, na ordem dos itens da NR-01 1.7.
 *
 * A aprovação é a primeira checagem e a mais séria: certificado de quem não foi
 * aprovado não é certificado — é declaração de participação.
 */
export function pendenciasCertificado(dados: CertificadoDados): string[] {
  const { participante, turma } = dados;
  const treinamento = turma.treinamento;
  const p: string[] = [];

  if (!participante.aprovacao || participante.resultado !== "APROVADO") {
    p.push("Participante não está aprovado — certificado exige aprovação");
  }

  if (!treinamento?.conteudo_programatico?.trim()) {
    p.push("Conteúdo programático do curso não preenchido");
  }
  if (!cargaHoraria(dados)) p.push("Carga horária não informada");
  if (!turma.local?.trim()) p.push("Local do treinamento não informado");
  if (!turma.instrutor?.trim()) p.push("Instrutor não informado");
  if (!turma.instrutor_qualificacao?.trim()) {
    p.push("Qualificação do instrutor não informada");
  }
  if (!turma.responsavel_tecnico?.trim()) {
    p.push("Responsável técnico pelo treinamento não informado");
  }
  if (!participante.data_conclusao) p.push("Data de conclusão não registrada");
  if (!participante.certificado?.trim()) p.push("Certificado sem numeração");
  if (!turma.empresa_nome?.trim()) p.push("Identificação da organização ausente na turma");

  return p;
}

export function montarHtmlCertificado(dados: CertificadoDados): string {
  const { participante, turma, nomeTrabalhador, cpfTrabalhador, funcaoTrabalhador, geradoPor } =
    dados;
  const treinamento = turma.treinamento;
  const emitidoEm = new Date().toLocaleString("pt-BR");
  const carga = cargaHoraria(dados);

  const tipo = turma.tipo_treinamento
    ? TIPO_TREINAMENTO_LABEL[turma.tipo_treinamento]
    : "Inicial";

  // Período: turma de um dia não deve imprimir "01/03/2026 a 01/03/2026".
  const periodo =
    turma.data_final && turma.data_final !== turma.data_inicial
      ? `${dataBr(turma.data_inicial)} a ${dataBr(turma.data_final)}`
      : dataBr(turma.data_inicial);

  const reprovado = !participante.aprovacao || participante.resultado !== "APROVADO";

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    <div class="doc">

      <div class="doc-cab">
        <h1>Certificado de Treinamento</h1>
        <p class="doc-sub">
          ${esc(tipo)} · NR-01 item 1.7
          ${
            participante.certificado
              ? ` · Nº ${esc(participante.certificado)}`
              : " · sem numeração"
          }
        </p>
      </div>

      ${
        reprovado
          ? `<div class="doc-aviso">
              <strong>Este participante não está aprovado.</strong> O resultado registrado é
              "${esc(participante.resultado)}". Certificado pressupõe aprovação — o que esta
              folha comprova é a participação, não a capacitação.
             </div>`
          : ""
      }

      <div class="doc-ident">
        <table>
          <tr>
            <td class="rot">Organização</td>
            <td><strong>${esc(turma.empresa_nome) || faltando("não informada")}</strong></td>
            <td class="rot">CNPJ</td>
            <td>${esc(turma.empresa_cnpj) || faltando("não informado")}</td>
          </tr>
        </table>
      </div>

      <div class="doc-bloco">
        <div class="tit">Certificamos que</div>
        <div class="corpo">
          <table class="doc-grid">
            <tr>
              <td class="rot">Nome</td>
              <td colspan="3"><strong>${esc(nomeTrabalhador)}</strong></td>
            </tr>
            <tr>
              <td class="rot">CPF</td>
              <td>${esc(cpfTrabalhador) || faltando("não informado")}</td>
              <td class="rot">Função</td>
              <td>${esc(funcaoTrabalhador) || "—"}</td>
            </tr>
          </table>
          <p style="margin-top:6px">
            concluiu o treinamento abaixo, atendendo aos requisitos de frequência e
            aproveitamento.
          </p>
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Treinamento realizado</div>
        <div class="corpo">
          <table class="doc-grid">
            <tr>
              <td class="rot">Curso</td>
              <td colspan="3"><strong>${esc(treinamento?.nome) || faltando("não identificado")}</strong></td>
            </tr>
            <tr>
              <td class="rot">Tipo</td><td>${esc(tipo)}</td>
              <td class="rot">Carga horária</td>
              <td>${carga ? `${esc(carga)} horas` : faltando("não informada")}</td>
            </tr>
            <tr>
              <td class="rot">Período</td><td>${periodo}</td>
              <td class="rot">Modalidade</td><td>${esc(turma.modalidade)}</td>
            </tr>
            <tr>
              <td class="rot">Local</td>
              <td>${esc(turma.local) || faltando("não informado")}</td>
              <td class="rot">Turma</td>
              <td>${esc(turma.codigo_turma) || "—"}</td>
            </tr>
            <tr>
              <td class="rot">Conclusão</td>
              <td>${
                participante.data_conclusao
                  ? dataBr(participante.data_conclusao)
                  : faltando("não registrada")
              }</td>
              <td class="rot">Validade</td>
              <td>${
                participante.validade
                  ? dataBr(participante.validade)
                  : "não expira"
              }</td>
            </tr>
            ${
              treinamento?.base_legal
                ? `<tr>
                    <td class="rot">Base legal</td>
                    <td colspan="3">${esc(treinamento.base_legal)}</td>
                   </tr>`
                : ""
            }
          </table>
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Conteúdo programático</div>
        <div class="corpo">
          ${
            treinamento?.conteudo_programatico?.trim()
              ? treinamento.conteudo_programatico
                  .split(/\r?\n/)
                  .filter((l) => l.trim())
                  .map((l) => `<p>${esc(l.trim())}</p>`)
                  .join("")
              : `<p class="doc-aviso">Conteúdo programático não preenchido. É item
                 obrigatório do certificado pela NR-01 1.7 — sem ele o documento não
                 comprova o que foi ensinado.</p>`
          }
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Instrutor e responsável técnico</div>
        <div class="corpo">
          <table class="doc-grid">
            <tr>
              <td class="rot">Instrutor</td>
              <td>${esc(turma.instrutor) || faltando("não informado")}</td>
              <td class="rot">Qualificação</td>
              <td>${esc(turma.instrutor_qualificacao) || faltando("não informada")}</td>
            </tr>
            <tr>
              <td class="rot">Responsável técnico</td>
              <td>${esc(turma.responsavel_tecnico) || faltando("não informado")}</td>
              <td class="rot">Registro</td>
              <td>${esc(turma.registro_responsavel) || "—"}</td>
            </tr>
          </table>
        </div>
      </div>

      ${
        participante.percentual_presenca !== null &&
        participante.percentual_presenca !== undefined
          ? `<p style="font-size:9px;color:#5a6b7d;margin-top:4px">
              Frequência registrada: ${esc(participante.percentual_presenca)}% ·
              Resultado: ${esc(participante.resultado)}
             </p>`
          : ""
      }

      <div class="doc-assin">
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(nomeTrabalhador)}</div>
          <hr>
          <p>Assinatura do trabalhador</p>
          <p>${esc(cpfTrabalhador) || "&nbsp;"}</p>
        </div>
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(turma.responsavel_tecnico) || "&nbsp;"}</div>
          <hr>
          <p>Responsável técnico pelo treinamento</p>
          <p>${esc(turma.registro_responsavel) || "&nbsp;"}</p>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${geradoPor ? ` por ${esc(geradoPor)}` : ""} ·
        Certificado emitido conforme a NR-01 item 1.7
      </div>
    </div>
  `;
}

/** Nome de arquivo estável e legível. */
function nomeArquivo(dados: CertificadoDados): string {
  const base =
    dados.participante.certificado ||
    `${dados.nomeTrabalhador}_${dados.turma.treinamento?.nome ?? "treinamento"}`;

  return `Certificado_${base.replace(/[^\w-]+/g, "_").slice(0, 48)}.pdf`;
}

export async function gerarPdfCertificado(dados: CertificadoDados): Promise<void> {
  await emitirPdfTimbrado({
    html: montarHtmlCertificado(dados),
    nomeArquivo: nomeArquivo(dados),
    identificacao: `Certificado ${dados.nomeTrabalhador} — ${
      dados.turma.treinamento?.nome ?? ""
    }`.slice(0, 88),
  });
}

/**
 * Emite os certificados de vários participantes num único PDF.
 *
 * Cada certificado começa em página nova: quem imprime uma turma de trinta
 * pessoas precisa de trinta folhas destacáveis, não de um documento corrido.
 */
export async function gerarPdfCertificadosEmLote(
  lista: readonly CertificadoDados[],
  identificacaoLote: string
): Promise<void> {
  if (lista.length === 0) return;

  // `doc-quebra` força a quebra antes de cada certificado a partir do segundo.
  const html = lista
    .map((dados, indice) => {
      const corpo = montarHtmlCertificado(dados);
      if (indice === 0) return corpo;
      // Só o primeiro leva os estilos; repeti-los em cada folha inflaria o HTML
      // sem efeito nenhum.
      const semEstilos = corpo.slice(corpo.indexOf('<div class="doc">'));
      return `<div style="page-break-before:always"></div>${semEstilos}`;
    })
    .join("");

  await emitirPdfTimbrado({
    html,
    nomeArquivo: `Certificados_${identificacaoLote.replace(/[^\w-]+/g, "_").slice(0, 40)}.pdf`,
    identificacao: `Certificados — ${identificacaoLote}`.slice(0, 88),
  });
}
