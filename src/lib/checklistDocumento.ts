import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import {
  estilosDocumentoSgsst,
  escDoc as esc,
  dataBrDoc as dataBr,
} from "@/lib/sgsstDocumentoEstilos";
import { emitirPdfTimbrado } from "@/lib/sgsstPapelTimbrado";
import { pesoEfetivo, type PontuacaoAplicacao } from "@/utils/checklistPontuacao";

/**
 * Emissão do checklist aplicado.
 *
 * A tela tinha um botão "Imprimir / PDF" que chamava `window.print()`: saía a
 * página do navegador — diálogo, botões, cores de tela — sem papel timbrado e sem
 * o recorte do que foi respondido. É o mesmo problema que a tela de Relatórios
 * tinha, com um agravante: o checklist aplicado **é** o documento. Ele é o que se
 * entrega ao cliente na auditoria e o que fica no arquivo provando que a
 * verificação aconteceu.
 *
 * Três decisões:
 *
 * 1. **O peso aparece na linha do item.** Se o índice de conformidade é ponderado,
 *    quem lê precisa ver por que 3 não conformidades derrubaram o índice para 40%.
 *    Índice ponderado sem os pesos à vista é número que não se confere.
 *
 * 2. **Não conformidade sai com o que a acompanha** — comentário, quantidade de
 *    evidências e plano de ação. O desvio sem o tratamento ao lado obriga quem
 *    recebe a folha a procurar em outro lugar.
 *
 * 3. **Índice nulo sai como "não avaliado", não como 0% nem 100%.** Um checklist
 *    inteiro marcado "não aplicável" não tem conformidade total nem nula.
 */

export interface ItemDoDocumento {
  id: string;
  titulo: string;
  descricao?: string | null;
  peso_pontuacao?: number | null;
  obrigatorio?: boolean | null;
  /** Item impeditivo: nao conformidade nele reprova o checklist inteiro. */
  critico?: boolean | null;
}

export interface SecaoDoDocumento {
  id: string;
  titulo: string;
  ordem?: number | null;
  itens: readonly ItemDoDocumento[];
}

export interface RespostaDoDocumento {
  item_id: string;
  resposta_valor?: string | null;
  comentario?: string | null;
  is_nao_conforme?: boolean | null;
  quantidadeEvidencias?: number;
  planoAcao?: {
    o_que_fazer?: string | null;
    quando_prazo?: string | null;
    quem?: string | null;
    prioridade?: string | null;
  } | null;
}

export interface ChecklistDocumentoDados {
  modeloNome: string;
  modeloCodigo?: string | null;
  categoria?: string | null;
  aplicacaoCodigo?: string | null;
  secoes: readonly SecaoDoDocumento[];
  /** Respostas indexadas por `item_id`. */
  respostas: Readonly<Record<string, RespostaDoDocumento>>;
  pontuacao: PontuacaoAplicacao;
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  obra?: string | null;
  area?: string | null;
  aplicador?: string | null;
  responsavel?: string | null;
  dataAplicacao?: string | null;
  observacoesGerais?: string | null;
  /** Coordenadas registradas, quando o modelo exige geolocalização. */
  geolocalizacao?: { latitude: number; longitude: number; precisao?: number | null } | null;
  geradoPor?: string | null;
}

const RESPOSTA_LABEL: Record<string, string> = {
  Conforme: "Conforme",
  NaoConforme: "Não conforme",
  Nao_Conforme: "Não conforme",
  Sim: "Sim",
  Nao: "Não",
  OK: "OK",
  NaoOK: "Não OK",
  Nao_OK: "Não OK",
  NA: "Não aplicável",
  "N/A": "Não aplicável",
  NaoAplicavel: "Não aplicável",
};

function faltando(rotulo: string): string {
  return `<span class="doc-falta">${esc(rotulo)}</span>`;
}

/** Percentual em formato brasileiro; nulo vira o texto do estado. */
export function textoDoIndice(percentual: number | null): string {
  if (percentual === null) return "não avaliado";
  return `${percentual.toFixed(1).replace(".", ",")}%`;
}

function ehNaoAplicavelValor(valor: string | null | undefined): boolean {
  const v = (valor ?? "").trim();
  return v === "NA" || v === "N/A" || v === "NaoAplicavel";
}

