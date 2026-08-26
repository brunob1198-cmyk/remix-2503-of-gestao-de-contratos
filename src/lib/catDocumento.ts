import { pdfGlobalStyles } from "@/lib/pdfTemplates";
import {
  estilosDocumentoSgsst,
  escDoc as esc,
  dataBrDoc as dataBr,
} from "@/lib/sgsstDocumentoEstilos";
import { emitirPdfTimbrado, ORGANIZACAO_TIMBRE } from "@/lib/sgsstPapelTimbrado";
import {
  blocoDeFotos,
  estilosFotosDocumento,
  type FotosPreparadas,
} from "@/lib/fotosDoDocumento";
import { TIPO_CAT_LABEL, type SgsstCat } from "@/hooks/sgsst/useSgsstCats";

/**
 * Emissão da CAT — Comunicação de Acidente de Trabalho.
 *
 * O módulo guardava a CAT mas não a imprimia: pedida a comunicação em papel —
 * por cliente, seguradora ou fiscalização — não havia o que entregar.
 *
 * IMPORTANTE, e o documento diz isso em destaque: esta folha **não substitui**
 * a CAT oficial. A comunicação legal é feita no sistema do INSS e é de lá que
 * sai o número da CAT. Este PDF é o registro interno da empresa sobre aquela
 * comunicação. Omitir esse aviso deixaria alguém entregar isto no lugar do
 * documento oficial, o que é pior que não ter documento nenhum.
 */

export interface CatDocumentoDados {
  cat: SgsstCat;
  /** Identificação da organização emitente. */
  empresa: { nome?: string | null; cnpj?: string | null } | null;
  geradoPor?: string | null;
  /**
   * Fotos do incidente vinculado.
   *
   * O incidente não tem documento próprio, e a CAT é o único lugar onde as fotos
   * do acidente saem impressas. Entram aqui porque este PDF é o **registro
   * interno** da empresa sobre a comunicação — não a CAT oficial do INSS, que tem
   * formulário próprio e não recebe anexo assim.
   */
  fotosDoIncidente?: FotosPreparadas;
}

function nomeTrabalhador(cat: SgsstCat): string {
  return (
    cat.colaborador?.profile?.nome ||
    cat.colaborador?.recurso?.nome ||
    cat.colaborador?.nome ||
    "Trabalhador não identificado"
  );
}

function faltando(rotulo: string): string {
  return `<span class="doc-falta">${esc(rotulo)}</span>`;
}

/** Campos que a comunicação precisa ter, na linguagem de quem confere. */
export function pendenciasCat(dados: CatDocumentoDados): string[] {
  const { cat, empresa } = dados;
  const p: string[] = [];

  if (!cat.numero_cat?.trim()) {
    p.push("Número da CAT (gerado no sistema do INSS) não registrado");
  }
  if (!cat.colaborador_id) p.push("Trabalhador acidentado não vinculado");
  if (!cat.colaborador?.cpf?.trim()) p.push("CPF do trabalhador não informado");
  if (!cat.descricao?.trim()) p.push("Descrição do acidente não preenchida");
  if (!cat.cid?.trim()) p.push("CID da lesão não informado");
  if (!empresa?.cnpj?.trim()) p.push("CNPJ da organização não informado");
  if (!cat.projeto_id) p.push("Obra do acidente não vinculada");

  // Óbito é o caso em que a CAT tem prazo próprio e tratamento distinto; sem a
  // data do acidente não há como demonstrar cumprimento de prazo nenhum.
  if (cat.houve_obito && cat.tipo_cat !== "COMUNICACAO_OBITO") {
    p.push("Óbito marcado, mas o tipo da CAT não é Comunicação de Óbito");
  }

  return p;
}

