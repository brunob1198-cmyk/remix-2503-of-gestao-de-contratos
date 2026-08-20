import { pdfGlobalStyles, getPdfOptions } from "@/lib/pdfTemplates";
import type { SgsstAso } from "@/hooks/sgsst/useSgsstAsosAndExames";

/**
 * Emissão do ASO — Atestado de Saúde Ocupacional.
 *
 * É o documento que sai da empresa e vai para a mão do trabalhador, e a NR-07
 * lista os campos obrigatórios. Um campo em branco é autuação direta, então
 * `pendenciasAso` avisa antes e o PDF destaca o que faltou em vez de omitir.
 *
 * A identificação da organização vem congelada no próprio ASO
 * (`empresa_nome` / `empresa_cnpj`): ler de `empresas` na hora de imprimir
 * falsearia atestados antigos se a empresa mudasse de nome.
 */

const APTIDAO_LABEL: Record<string, string> = {
  APTO: "APTO",
  APTO_COM_RESTRICAO: "APTO COM RESTRIÇÃO",
  INAPTO: "INAPTO",
};

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
    "Trabalhador não identificado"
  );
}

/** Campos obrigatórios ainda vazios, na linguagem da norma. */
export function pendenciasAso(aso: SgsstAso): string[] {
  const p: string[] = [];
  if (!aso.descricao_riscos?.trim()) p.push("Descrição dos perigos e fatores de risco");
  if (!aso.medico_responsavel?.trim()) p.push("Médico examinador");
  if (!aso.crm_medico?.trim()) p.push("CRM do médico examinador");
  if (!aso.medico_coordenador?.trim()) p.push("Médico coordenador do PCMSO");
  if (!aso.crm_coordenador?.trim()) p.push("CRM do coordenador");
  if (!aso.colaborador?.cpf?.trim()) p.push("CPF do trabalhador");
  if (!aso.empresa_cnpj?.trim()) p.push("CNPJ da organização");

  const temExames = (aso.exames?.length ?? 0) > 0 || !!aso.exame_id;
  if (!temExames) p.push("Indicação e data dos exames realizados");

  if (aso.aptidao === "APTO_COM_RESTRICAO" && !aso.descricao_restricao?.trim()) {
    p.push("Descrição da restrição (aptidão com restrição)");
  }

  return p;
}

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
    return `<p class="aso-pendente">⚠ Nenhum exame vinculado. A indicação e a data dos exames realizados são obrigatórias no ASO.</p>`;
  }

  return `
    <table class="aso-tabela">
      <thead>
        <tr>
          <th style="width:46%">Exame realizado</th>
          <th style="width:22%">Tipo</th>
          <th style="width:16%">Data</th>
          <th style="width:16%">Resultado</th>
        </tr>
      </thead>
      <tbody>
        ${linhas
          .map(
            (e) => `<tr>
              <td><strong>${esc(e.nome_exame)}</strong></td>
              <td>${esc(e.tipo)}</td>
              <td>${dataBr(e.data_realizacao)}</td>
              <td>${e.resultado ? esc(e.resultado) : "—"}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

const ESTILOS_ASO = `
  <style>
    .aso-doc { padding: 20px 28px; }
    .aso-cab { border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 16px; text-align: center; }
    .aso-cab h1 { font-size: 16px; color: #1e3a5f; margin: 0 0 3px; text-transform: uppercase; letter-spacing: .02em; }
    .aso-cab p { font-size: 10px; color: #64748b; margin: 0; }
    .aso-bloco { border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 12px; }
    .aso-bloco > .tit { background: #f1f5f9; font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .05em; color: #1e3a5f; padding: 5px 10px; border-bottom: 1px solid #e2e8f0; }
    .aso-bloco > .corpo { padding: 9px 10px; }
    .aso-grid { width: 100%; border-collapse: collapse; }
    .aso-grid td { font-size: 10.5px; color: #334155; padding: 3px 0; vertical-align: top; }
    .aso-grid td.rot { color: #64748b; width: 22%; }
    .aso-doc p { font-size: 10.5px; color: #334155; margin: 0; text-align: justify; }
    .aso-pendente { background: #fef3c7; border-left: 3px solid #d97706; padding: 6px 9px;
      color: #92400e !important; font-size: 10px !important; border-radius: 2px; }
    table.aso-tabela { width: 100%; border-collapse: collapse; }
    table.aso-tabela th { background: #1e3a5f; color: #fff; font-size: 8.5px; text-transform: uppercase;
      letter-spacing: .03em; padding: 5px 6px; text-align: left; }
    table.aso-tabela td { font-size: 9.5px; color: #334155; padding: 5px 6px; border-bottom: 1px solid #e2e8f0; }
    .aso-conclusao { text-align: center; padding: 12px; border: 2px solid #1e3a5f; border-radius: 4px;
      margin-bottom: 12px; }
    .aso-conclusao .rot { font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
    .aso-conclusao .valor { font-size: 19px; font-weight: 700; letter-spacing: .02em; margin-top: 2px; }
    .aso-apto { color: #15803d; } .aso-restr { color: #b45309; } .aso-inapto { color: #b91c1c; }
    .aso-assin { margin-top: 26px; display: flex; gap: 34px; page-break-inside: avoid; }
    .aso-assin > div { flex: 1; border-top: 1px solid #334155; padding-top: 5px; text-align: center; }
    .aso-assin .nome { font-size: 10.5px; font-weight: 600; color: #1e3a5f; }
    .aso-assin .papel { font-size: 8.5px; color: #64748b; }
    .aso-rodape { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 5px;
      font-size: 8px; color: #94a3b8; text-align: center; }
  </style>
`;

