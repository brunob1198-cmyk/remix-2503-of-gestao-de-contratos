export const pdfGlobalStyles = `
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; padding: 0; margin: 0; font-size: 11px; background: white; }
    .pdf-container { width: 100%; padding: 10px 15px; }
    .header { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 15px; }
    .header-left { display: flex; gap: 15px; align-items: center; }
    .header-logo { max-height: 48px; object-fit: contain; }
    .header-logo-fallback { width: 120px; height: 48px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-weight: bold; font-size: 10px; border-radius: 4px; border: 1px dashed #cbd5e1; }
    .header-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; }
    .header-subtitle { font-size: 11px; color: #64748b; margin: 0; }
    .header-right { text-align: right; }
    .header-right p { margin: 0 0 4px 0; font-size: 11px; color: #64748b; }
    .header-right .doc-number { font-size: 14px; font-weight: 700; color: #0f172a; }
    
    h2 { font-size: 14px; margin: 18px 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; color: #2563eb; font-weight: 600; page-break-after: avoid; }
    h3 { font-size: 12px; margin: 14px 0 6px; color: #334155; font-weight: 600; page-break-after: avoid; }
    
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; background: #f8fafc; padding: 12px 16px; border-radius: 6px; border: 1px solid #e2e8f0; }
    .info-item { font-size: 11px; color: #334155; }
    .info-item strong { color: #0f172a; }

    .summary-box { background: #f8fafc; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #e2e8f0; }
    .summary-box ul { padding-left: 18px; margin: 4px 0 0 0; }
    .summary-box li { margin-bottom: 4px; color: #334155; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { text-align: left; padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600; background-color: #f1f5f9; color: #334155; }
    td { padding: 8px 10px; border: 1px solid #e2e8f0; color: #1e293b; vertical-align: top; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .bg-muted { background-color: #f8fafc; }
    
    .html2pdf__page-break { height: 0; }

    /* Imagens A4 fix: Inline blocks avoid page breaks badly, float avoids them beautifully inside a wrapper */
    .foto-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; widows: 4; orphans: 4; }
    .foto-card { width: calc(50% - 6px); border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid; background: #fff; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .foto-card img { width: 100%; height: 220px; object-fit: cover; display: block; border-bottom: 1px solid #e2e8f0; }
    .foto-info { padding: 8px 12px; background: #f8fafc; }
    .foto-title { font-size: 10px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .foto-meta { font-size: 9px; color: #64748b; margin: 0 0 6px 0; display: flex; gap: 8px; flex-wrap: wrap; }
    .foto-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 700; color: #fff; margin-bottom: 2px; }
    .foto-legenda { font-size: 9px; color: #475569; margin: 4px 0 0 0; font-style: italic; }
  </style>
`;

export const getLogoHtml = (url?: string | null) => {
  const logoUrl = url || localStorage.getItem("custom_logo_url") || "/logo.png";
  return `<img src="${logoUrl}" alt="Logo da Empresa" class="header-logo" onerror="this.outerHTML='<div class=\\'header-logo-fallback\\'>LOGO DA EMPRESA</div>'" />`;
};

export const getClientLogoHtml = (url?: string | null) => {
  if (!url) return '';
  return `<img src="${url}" alt="Logo do Cliente" class="header-logo" style="max-height: 48px; object-fit: contain; margin-left: 15px;" />`;
};

export const getPdfOptions = (filename: string) => ({
  margin:       [12, 12, 15, 12] as [number, number, number, number], 
  filename,
  image:        { type: 'jpeg' as const, quality: 0.98 },
  html2canvas:  { scale: 2, useCORS: true, letterRendering: true, windowWidth: 800 },
  jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
  pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
} as any);
