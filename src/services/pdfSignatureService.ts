import { jsPDF } from "jspdf";
import { generateQRCodeDataUrl } from "@/utils/qrCodeGenerator";
import { calculateSHA256 } from "@/utils/cryptoUtils";

export interface PDFSignatureOptions {
  requestId: string;
  documentTitle: string;
  signerNome: string;
  signerCargo?: string;
  empresaNome: string;
  signedAt: string; // ISO or formatted date
  metodo: "ASSINATURA_ELETRONICA_INTERNA" | "GOV_BR" | "ICP_BRASIL_FUTURO";
  originalContentSummary?: string;
  verificationUrl: string;
}

export interface PDFSignatureResult {
  pdfBlob: Blob;
  pdfFile: File;
  hashOriginal: string;
  hashAssinado: string;
}

export async function generateSignedPDF(options: PDFSignatureOptions): Promise<PDFSignatureResult> {
  const {
    requestId,
    documentTitle,
    signerNome,
    signerCargo,
    empresaNome,
    signedAt,
    metodo,
    originalContentSummary,
    verificationUrl,
  } = options;

  // 1. Calculate original content hash
  const rawOriginalText = `${documentTitle}\n${empresaNome}\n${originalContentSummary || ""}`;
  const hashOriginal = await calculateSHA256(rawOriginalText);

  // 2. Generate PDF document with jsPDF
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

  // HEADER
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 24, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SISTEMA CENTRAL DE ASSINATURA DIGITAL", 14, 15);

  // DOCUMENT TITLE
  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFontSize(16);
  doc.text(documentTitle.toUpperCase(), 14, 38);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Empresa: ${empresaNome}`, 14, 45);
  doc.text(`Identificador do Documento: ${requestId}`, 14, 50);

  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(14, 54, pageWidth - 14, 54);

  // SUMMARY CONTENT
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Resumo do Documento Final", 14, 63);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  
  const splitSummary = doc.splitTextToSize(
    originalContentSummary || "Documento gerado e aprovado no sistema de gestão.",
    pageWidth - 28
  );
  doc.text(splitSummary, 14, 70);

  // SIGNATURE SECTION BOX
  const sigBoxY = pageHeight - 110;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(14, sigBoxY, pageWidth - 28, 90, 3, 3, "FD");

  // SIGNATURE HEADER
  doc.setFillColor(16, 185, 129); // emerald-500 badge
  doc.rect(14, sigBoxY, pageWidth - 28, 10, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DOCUMENTO ASSINADO ELETRONICAMENTE", 18, sigBoxY + 7);

  // DETAILS
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);

  let currentY = sigBoxY + 18;

  const metodoLabel =
    metodo === "GOV_BR"
      ? "GOV.BR — Assinatura Digital Oficial"
      : "Assinatura eletrônica do sistema";

  doc.setFont("helvetica", "bold");
  doc.text("Assinante:", 18, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(`${signerNome}${signerCargo ? ` (${signerCargo})` : ""}`, 45, currentY);

  currentY += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Empresa:", 18, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(empresaNome, 45, currentY);

  currentY += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Data/Hora:", 18, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(signedAt).toLocaleString("pt-BR"), 45, currentY);

  currentY += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Método:", 18, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(metodoLabel, 45, currentY);

  currentY += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Identificador:", 18, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(requestId, 45, currentY);

  currentY += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Hash SHA-256 (Original):", 18, currentY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(hashOriginal, 62, currentY);

  // QR CODE EMBEDDING
  try {
    const qrDataUrl = await generateQRCodeDataUrl(verificationUrl);
    doc.addImage(qrDataUrl, "PNG", pageWidth - 52, sigBoxY + 15, 34, 34);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Escanear para verificar", pageWidth - 35, sigBoxY + 53, { align: "center" });
    doc.text("autenticidade no SaaS", pageWidth - 35, sigBoxY + 56, { align: "center" });
  } catch (err) {
    console.warn("Não foi possível gerar QR Code no PDF:", err);
  }

  // AUDIT NOTICE AT FOOTER
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `Este documento possui integridade assegurada via hash criptográfico SHA-256. Verificação pública disponível em ${verificationUrl}`,
    14,
    pageHeight - 8
  );

  // 3. Output PDF blob & file
  const pdfArrayBuffer = doc.output("arraybuffer");
  const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" });
  const pdfFile = new File([pdfBlob], `documento_assinado_${requestId}.pdf`, { type: "application/pdf" });

  const hashAssinado = await calculateSHA256(pdfArrayBuffer);

  return {
    pdfBlob,
    pdfFile,
    hashOriginal,
    hashAssinado,
  };
}

// ---------------------------------------------------------------------------
// Folha de assinaturas de uma FILA (vários signatários)
// ---------------------------------------------------------------------------

export interface AssinanteDaFolha {
  nome: string;
  cargo?: string | null;
  cpf?: string | null;
  empresaNome?: string | null;
  assinadoEm: string;
  ordem: number;
}

export interface FolhaDeAssinaturasOptions {
  requestId: string;
  documentTitle: string;
  empresaNome: string;
  assinantes: readonly AssinanteDaFolha[];
  originalContentSummary?: string;
  verificationUrl: string;
}

/**
 * A folha final de uma solicitação com fila.
 *
 * `generateSignedPDF` acima monta a folha de UM signatário e continua servindo ao
 * checklist, que tem exatamente um. Com fila a folha muda de natureza: ela precisa
 * listar todos, em ordem, com a data de cada um — é o que o documento prova.
 *
 * Reescrever a função antiga para aceitar lista pareceu tentador e seria pior: o
 * layout de um signatário usa a folha inteira para um bloco só, e o de vários é
 * uma lista paginada. São dois documentos diferentes com o mesmo cabeçalho.
 */
export async function gerarFolhaDeAssinaturas(
  options: FolhaDeAssinaturasOptions
): Promise<PDFSignatureResult> {
  const {
    requestId,
    documentTitle,
    empresaNome,
    assinantes,
    originalContentSummary,
    verificationUrl,
  } = options;

  const rawOriginalText = `${documentTitle}\n${empresaNome}\n${originalContentSummary || ""}`;
  const hashOriginal = await calculateSHA256(rawOriginalText);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SISTEMA CENTRAL DE ASSINATURA DIGITAL", 14, 15);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(16);
  doc.text(documentTitle.toUpperCase(), 14, 38);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Empresa: ${empresaNome}`, 14, 45);
  doc.text(`Identificador do Documento: ${requestId}`, 14, 50);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 54, pageWidth - 14, 54);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Assinaturas (${assinantes.length})`, 14, 63);

  // Ordem da fila, e não ordem de assinatura: é a ordem que o documento declara.
  const emOrdem = [...assinantes].sort((a, b) => a.ordem - b.ordem);

  let y = 72;
  for (const [i, a] of emOrdem.entries()) {
    // Quebra de página com folga para o bloco inteiro: bloco partido ao meio
    // deixaria a data numa página e o nome na outra.
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 24;
    }

    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, pageWidth - 28, 26, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`${i + 1}. ${a.nome}`, 18, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    const identificacao = [a.cargo, a.empresaNome, a.cpf ? `CPF ${a.cpf}` : null]
      .filter(Boolean)
      .join(" · ");
    if (identificacao) doc.text(identificacao, 18, y + 14);

    doc.setTextColor(16, 122, 87);
    doc.text(
      `Assinado eletronicamente em ${new Date(a.assinadoEm).toLocaleString("pt-BR")}`,
      18,
      y + 21
    );

    y += 31;
  }

  // O QR fica na última página, depois da lista: a folha é lida de cima para
  // baixo e a verificação é o último passo.
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 24;
  }

  try {
    const qrDataUrl = await generateQRCodeDataUrl(verificationUrl);
    doc.addImage(qrDataUrl, "PNG", pageWidth - 52, y + 4, 34, 34);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Escanear para verificar", pageWidth - 35, y + 42, { align: "center" });
  } catch (err) {
    console.warn("Não foi possível gerar QR Code na folha de assinaturas:", err);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text("Hash SHA-256 (Original):", 18, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(hashOriginal, 18, y + 15);

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Integridade assegurada via hash SHA-256. Verificação pública em ${verificationUrl}`,
    14,
    pageHeight - 8
  );

  const pdfArrayBuffer = doc.output("arraybuffer");
  const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" });
  const pdfFile = new File([pdfBlob], `folha_assinaturas_${requestId}.pdf`, {
    type: "application/pdf",
  });

  return {
    pdfBlob,
    pdfFile,
    hashOriginal,
    hashAssinado: await calculateSHA256(pdfArrayBuffer),
  };
}