function linhaDoItem(
  item: ItemDoDocumento,
  resposta: RespostaDoDocumento | undefined
): string {
  const valor = (resposta?.resposta_valor ?? "").trim();
  const respondido = !!valor;
  const naoConforme = !!resposta?.is_nao_conforme || ["NaoConforme", "Nao", "NaoOK"].includes(valor);
  const na = ehNaoAplicavelValor(valor);

  const textoResposta = !respondido
    ? faltando("não respondido")
    : naoConforme
      ? `<span class="doc-inapto">${esc(RESPOSTA_LABEL[valor] ?? valor)}</span>`
      : na
        ? `<span class="doc-neutro">${esc(RESPOSTA_LABEL[valor] ?? valor)}</span>`
        : esc(RESPOSTA_LABEL[valor] ?? valor);

  // O que acompanha a não conformidade sai ao lado dela, não em outra seção.
  const detalhe: string[] = [];
  if (resposta?.comentario?.trim()) {
    detalhe.push(esc(resposta.comentario.trim()));
  }
  if ((resposta?.quantidadeEvidencias ?? 0) > 0) {
    detalhe.push(
      `<span class="doc-neutro">${resposta?.quantidadeEvidencias} evidência(s) anexada(s)</span>`
    );
  }
  if (resposta?.planoAcao?.o_que_fazer?.trim()) {
    const prazo = resposta.planoAcao.quando_prazo
      ? ` · prazo ${dataBr(resposta.planoAcao.quando_prazo)}`
      : "";
    const quem = resposta.planoAcao.quem ? ` · ${esc(resposta.planoAcao.quem)}` : "";
    detalhe.push(
      `<strong>Ação:</strong> ${esc(resposta.planoAcao.o_que_fazer)}${prazo}${quem}`
    );
  } else if (naoConforme) {
    detalhe.push(`<span class="doc-inapto">Sem plano de ação registrado</span>`);
  }

  // A marca do item crítico fica no título, não numa coluna própria: quem lê
  // precisa saber que AQUELE item veta, e não conferir uma legenda no rodapé.
  const marcaCritico = item.critico
    ? ` <span class="doc-inapto">[CRÍTICO]</span>`
    : "";

  return `<tr>
    <td>
      ${esc(item.titulo)}${item.obrigatorio ? " *" : ""}${marcaCritico}
      ${item.descricao ? `<br><span class="doc-neutro">${esc(item.descricao)}</span>` : ""}
      ${detalhe.length > 0 ? `<br>${detalhe.join("<br>")}` : ""}
    </td>
    <td class="doc-num">${pesoEfetivo(item.peso_pontuacao)}</td>
    <td>${textoResposta}</td>
  </tr>`;
}

