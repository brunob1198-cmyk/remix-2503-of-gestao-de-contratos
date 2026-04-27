export const pdfGlobalStyles = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * { box-sizing: border-box; }
    body { font-family: 'Inter', 'Segoe UI', sans-serif; color: #1e293b; padding: 0; margin: 0; font-size: 11px; background: white; line-height: 1.5; }
    
    .pdf-container { width: 100%; padding: 20px 30px; }
    
    /* Header */
    .header { width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 2px solid #1e3a5f; padding-bottom: 16px; }
    .header-left { display: flex; gap: 20px; align-items: center; }
    .header-logo { max-height: 54px; max-width: 180px; object-fit: contain; }
    .header-logo-fallback { width: 140px; height: 50px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-weight: 600; font-size: 10px; border-radius: 4px; border: 1px dashed #cbd5e1; }
    .header-title { font-size: 20px; font-weight: 700; color: #1e3a5f; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: -0.01em; }
    .header-subtitle { font-size: 12px; color: #10b981; font-weight: 500; margin: 0; }
    .header-right { text-align: right; }
    
    /* Site Info Bar */
    .site-info-bar { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #10b981; border-radius: 4px; padding: 12px 20px; margin-bottom: 24px; display: flex; gap: 30px; flex-wrap: wrap; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .site-info-item { font-size: 11px; color: #475569; }
    .site-info-item strong { color: #1e3a5f; font-weight: 600; margin-right: 4px; }
    
    /* Headers Section */
    h2 { 
      font-size: 13px; 
      margin: 24px 0 12px; 
      padding: 8px 16px; 
      background-color: #f1f5f9; 
      border-left: 4px solid #1e3a5f;
      color: #1e3a5f; 
      font-weight: 700; 
      page-break-after: avoid; 
      text-transform: uppercase; 
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    h2 .icon-h2 { 
      width: 16px; 
      height: 16px; 
      color: #10b981;
      display: inline-block;
      vertical-align: middle;
      flex-shrink: 0;
    }
    
    h3 { font-size: 12px; margin: 18px 0 8px; color: #334155; font-weight: 600; page-break-after: avoid; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
    
    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; table-layout: fixed; }
    th { 
      text-align: left; 
      padding: 9px 12px; 
      border: 1px solid #e2e8f0; 
      font-weight: 600; 
      background-color: #1e3a5f; 
      color: #ffffff; 
      font-size: 9px; 
      text-transform: uppercase; 
      letter-spacing: 0.05em; 
    }
    td { padding: 8px 12px; border: 1px solid #e2e8f0; color: #334155; vertical-align: middle; word-wrap: break-word; overflow-wrap: break-word; }
    tbody tr:nth-child(even) { background-color: #f8fafc; }
    tfoot td { background-color: #f1f5f9; font-weight: 700; color: #1e3a5f; border-top: 2px solid #1e3a5f; }
    
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    
    /* Observations */
    .observations-box {
      color: #334155; 
      padding: 16px 20px; 
      background: #f8fafc; 
      border-radius: 4px; 
      border: 1px solid #e2e8f0; 
      border-top: 3px solid #10b981;
      line-height: 1.6; 
      white-space: pre-wrap;
      margin-bottom: 20px;
      font-size: 11px;
    }

    /* Photos */
    .foto-grid { display: block; margin-top: 10px; }
    .foto-card { 
      width: 100%; 
      border: 1px solid #e2e8f0; 
      border-radius: 6px; 
      overflow: hidden; 
      page-break-inside: avoid; 
      break-inside: avoid; 
      background: #fff; 
      margin-bottom: 16px; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.05); 
    }
    .foto-card img { width: 100%; height: auto; max-height: 280px; object-fit: contain; display: block; background: #f8fafc; border-bottom: 1px solid #f1f5f9; }
    .foto-info { padding: 10px 14px; background: #fff; }
    .foto-title { font-size: 11px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; }
    .foto-meta { font-size: 9px; color: #64748b; margin: 0 0 4px 0; display: flex; gap: 8px; flex-wrap: wrap; }
    .foto-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 8px; font-weight: 700; color: #fff; margin-bottom: 2px; }
    .foto-legenda { font-size: 10px; color: #64748b; margin: 0; font-style: italic; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word; }
    .foto-row { display: flex; gap: 16px; margin-bottom: 0; }
    .foto-row .foto-card { width: calc(50% - 8px); }
    /* Group label bar below each photo */
    .foto-label-bar { padding: 6px 10px 8px; background: #fff; }
    .foto-label-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; background-color: #059669; color: #fff; font-size: 9px; font-weight: 700; letter-spacing: 0.3px; }
    /* Section group header above each set of photos */
    .foto-group-header { font-size: 12px; font-weight: 700; color: #065f46; background: #d1fae5; border-left: 4px solid #059669; padding: 6px 12px; border-radius: 0 4px 4px 0; margin: 14px 0 8px; page-break-after: avoid; }
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
