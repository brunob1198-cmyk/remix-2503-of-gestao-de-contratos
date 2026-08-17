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
