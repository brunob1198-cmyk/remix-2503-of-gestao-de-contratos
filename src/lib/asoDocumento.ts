import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";
import { estilosDocumentoSgsst } from "@/lib/sgsstDocumentoEstilos";
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
    return `<p class="doc-aviso">⚠ Nenhum exame vinculado. A indicação e a data dos exames realizados são obrigatórias no ASO.</p>`;
  }

  return `
    <table class="doc-tabela">
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



export function montarHtmlAso(aso: SgsstAso, geradoPor?: string | null): string {
  const classeAptidao =
    aso.aptidao === "APTO" ? "doc-apto" : aso.aptidao === "INAPTO" ? "doc-inapto" : "doc-restr";

  const faltando = (rotulo: string) =>
    `<span style="color:#b45309;font-style:italic">${esc(rotulo)}</span>`;

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    <div class="doc">

      <div class="doc-cab">
        <h1>Atestado de Saúde Ocupacional — ASO</h1>
        <p>Emitido conforme a NR-07 · ${esc(aso.numero_documento) || "sem numeração"}</p>
      </div>

      <div class="doc-bloco">
        <div class="tit">Organização</div>
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
        <div class="tit">Trabalhador</div>
        <div class="corpo">
          <table class="doc-grid">
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

      <div class="doc-bloco">
        <div class="tit">Perigos e fatores de risco a que está exposto</div>
        <div class="corpo">
          ${
            aso.descricao_riscos?.trim()
              ? `<p>${esc(aso.descricao_riscos.trim())}</p>`
              : `<p class="doc-aviso">⚠ Campo obrigatório pela NR-07 não preenchido.</p>`
          }
        </div>
      </div>

      <div class="doc-bloco">
        <div class="tit">Exames realizados</div>
        <div class="corpo">${tabelaExames(aso)}</div>
      </div>

      <div class="doc-conclusao">
        <div class="rot">Conclusão — aptidão para a função</div>
        <div class="valor ${classeAptidao}">${esc(APTIDAO_LABEL[aso.aptidao] ?? aso.aptidao)}</div>
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
                    : `<p class="doc-aviso">⚠ Aptidão com restrição exige a descrição da restrição.</p>`
                }
              </div>
            </div>`
          : ""
      }

      <div class="doc-bloco">
        <div class="tit">Dados do atestado</div>
        <div class="corpo">
          <table class="doc-grid">
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
          ? `<div class="doc-bloco"><div class="tit">Observações</div>
             <div class="corpo"><p>${esc(aso.observacoes.trim())}</p></div></div>`
          : ""
      }

      <div class="doc-assin">
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