export function montarHtmlCat(dados: CatDocumentoDados): string {
  const { cat, empresa, geradoPor } = dados;
  const emitidoEm = new Date().toLocaleString("pt-BR");

  const diasAfastamento = cat.dias_afastamento ?? 0;

  return `
    ${pdfGlobalStyles}
    ${estilosDocumentoSgsst}
    ${estilosFotosDocumento}
    <div class="doc">

      <div class="doc-cab">
        <h1>Comunicação de Acidente de Trabalho — CAT</h1>
        <p class="doc-sub">
          Registro interno · ${esc(TIPO_CAT_LABEL[cat.tipo_cat] ?? cat.tipo_cat)}
          ${cat.numero_cat ? ` · CAT nº ${esc(cat.numero_cat)}` : ""}
        </p>
      </div>

      <div class="doc-aviso">
        <strong>Este documento não substitui a CAT oficial.</strong> A comunicação
        legal do acidente é feita no sistema do INSS, e é de lá que sai o número da
        CAT. Esta folha é o registro interno da organização sobre aquela
        comunicação, para arquivo e apresentação a clientes e demais interessados.
      </div>

      <div class="doc-ident">
        <table>
          <tr>
            <td class="rot">Organização</td>
            <td><strong>${esc(empresa?.nome) || faltando("não informada")}</strong></td>
            <td class="rot">CNPJ</td>
            <td>${esc(empresa?.cnpj) || faltando("não informado")}</td>
          </tr>
          <tr>
            <td class="rot">Nº da CAT (INSS)</td>
            <td>${esc(cat.numero_cat) || faltando("não registrado")}</td>
            <td class="rot">Tipo</td>
            <td>${esc(TIPO_CAT_LABEL[cat.tipo_cat] ?? cat.tipo_cat)}</td>
          </tr>
          <tr>
            <td class="rot">Data do acidente</td>
            <td>${dataBr(cat.data_acidente)}</td>
            <td class="rot">Data da emissão</td>
            <td>${dataBr(cat.data_emissao)}</td>
          </tr>
        </table>
      </div>

      <h2 class="doc-sec">1. Trabalhador acidentado</h2>
      <table class="doc-grid">
        <tr>
          <td class="rot">Nome</td>
          <td colspan="3"><strong>${esc(nomeTrabalhador(cat))}</strong></td>
        </tr>
        <tr>
          <td class="rot">CPF</td>
          <td>${esc(cat.colaborador?.cpf) || faltando("não informado")}</td>
          <td class="rot">Função</td>
          <td>${esc(cat.colaborador?.funcao?.nome) || "—"}</td>
        </tr>
      </table>

      <h2 class="doc-sec">2. Local e origem</h2>
      <table class="doc-grid">
        <tr>
          <td class="rot">Obra</td>
          <td>${
            cat.projeto
              ? esc(`[${cat.projeto.codigo}] ${cat.projeto.nome}`)
              : faltando("não vinculada")
          }</td>
          <td class="rot">Setor / área</td>
          <td>${esc(cat.area?.nome) || "—"}</td>
        </tr>
        <tr>
          <td class="rot">Ocorrência registrada</td>
          <td colspan="3">${
            cat.incidente
              ? esc(
                  `${cat.incidente.codigo ? `[${cat.incidente.codigo}] ` : ""}${cat.incidente.titulo}`
                )
              : "Sem registro de incidente vinculado no módulo"
          }</td>
        </tr>
      </table>

      <h2 class="doc-sec">3. Lesão e afastamento</h2>
      <table class="doc-grid">
        <tr>
          <td class="rot">CID</td>
          <td>${esc(cat.cid) || faltando("não informado")}</td>
          <td class="rot">Dias de afastamento</td>
          <td class="doc-num">${diasAfastamento}</td>
        </tr>
        <tr>
          <td class="rot">Houve óbito</td>
          <td colspan="3">${
            cat.houve_obito
              ? '<strong class="doc-pior">SIM</strong>'
              : "Não"
          }</td>
        </tr>
      </table>

      <h2 class="doc-sec">4. Descrição do acidente</h2>
      ${
        cat.descricao?.trim()
          ? `<div class="doc-bloco">${esc(cat.descricao.trim())}</div>`
          : `<div class="doc-aviso">Descrição do acidente não preenchida. É o campo que
             explica o que aconteceu — sem ele a comunicação não informa nada.</div>`
      }

      ${
        cat.observacoes?.trim()
          ? `<h2 class="doc-sec">5. Observações</h2>
             <div class="doc-bloco">${esc(cat.observacoes.trim())}</div>`
          : ""
      }

      ${blocoDeFotos(dados.fotosDoIncidente?.fotos ?? [], {
        titulo: "6. Registro fotográfico do local e das condições",
        omitidas: dados.fotosDoIncidente?.omitidas,
      })}

      <div class="doc-assin">
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">&nbsp;</div>
          <hr>
          <p>Responsável pela emissão</p>
          <p>${esc(empresa?.nome) || "&nbsp;"}</p>
        </div>
        <div class="doc-assin-centro">
          <div class="doc-centro-txt">${esc(nomeTrabalhador(cat))}</div>
          <hr>
          <p>Ciência do trabalhador</p>
          <p>${esc(cat.colaborador?.cpf) || "&nbsp;"}</p>
        </div>
      </div>

      <div class="doc-rodape">
        Emitido em ${esc(emitidoEm)}${geradoPor ? ` por ${esc(geradoPor)}` : ""} ·
        ${esc(ORGANIZACAO_TIMBRE.site)} ·
        Registro interno — a comunicação oficial do acidente é feita no sistema do INSS.
      </div>
    </div>
  `;
}

export async function gerarPdfCat(dados: CatDocumentoDados): Promise<void> {
  const identificador =
    dados.cat.numero_cat || `${nomeTrabalhador(dados.cat)}_${dados.cat.data_acidente}`;

  const nome = `CAT_${identificador.replace(/[^\w-]+/g, "_").slice(0, 40)}.pdf`;

  await emitirPdfTimbrado({
    html: montarHtmlCat(dados),
    nomeArquivo: nome,
    identificacao: `CAT ${dados.cat.numero_cat || nomeTrabalhador(dados.cat)}`,
  });
}
