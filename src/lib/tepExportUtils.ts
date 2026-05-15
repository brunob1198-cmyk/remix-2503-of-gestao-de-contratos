import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { getPdfSafeImageDataUrl } from "./pdfExportUtils";

interface TEPData {
  siteNome: string;
  observacoes: string;
  fotos: {
    url: string;
    classificacao: string;
    legenda: string | null;
  }[];
  logoUrl?: string | null;
  onProgress?: (progress: number) => void;
  addLog?: (message: string, type?: 'info' | 'error' | 'success') => void;
}

export const exportTEPToPdf = async (data: TEPData) => {
  const { addLog, onProgress } = data;
  const doc = new jsPDF();
  const margin = 14;
  let currentY = 20;

  addLog?.("Iniciando processamento do Relatório TEP...", "info");

  // Header
  if (data.logoUrl) {
    try {
      addLog?.("Carregando logo...", "info");
      const safeLogo = await getPdfSafeImageDataUrl(data.logoUrl, { maxWidth: 300, quality: 0.9 });
      doc.addImage(safeLogo, 'PNG', margin, 10, 30, 15);
    } catch (e) {
      console.warn("Could not add logo to TEP PDF", e);
      addLog?.("Aviso: Não foi possível carregar o logo no PDF.", "error");
    }
  }

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório TEP", 105, 25, { align: "center" });
  
  currentY = 40;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Site:", margin, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(data.siteNome || "N/A", margin + 15, currentY);

  currentY += 15;
  doc.setFont("helvetica", "bold");
  doc.text("Relatório Descritivo / Observações:", margin, currentY);
  currentY += 7;
  doc.setFont("helvetica", "normal");
  
  const splitObs = doc.splitTextToSize(data.observacoes || "Nenhuma observação informada.", 180);
  
  // Handle page breaks for observations
  for (const line of splitObs) {
    if (currentY > 280) {
      doc.addPage();
      currentY = 20;
    }
    doc.text(line, margin, currentY);
    currentY += 7;
  }
  
  currentY += 5;

  // Photos
  const groups = ["Vistoria", "Execução"];
  let photoIndex = 0;
  const totalPhotos = data.fotos.length;

  for (const group of groups) {
    const groupFotos = data.fotos.filter(f => 
      f.classificacao.toLowerCase() === group.toLowerCase() || 
      (group === "Vistoria" && f.classificacao.toLowerCase() === "antes") ||
      (group === "Execução" && f.classificacao.toLowerCase() === "execucao") ||
      (group === "Execução" && f.classificacao.toLowerCase() === "execução")
    );

    if (groupFotos.length > 0) {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`Fotos de ${group}`, margin, currentY);
      currentY += 10;

      for (let i = 0; i < groupFotos.length; i += 2) {
        if (currentY > 230) {
          doc.addPage();
          currentY = 20;
        }

        const photosInRow = [groupFotos[i], groupFotos[i+1]].filter(Boolean);
        
        for (let j = 0; j < photosInRow.length; j++) {
          const foto = photosInRow[j];
          const xPos = margin + (j * 95);
          
          try {
            photoIndex++;
            if (onProgress) onProgress(Math.round((photoIndex / totalPhotos) * 90));
            
            addLog?.(`Processando foto ${photoIndex} de ${totalPhotos}...`, "info");
            
            // Critical: get safe data URL for the image
            const safeUrl = await getPdfSafeImageDataUrl(foto.url, { maxWidth: 800, quality: 0.75 });
            doc.addImage(safeUrl, 'JPEG', xPos, currentY, 85, 60);
            
            if (foto.legenda) {
              doc.setFontSize(8);
              doc.setFont("helvetica", "normal");
              const splitLegenda = doc.splitTextToSize(foto.legenda, 85);
              doc.text(splitLegenda, xPos, currentY + 65);
            }
          } catch (e) {
            console.error("Error adding photo to TEP PDF", e);
            doc.rect(xPos, currentY, 85, 60);
            doc.setFontSize(8);
            doc.text("Erro ao carregar imagem", xPos + 5, currentY + 30);
          }
        }

        currentY += 75;
      }
      currentY += 10;
    }
  }

  addLog?.("Finalizando arquivo...", "info");
  doc.save(`TEP_${data.siteNome}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  onProgress?.(100);
};