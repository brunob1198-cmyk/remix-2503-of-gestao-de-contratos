export const pdfGlobalStyles = `
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; padding: 0; margin: 0; font-size: 11px; background: white; }
    .pdf-container { width: 100%; padding: 10px 15px; }
    .header { width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 3px solid #1e3a5f; padding-bottom: 14px; }
    .header-left { display: flex; gap: 15px; align-items: center; }
    .header-logo { max-height: 48px; object-fit: contain; }
    .header-logo-fallback { width: 120px; height: 48px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-weight: bold; font-size: 10px; border-radius: 4px; border: 1px dashed #cbd5e1; }
    .header-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; }
    .header-subtitle { font-size: 11px; color: #64748b; margin: 0; }
    .header-right { text-align: right; }
    .header-right p { margin: 0 0 4px 0; font-size: 11px; color: #64748b; }
    .header-right .doc-number { font-size: 14px; font-weight: 700; color: #0f172a; }

    .site-info-bar { background: #f0f4f8; border: 1px solid #d0d7e0; border-radius: 6px; padding: 10px 16px; margin-bottom: 16px; display: flex; gap: 24px; flex-wrap: wrap; }
    .site-info-item { font-size: 11px; color: #475569; }
    .site-info-item strong { color: #0f172a; font-weight: 600; }
    
    h2 { font-size: 14px; margin: 20px 0 10px; padding: 10px 16px; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%); color: #ffffff; font-weight: 700; border-radius: 6px; page-break-after: avoid; text-align: center; text-transform: uppercase; letter-spacing: 0.8px; box-shadow: 0 3px 8px rgba(30, 58, 95, 0.35), 0 1px 2px rgba(0,0,0,0.12); display: flex; align-items: center; justify-content: center; gap: 8px; }
    h2 .icon-h2 { width: 18px; height: 18px; flex-shrink: 0; }
    h3 { font-size: 12px; margin: 14px 0 6px; color: #334155; font-weight: 600; page-break-after: avoid; }
    
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; background: #f8fafc; padding: 12px 16px; border-radius: 6px; border: 1px solid #e2e8f0; }
    .info-item { font-size: 11px; color: #334155; }
    .info-item strong { color: #0f172a; }

    .summary-box { background: #f8fafc; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #e2e8f0; }
    .summary-box ul { padding-left: 18px; margin: 4px 0 0 0; }
    .summary-box li { margin-bottom: 4px; color: #334155; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { text-align: left; padding: 7px 10px; border: 1px solid #c0c8d4; font-weight: 600; background-color: #1e3a5f; color: #ffffff; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; }
    td { padding: 7px 10px; border: 1px solid #dde2e8; color: #1e293b; vertical-align: top; }
    tbody tr:nth-child(even) { background-color: #f7f9fb; }
    tbody tr:hover { background-color: #eef2f7; }
    tfoot td { background-color: #e8edf3; font-weight: 700; border-top: 2px solid #1e3a5f; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .bg-muted { background-color: #f8fafc; }
    
    .html2pdf__page-break { height: 0; }

    .foto-grid { display: block; margin-top: 10px; }
    .foto-card { width: 100%; max-width: 340px; border: 1px solid #c0c8d4; border-radius: 8px; overflow: hidden; page-break-inside: avoid; break-inside: avoid; background: #fff; margin-bottom: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    .foto-card img { width: 100%; height: auto; max-height: 240px; object-fit: contain; display: block; border-bottom: 1px solid #e2e8f0; background: #f8f9fa; }
    .foto-info { padding: 8px 12px; background: #f8fafc; }
    .foto-title { font-size: 11px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; }
    .foto-meta { font-size: 9px; color: #64748b; margin: 0 0 4px 0; display: flex; gap: 8px; flex-wrap: wrap; }
    .foto-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 8px; font-weight: 700; color: #fff; margin-bottom: 2px; }
    .foto-legenda { font-size: 10px; color: #334155; margin: 4px 0 0 0; font-style: italic; word-wrap: break-word; overflow-wrap: break-word; }
    .foto-row { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 0; }
    .foto-row .foto-card { width: calc(50% - 7px); margin-bottom: 12px; }
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
  pagebreak:    { mode: ['css', 'legacy'], avoid: ['.pdf-keep-together', '.foto-card', '.foto-row', '.foto-item-group', 'table', 'thead', 'tfoot', 'tr', 'img', '.border.rounded-lg'] }
} as any);