export function montarHtmlChecklist(dados: ChecklistDocumentoDados): string {
  const {
    modeloNome,
    modeloCodigo,
    categoria,
    aplicacaoCodigo,
    secoes,
    respostas,
    pontuacao,
    empresa,
    obra,
    area,
    aplicador,
    responsavel,
    dataAplicacao,
    observacoesGerais,
    geolocalizacao,
    geradoPor,
  } = dados;

  const emitidoEm = new Date().toLocaleString("pt-BR");

  const ordenadas = [...secoes].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const naoRespondidos = ordenadas
    .flatMap((s) => s.itens)
    .filter((i) => !(respostas[i.id]?.resposta_valor ?? "").trim()).length;

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    <div class="doc">

      <div class="doc-cab">
        <h1>${esc(modeloNome)}</h1>
        <p class="doc-sub">
          Checklist aplicado${categoria ? ` · ${esc(categoria)}` : ""}${
            aplicacaoCodigo ? ` · Nº ${esc(aplicacaoCodigo)}` : ""
          }
        </p>
      </div>

      ${
        pontuacao.reprovadoPorItemCritico
          ? `<div class="doc-aviso">
              <strong>CHECKLIST REPROVADO.</strong>
              ${pontuacao.itensCriticosNaoConformes} item(ns) crítico(s) saiu(ram) não
              conforme(s). Item crítico é impeditivo: a reprovação não depende do
              percentual de conformidade, e o percentual abaixo não a substitui.
             </div>`
          : ""
      }

      ${
        naoRespondidos > 0
          ? `<div class="doc-aviso">
              <strong>${naoRespondidos} item(ns) sem resposta.</strong> Item não respondido
              não conta como conforme nem como não conforme — fica fora do índice, e a
              verificação daquele ponto não aconteceu.
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
            <td>${esc(obra) || "—"}</td>
            <td class="rot">Setor</td>
            <td>${esc(area) || "—"}</td>
          </tr>
          <tr>
            <td class="rot">Aplicado por</td>
            <td>${esc(aplicador) || faltando("não registrado")}</td>
            <td class="rot">Data</td>
            <td>${dataAplicacao ? dataBr(dataAplicacao) : "—"}</td>
          </tr>
          ${
            modeloCodigo || responsavel
              ? `<tr>
                  <td class="rot">Modelo</td>
                  <td>${esc(modeloCodigo) || "—"}</td>
                  <td class="rot">Responsável</td>
                  <td>${esc(responsavel) || "—"}</td>
                 </tr>`
              : ""
          }
        </table>
      </div>

      <div class="doc-bloco">
        <div class="tit">Resultado</div>
        <div class="corpo">
          <div class="doc-conclusao">
            <div class="rot">Resultado</div>
            <div class="valor ${
              pontuacao.reprovadoPorItemCritico ? "doc-inapto" : "doc-apto"
            }">${pontuacao.reprovadoPorItemCritico ? "REPROVADO" : "APROVADO"}</div>
            ${
              pontuacao.reprovadoPorItemCritico
                ? `<div class="rot">por ${pontuacao.itensCriticosNaoConformes} item(ns) crítico(s) não conforme(s)</div>`
                : ""
            }
          </div>

          <div class="doc-cards">
            <div class="doc-card">
              <div class="rot">Conformidade</div>
              <div class="val ${
                pontuacao.percentualConformidade === null
                  ? "doc-neutro"
                  : pontuacao.percentualConformidade >= 90
                    ? "doc-apto"
                    : pontuacao.percentualConformidade >= 70
                      ? "doc-restr"
                      : "doc-inapto"
              }">${textoDoIndice(pontuacao.percentualConformidade)}</div>
              <div class="sub">${pontuacao.pontuacaoObtida} de ${
                pontuacao.pontuacaoMaxima
              } ponto(s)</div>
            </div>
            <div class="doc-card">
              <div class="rot">Conformes</div>
              <div class="val">${pontuacao.totalConforme}</div>
            </div>
            <div class="doc-card">
              <div class="rot">Não conformes</div>
              <div class="val">${pontuacao.totalNaoConforme}</div>
            </div>
            <div class="doc-card">
              <div class="rot">Não aplicáveis</div>
              <div class="val">${pontuacao.totalNa}</div>
              <div class="sub">fora do índice</div>
            </div>
          </div>
          <p class="doc-neutro">
            O índice é ponderado pelo peso de cada item e considera apenas os itens
            avaliados. Itens "não aplicável" ficam fora do cálculo — somá-los aos
            conformes inflaria o índice justamente quando ele deveria alertar.
          </p>
        </div>
      </div>

      ${ordenadas
        .map(
          (secao) => `
        <div class="doc-bloco">
          <div class="tit">${esc(secao.titulo)}</div>
          <div class="corpo">
            ${
              secao.itens.length === 0
                ? `<p class="doc-vazio">Seção sem itens.</p>`
                : `<table class="doc-tabela">
                    <thead>
                      <tr><th>Item verificado</th><th>Peso</th><th>Resposta</th></tr>
                    </thead>
                    <tbody>
                      ${secao.itens
                        .map((item) => linhaDoItem(item, respostas[item.id]))
                        .join("")}
                    </tbody>
                   </table>`
            }
          </div>
        </div>`
        )
        .join("")}

      ${
        observacoesGerais?.trim()
          ? `<div class="doc-bloco">
              <div class="tit">Observações gerais</div>
              <div class="corpo"><p>${esc(observacoesGerais)}</p></div>
             </div>`
          : ""
      }

      ${
        geolocalizacao
          ? `<div class="doc-bloco">
              <div class="tit">Localização do registro</div>
              <div class="corpo">
                <p class="doc-neutro">
                  Latitude ${esc(geolocalizacao.latitude)} · Longitude
                  ${esc(geolocalizacao.longitude)}${
                    geolocalizacao.precisao
                      ? ` · precisão aproximada de ${esc(geolocalizacao.precisao)} m`
                      : ""
                  }
                </p>
              </div>
             </div>`
          : ""
      }

      <div class="doc-assin">
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(aplicador) || "&nbsp;"}</div>
          <hr>
          <p>Responsável pela aplicação</p>
        </div>
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(responsavel) || "&nbsp;"}</div>
          <hr>
          <p>Ciência do responsável pela área</p>
          <p>Data: ____/____/______</p>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${geradoPor ? ` por ${esc(geradoPor)}` : ""} ·
        Checklist aplicado — índice de conformidade ponderado
      </div>
    </div>
  `;
}

function nomeArquivo(dados: ChecklistDocumentoDados): string {
  const base = dados.aplicacaoCodigo || dados.modeloNome || "Checklist";
  // O veredito entra no nome do arquivo: quem recebe uma pasta de PDFs consegue
  // separar os reprovados sem abrir cada um.
  const veredito = dados.pontuacao.reprovadoPorItemCritico ? "REPROVADO_" : "";
  return `Checklist_${veredito}${base.replace(/[^\w-]+/g, "_").slice(0, 48)}.pdf`;
}

export async function gerarPdfChecklist(dados: ChecklistDocumentoDados): Promise<void> {
  await emitirPdfTimbrado({
    html: montarHtmlChecklist(dados),
    nomeArquivo: nomeArquivo(dados),
    identificacao: `${dados.modeloNome} — ${
      dados.pontuacao.reprovadoPorItemCritico ? "REPROVADO · " : ""
    }${textoDoIndice(dados.pontuacao.percentualConformidade)}`.slice(0, 88),
  });
}
