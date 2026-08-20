import { pdfGlobalStyles, getPdfOptions } from "@/lib/pdfTemplates";
import { estilosDocumentoSgsst } from "@/lib/sgsstDocumentoEstilos";
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



export function montarHtmlPcmso(dados: PcmsoDocumentoDados): string {
  const { pcmso, exames, empresa, geradoPor } = dados;
  const emitidoEm = new Date().toLocaleString("pt-BR");
  const empresaNome = empresa?.nome || "—";

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

      <h2 class="doc-sec">2. Agravos à saúde relacionados aos riscos ocupacionais</h2>
      ${bloco(
        pcmso.agravos_saude,
        "Obrigatório pela NR-07 item 7.5. Preencha em Editar Dados antes de emitir o programa."
      )}

      <h2 class="doc-sec">3. Planejamento de exames médicos e complementares</h2>
      ${quadroExames(exames)}

      <h2 class="doc-sec">4. Critérios de interpretação dos achados e conduta</h2>
      ${bloco(
        pcmso.criterios_conduta,
        "Obrigatório pela NR-07 item 7.5. Precisa ser conhecido por todos os médicos que realizam os exames."
      )}

      ${
        pcmso.observacoes
          ? `<h2 class="doc-sec">5. Observações complementares</h2>${bloco(pcmso.observacoes, "")}`
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
  // Import dinâmico: html2pdf traz html2canvas e jspdf, e não faz sentido pesar
  // o bundle das telas com isso quando só a emissão precisa.
  const { default: html2pdf } = await import("html2pdf.js");

  const container = document.createElement("div");
  container.innerHTML = montarHtmlPcmso(dados);

  const nome = `PCMSO_${(dados.pcmso.codigo || dados.pcmso.titulo)
    .replace(/[^\w-]+/g, "_")
    .slice(0, 40)}.pdf`;

  await html2pdf().set(getPdfOptions(nome)).from(container).save();
}