export function montarHtmlAso(aso: SgsstAso, geradoPor?: string | null): string {
  const classeAptidao =
    aso.aptidao === "APTO" ? "aso-apto" : aso.aptidao === "INAPTO" ? "aso-inapto" : "aso-restr";

  const faltando = (rotulo: string) =>
    `<span style="color:#b45309;font-style:italic">${esc(rotulo)}</span>`;

  return `
    ${pdfGlobalStyles}
    ${ESTILOS_ASO}
    <div class="aso-doc">

      <div class="aso-cab">
        <h1>Atestado de Saúde Ocupacional — ASO</h1>
        <p>Emitido conforme a NR-07 · ${esc(aso.numero_documento) || "sem numeração"}</p>
      </div>

      <div class="aso-bloco">
        <div class="tit">Organização</div>
        <div class="corpo">
          <table class="aso-grid">
            <tr>
              <td class="rot">Razão social</td>
              <td><strong>${esc(aso.empresa_nome) || faltando("não registrada na emissão")}</strong></td>
              <td class="rot">CNPJ</td>
              <td>${esc(aso.empresa_cnpj) || faltando("não registrado")}</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="aso-bloco">
        <div class="tit">Trabalhador</div>
        <div class="corpo">
          <table class="aso-grid">
            <tr>
              <td class="rot">Nome</td>
              <td colspan="3"><strong>${esc(nomeColaborador(aso))}</strong></td>
            </tr>
            <tr>
              <td class="rot">CPF</td>
              <td>${esc(aso.colaborador?.cpf) || faltando("não informado")}</td>
              <td class="rot">Função</td>
              <td>${esc(aso.colaborador?.funcao?.nome) || "—"}</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="aso-bloco">
        <div class="tit">Perigos e fatores de risco a que está exposto</div>
        <div class="corpo">
          ${
            aso.descricao_riscos?.trim()
              ? `<p>${esc(aso.descricao_riscos.trim())}</p>`
              : `<p class="aso-pendente">⚠ Campo obrigatório pela NR-07 não preenchido.</p>`
          }
        </div>
      </div>

      <div class="aso-bloco">
        <div class="tit">Exames realizados</div>
        <div class="corpo">${tabelaExames(aso)}</div>
      </div>

      <div class="aso-conclusao">
        <div class="rot">Conclusão — aptidão para a função</div>
        <div class="valor ${classeAptidao}">${esc(APTIDAO_LABEL[aso.aptidao] ?? aso.aptidao)}</div>
      </div>

      ${
        aso.aptidao === "APTO_COM_RESTRICAO"
          ? `<div class="aso-bloco">
              <div class="tit">Restrição</div>
              <div class="corpo">
                ${
                  aso.descricao_restricao?.trim()
                    ? `<p>${esc(aso.descricao_restricao.trim())}</p>
                       <table class="aso-grid" style="margin-top:5px">
                         <tr>
                           <td class="rot">Início</td><td>${dataBr(aso.data_inicio_restricao)}</td>
                           <td class="rot">Término</td><td>${dataBr(aso.data_termino_restricao)}</td>
                         </tr>
                       </table>`
                    : `<p class="aso-pendente">⚠ Aptidão com restrição exige a descrição da restrição.</p>`
                }
              </div>
            </div>`
          : ""
      }

      <div class="aso-bloco">
        <div class="tit">Dados do atestado</div>
        <div class="corpo">
          <table class="aso-grid">
            <tr>
              <td class="rot">Tipo de exame</td><td>${esc(aso.tipo)}</td>
              <td class="rot">Data de emissão</td><td>${dataBr(aso.data_emissao)}</td>
            </tr>
            <tr>
              <td class="rot">Validade</td><td>${dataBr(aso.validade)}</td>
              <td class="rot">PCMSO</td>
              <td>${aso.pcmso ? esc(`${aso.pcmso.codigo ?? ""} ${aso.pcmso.titulo}`.trim()) : "—"}</td>
            </tr>
          </table>
        </div>
      </div>

      ${
        aso.observacoes?.trim()
          ? `<div class="aso-bloco"><div class="tit">Observações</div>
             <div class="corpo"><p>${esc(aso.observacoes.trim())}</p></div></div>`
          : ""
      }

      <div class="aso-assin">
        <div>
          <div class="nome">${esc(aso.medico_responsavel) || "________________________"}</div>
          <div class="papel">
            Médico examinador${aso.crm_medico ? ` · ${esc(aso.crm_medico)}` : ""}<br/>
            Data: ${dataBr(aso.data_emissao)}
          </div>
        </div>
        <div>
          <div class="nome">${esc(aso.medico_coordenador) || "________________________"}</div>
          <div class="papel">
            Médico coordenador do PCMSO${aso.crm_coordenador ? ` · ${esc(aso.crm_coordenador)}` : ""}
          </div>
        </div>
        <div>
          <div class="nome">________________________</div>
          <div class="papel">Ciência do trabalhador</div>
        </div>
      </div>

      <div class="aso-rodape">
        Emitido em ${esc(new Date().toLocaleString("pt-BR"))}${
          geradoPor ? ` por ${esc(geradoPor)}` : ""
        } · Situação: ${esc(aso.status)}
      </div>
    </div>
  `;
}

export async function gerarPdfAso(aso: SgsstAso, geradoPor?: string | null): Promise<void> {
  // Import dinâmico: html2pdf carrega html2canvas e jspdf, e só a emissão precisa.
  const { default: html2pdf } = await import("html2pdf.js");

  const container = document.createElement("div");
  container.innerHTML = montarHtmlAso(aso, geradoPor);

  const identificador = aso.numero_documento || nomeColaborador(aso);
  const nome = `ASO_${identificador.replace(/[^\w-]+/g, "_").slice(0, 40)}.pdf`;

  await html2pdf().set(getPdfOptions(nome)).from(container).save();
}
