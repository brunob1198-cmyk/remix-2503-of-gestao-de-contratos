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
  addLog?: (message: string, type?: 'info' | 'error' | 'success') => void;
}

export const exportTEPToHtml = async (data: TEPData) => {
  const { addLog } = data;
  addLog?.("Gerando Relatório TEP em formato HTML...", "info");

  const groups = ["Vistoria", "Execução"];
  
  const sectionsHtml = groups.map(group => {
    const groupFotos = data.fotos.filter(f => 
      f.classificacao.toLowerCase() === group.toLowerCase() || 
      (group === "Vistoria" && f.classificacao.toLowerCase() === "antes") ||
      (group === "Execução" && f.classificacao.toLowerCase() === "execucao") ||
      (group === "Execução" && f.classificacao.toLowerCase() === "execução")
    );

    if (groupFotos.length === 0) return "";

    const fotosHtml = groupFotos.map(foto => `
      <div style="break-inside: avoid; margin-bottom: 20px; text-align: center; background: #f9fafb; padding: 10px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <img src="${foto.url}" style="max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" />
        ${foto.legenda ? `<p style="font-size: 12px; color: #4b5563; font-style: italic; margin-top: 8px;">${foto.legenda}</p>` : ""}
      </div>
    `).join("");

    return `
      <div style="margin-top: 30px;">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; font-size: 18px;">Fotos de ${group}</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
          ${fotosHtml}
        </div>
      </div>
    `;
  }).join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <title>Relatório TEP - ${data.siteNome}</title>
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; line-height: 1.5; color: #1f2937; max-width: 1000px; margin: 0 auto; padding: 40px; background: #f3f4f6; }
        .page { background: white; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-radius: 8px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { max-height: 60px; }
        .title { font-size: 28px; font-weight: bold; color: #1e3a8a; margin: 0; }
        .info-grid { display: grid; grid-template-columns: 100px 1fr; gap: 10px; margin-bottom: 25px; }
        .label { font-weight: bold; color: #374151; }
        .obs-box { background: #f8fafc; border-left: 4px solid #1e3a8a; padding: 15px; margin-top: 10px; white-space: pre-wrap; }
        @media print {
          body { background: white; padding: 0; }
          .page { box-shadow: none; padding: 0; }
          @page { margin: 1.5cm; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          ${data.logoUrl ? `<img src="${data.logoUrl}" class="logo" />` : "<div></div>"}
          <h1 class="title">Relatório TEP</h1>
        </div>

        <div class="info-grid">
          <div class="label">Site:</div>
          <div>${data.siteNome}</div>
          <div class="label">Data:</div>
          <div>${format(new Date(), "dd/MM/yyyy")}</div>
        </div>

        <div style="margin-top: 20px;">
          <div class="label" style="font-size: 16px; margin-bottom: 8px;">Relatório Descritivo / Observações:</div>
          <div class="obs-box">${data.observacoes || "Nenhuma observação informada."}</div>
        </div>

        ${sectionsHtml}
        
        <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}
        </div>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TEP_${data.siteNome.replace(/\s+/g, '_')}_${format(new Date(), "yyyy-MM-dd")}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  addLog?.("Relatório TEP HTML gerado com sucesso!", "success");
};