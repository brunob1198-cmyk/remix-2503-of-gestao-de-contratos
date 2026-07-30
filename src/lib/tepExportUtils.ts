import { format } from "date-fns";
import { getPdfSafeImageDataUrl } from "./pdfExportUtils";
import { buildPossibleImageUrls } from "@/utils/imageFallbackUtils";

interface TEPData {
  siteNome: string;
  observacoes: string;
  fotos: {
    url: string;
    thumb_600_url?: string | null;
    classificacao: string;
    legenda: string | null;
    site_nome?: string;
    site_id?: string;
    diario_data?: string;
    item_descricao?: string;
  }[];
  logoUrl?: string | null;
  clienteLogoUrl?: string | null;
  isMultiSite?: boolean;
  fotosPorPagina?: number;
  sitesData?: {
    siteId: string;
    siteName: string;
    observacoes: string[];
    classes: [string, any[]][];
  }[];
  addLog?: (message: string, type?: 'info' | 'error' | 'success' | 'debug') => void;
}

export const exportTEPToHtml = (data: TEPData) => {
  const { addLog } = data;
  addLog?.("Gerando Relatório TEP em formato HTML...", "info");

  const processedFotos = data.fotos;
  const processedLogoUrl = data.logoUrl;
  const processedClienteLogoUrl = data.clienteLogoUrl;

  // Layout dinâmico conforme a quantidade de fotos por página escolhida
  const perPage = [2, 4, 6].includes(Number(data.fotosPorPagina)) ? Number(data.fotosPorPagina) : 6;
  const columns = perPage === 2 ? 1 : perPage === 4 ? 2 : 3;
  const imgHeight = perPage === 2 ? 520 : perPage === 4 ? 400 : 240;
  const cardHeight = imgHeight + 80;

  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const buildPhotoGridHtml = (photos: any[]) =>
    chunk(photos, perPage)
      .map(
        (page) => `
          <div style="display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 15px; margin-top: 15px; break-inside: avoid; page-break-inside: avoid; break-after: page; page-break-after: always;">
            ${page.map((f) => buildPhotoCardHtml(f)).join("")}
          </div>
        `
      )
      .join("");

  const buildPhotoCardHtml = (foto: any) => {

    const clsLower = foto.classificacao?.toLowerCase();
    const badgeColor = (clsLower === "antes" || clsLower === "vistoria") ? "#16a34a" :
                  (clsLower === "execucao" || clsLower === "execução") ? "#2563eb" :
                  "#64748b";
    const badgeText = (clsLower === "antes" || clsLower === "vistoria") ? "Vistoria" :
                 (clsLower === "execucao" || clsLower === "execução") ? "Execução" : 
                 foto.classificacao;

    const extension = (foto.url?.split('.').pop() || 'jpg').toLowerCase();
    const dateStr = foto.diario_data ? foto.diario_data.replace(/-/g, '') : '00000000';
    const itemDesc = (foto.item_descricao || 'foto').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `foto_${dateStr}_${itemDesc.substring(0, 20)}.${extension}`.toLowerCase();
    const siteName = (foto.site_nome || 'site').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const classification = (foto.classificacao || 'geral').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const relativeDir = `fotos/${siteName}/${classification}`;
    const localPath = `${relativeDir}/${fileName}`;
    const safePath = localPath.split('/').map(segment => encodeURIComponent(segment)).join('/');

    // Pega as URLs base para fallbacks progressivos
    const expandedUrls = buildPossibleImageUrls(foto.url, [foto.thumb_600_url, foto.thumb_url], "diario_fotos");
    
    const primaryUrl = expandedUrls[0] || foto.url;
    const fallbackStr = expandedUrls.slice(1).join(',');

    return `
      <div style="break-inside: avoid; margin-bottom: 20px; text-align: center; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #e5e7eb; display: flex; flex-direction: column; height: ${cardHeight}px;">
        <div style="width: 100%; height: ${imgHeight}px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #f8fafc; border-radius: 4px; border-bottom: 1px solid #f1f5f9; margin-bottom: 8px;">

          <img 
            src="${primaryUrl}" 
            data-local-src="${safePath}"
            data-fallback-src="${fallbackStr}"
            style="width: 100%; height: 100%; object-fit: contain;" 
            loading="lazy"
            onerror="handleImageError(this)"/>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; text-align: left;">
          <div>
            <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; color: white; font-size: 10px; font-weight: bold; background-color: ${badgeColor}; margin-bottom: 6px;">${badgeText}</span>
            ${foto.legenda ? `<p style="font-size: 12px; color: #4b5563; font-style: italic; margin: 0; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">“${foto.legenda}”</p>` : ""}
          </div>
        </div>
      </div>
    `;
  };

  let contentHtml = "";

  if (data.isMultiSite && data.sitesData) {
    contentHtml = data.sitesData.map(site => {
      const siteObsHtml = site.observacoes.length > 0 ? `
        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 12px; margin-bottom: 20px;">
          <p style="font-size: 12px; font-weight: bold; margin: 0 0 6px 0; color: #92400e;">📋 Relatório Descritivo / Observações</p>
          ${site.observacoes.map(o => `<p style="font-size: 12px; margin: 0 0 4px 0; color: #4b5563; white-space: pre-line;">${o}</p>`).join("")}
        </div>
      ` : "";

      const photoSectionsHtml = site.classes.map(([className, photos]) => `
        <div style="margin-top: 20px;">
          <h3 style="color: #065f46; background: #d1fae5; border-left: 4px solid #059669; padding: 6px 12px; font-size: 14px; margin-bottom: 15px; border-radius: 0 4px 4px 0;">${className}</h3>
          ${buildPhotoGridHtml(photos)}

        </div>
      `).join("");

      return `
        <div style="margin-bottom: 40px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fff;">
          <div style="background: #1e3a8a; color: #fff; padding: 10px 16px; font-size: 16px; font-weight: bold;">📍 Site: ${site.siteName}</div>
          <div style="padding: 20px;">
            ${siteObsHtml}
            ${photoSectionsHtml}
          </div>
        </div>
      `;
    }).join("");
  } else {
    const groups = ["Vistoria", "Execução"];
    const sectionsHtml = groups.map(group => {
      const groupFotos = processedFotos.filter(f => 
        f.classificacao.toLowerCase() === group.toLowerCase() || 
        (group === "Vistoria" && f.classificacao.toLowerCase() === "antes") ||
        (group === "Execução" && f.classificacao.toLowerCase() === "execucao") ||
        (group === "Execução" && f.classificacao.toLowerCase() === "execução")
      );

      if (groupFotos.length === 0) return "";

      return `
        <div style="margin-top: 30px;">
          <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; font-size: 18px;">Fotos de ${group}</h2>
          ${buildPhotoGridHtml(groupFotos)}

        </div>
      `;
    }).join("");

    contentHtml = `
      <div style="margin-top: 20px;">
        <div class="label" style="font-size: 16px; margin-bottom: 8px; font-weight: bold;">Relatório Descritivo / Observações:</div>
        <div style="background: #f8fafc; border-left: 4px solid #1e3a8a; padding: 15px; margin-bottom: 25px; white-space: pre-wrap; font-size: 14px;">${data.observacoes || "Nenhuma observação informada."}</div>
      </div>
      ${sectionsHtml}
    `;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <title>Relatório TEP - ${data.siteNome}</title>
      <script>
        function handleImageError(img) {
          if (!img || img.dataset.errorHandled) return;
          
          if (img.src.startsWith('data:')) return;
          
          // 1. Tentar o path local (relativo ao ZIP) se ainda não tentou
          if (!img.dataset.triedLocal) {
            img.dataset.triedLocal = 'true';
            if (img.dataset.localSrc && img.dataset.localSrc !== 'undefined' && img.dataset.localSrc !== '') {
              img.src = img.dataset.localSrc;
              return;
            }
          }
          
          // 2. Tentar os fallbacks (Supabase, Thumbs, etc)
          let fallbacks = img.dataset.fallbackSrc ? img.dataset.fallbackSrc.split(',') : [];
          let idx = parseInt(img.dataset.fallbackIdx || '0');
          
          if (idx < fallbacks.length && fallbacks[idx] && fallbacks[idx] !== 'undefined' && fallbacks[idx] !== '') {
            img.dataset.fallbackIdx = (idx + 1).toString();
            img.src = fallbacks[idx];
            return;
          }
          
          // 3. Se tudo falhar, mostra placeholder
          img.dataset.errorHandled = 'true';
          img.style.display = 'none';
          const parent = img.parentElement;
          if (parent) {
            parent.innerHTML = '<div style="padding: 10px; font-size: 10px; color: #991b1b; text-align: center; height: 100%; display: flex; align-items: center; justify-content: center; background: #fef2f2; border: 1px dashed #fecaca; border-radius: 4px;"><b>Imagem não disponível</b></div>';
          }
        }
      </script>
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; line-height: 1.5; color: #1f2937; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f3f4f6; }
        .page { background: white; padding: 30px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-radius: 8px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { max-height: 70px; max-width: 220px; object-fit: contain; }
        .title { font-size: 28px; font-weight: bold; color: #1e3a8a; margin: 0; }
        .info-grid { display: grid; grid-template-columns: 100px 1fr; gap: 10px; margin-bottom: 25px; }
        .label { font-weight: bold; color: #374151; }
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
          ${processedLogoUrl ? `<img src="${processedLogoUrl}" class="logo" alt="Logo Empresa" />` : "<div></div>"}
          <h1 class="title">Relatório TEP</h1>
          ${processedClienteLogoUrl ? `<img src="${processedClienteLogoUrl}" class="logo" alt="Logo Cliente" />` : "<div></div>"}
        </div>

        <div class="info-grid">
          <div class="label">Site:</div>
          <div>${data.siteNome}</div>
          <div class="label">Data:</div>
          <div>${format(new Date(), "dd/MM/yyyy")}</div>
        </div>

        ${contentHtml}
        
        <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px;">
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