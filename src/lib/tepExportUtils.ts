import { jsPDF } from "jspdf";
import { format } from "date-fns";

interface TEPData {
  siteNome: string;
  observacoes: string;
  fotos: {
    url: string;
    classificacao: string;
    legenda: string | null;
  }[];
  logoUrl?: string | null;
}

export const exportTEPToPdf = async (data: TEPData) => {
  const doc = new jsPDF();
  const margin = 14;
  let currentY = 20;

  // Header
  if (data.logoUrl) {
    try {
      doc.addImage(data.logoUrl, 'PNG', margin, 10, 30, 15);
    } catch (e) {
      console.warn("Could not add logo to TEP PDF", e);
    }
  }

  doc.setFontSize(18);
  doc.text("Relatório TEP", 105, 25, { align: "center" });
  
  currentY = 40;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Site:", margin, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(data.siteNome, margin + 15, currentY);

  currentY += 15;
  doc.setFont("helvetica", "bold");
  doc.text("Relatório Descritivo / Observações:", margin, currentY);
  currentY += 7;
  doc.setFont("helvetica", "normal");
  const splitObs = doc.splitTextToSize(data.observacoes || "Nenhuma observação informada.", 180);
  doc.text(splitObs, margin, currentY);
  currentY += (splitObs.length * 7) + 10;

  // Photos
  const groups = ["Vistoria", "Execução"];
  for (const group of groups) {
    const groupFotos = data.fotos.filter(f => 
      f.classificacao.toLowerCase() === group.toLowerCase() || 
      (group === "Vistoria" && f.classificacao.toLowerCase() === "antes") ||
      (group === "Execução" && f.classificacao.toLowerCase() === "execucao")
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

        const f1 = groupFotos[i];
        const f2 = groupFotos[i+1];

        // Draw first photo in row
        try {
          doc.addImage(f1.url, 'JPEG', margin, currentY, 85, 60);
          if (f1.legenda) {
            doc.setFontSize(8);
            doc.text(f1.legenda, margin, currentY + 65, { maxWidth: 85 });
          }
        } catch (e) {
          doc.rect(margin, currentY, 85, 60);
          doc.text("Erro ao carregar imagem", margin + 5, currentY + 30);
        }

        // Draw second photo in row if exists
        if (f2) {
          try {
            doc.addImage(f2.url, 'JPEG', margin + 95, currentY, 85, 60);
            if (f2.legenda) {
              doc.setFontSize(8);
              doc.text(f2.legenda, margin + 95, currentY + 65, { maxWidth: 85 });
            }
          } catch (e) {
            doc.rect(margin + 95, currentY, 85, 60);
            doc.text("Erro ao carregar imagem", margin + 100, currentY + 30);
          }
        }

        currentY += 75;
      }
      currentY += 10;
    }
  }

  doc.save(`TEP_${data.siteNome}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
};