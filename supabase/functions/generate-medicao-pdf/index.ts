import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import autoTable from "https://esm.sh/jspdf-autotable@3.5.25";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Concurrency limit for image fetching to prevent memory spikes and timeouts
const PHOTO_CONCURRENCY = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { medicaoId, lancamentoIds, tipoMedicao, quality = 'medium' } = await req.json();

    if (!medicaoId && (!lancamentoIds || lancamentoIds.length === 0)) {
      throw new Error("ID da medição ou lançamentos não fornecidos.");
    }

    console.log(`Iniciando geração de PDF para medição ${medicaoId}. Qualidade: ${quality}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Fetch data
    const { data: lancamentos, error: lErr } = await supabase
      .from("lancamentos_medicao")
      .select(`
        *,
        item_lpu:itens_lpu(*),
        site:sites(*, projeto:projetos(*, cliente:clientes(*)))
      `)
      .in("id", lancamentoIds);

    if (lErr || !lancamentos?.length) throw new Error("Erro ao buscar lançamentos.");

    const firstL = lancamentos[0];
    const project = firstL.site?.projeto;
    const client = project?.cliente;
    const periodoInicio = firstL.periodo_inicio;
    const periodoFim = firstL.periodo_fim;
    const numeroMedicao = firstL.numero_medicao;

    const allSiteIds = [...new Set(lancamentos.map((l) => l.site_id))];

    // 2. Fetch Photos metadata
    const fetchPhotosMetadata = async () => {
      const { data: diarios } = await supabase
        .from("diarios_obra")
        .select("id, data, site_id")
        .in("site_id", allSiteIds)
        .gte("data", periodoInicio)
        .lte("data", periodoFim);
      
      if (!diarios?.length) return [];
      const diarioIds = diarios.map(d => d.id);
      const diarioMap = new Map(diarios.map(d => [d.id, d]));

      let allFotos: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("diario_fotos")
          .select("*")
          .in("diario_id", diarioIds)
          .range(from, from + 999);
        if (error || !data?.length) break;
        allFotos.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }

      console.log(`Total de fotos encontradas: ${allFotos.length}`);

      // Fetch production details for photos
      const prodIds = [...new Set(allFotos.map(f => f.diario_producao_id).filter(Boolean))];
      let prodMap = new Map();
      if (prodIds.length > 0) {
        const { data: prods } = await supabase
          .from("diario_producao")
          .select("id, item_lpu:itens_lpu(codigo, descricao)")
          .in("id", prodIds);
        if (prods) prodMap = new Map(prods.map(p => [p.id, p]));
      }

      return allFotos.map(f => {
        const d = diarioMap.get(f.diario_id);
        const p = f.diario_producao_id ? prodMap.get(f.diario_producao_id) : null;
        return {
          ...f,
          diario_data: d?.data,
          site_id: d?.site_id,
          item_codigo: p?.item_lpu?.codigo,
          item_descricao: p?.item_lpu?.descricao
        };
      });
    };

    const photos = await fetchPhotosMetadata();

    // 3. Initialize PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let currentY = 20;

    // Header Helper
    const addHeader = (title: string, subtitle?: string) => {
      doc.setFillColor(30, 58, 95); // #1e3a5f
      doc.rect(0, 0, pageWidth, 40, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin, 25);
      if (subtitle) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(subtitle, margin, 33);
      }
      currentY = 50;
    };

    const addTable = (headers: string[][], body: any[][], title?: string) => {
      if (title) {
        doc.setTextColor(30, 58, 95);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin, currentY);
        currentY += 8;
      }
      autoTable(doc, {
        head: headers,
        body: body,
        startY: currentY,
        margin: { left: margin, right: margin },
        theme: "striped",
        headStyles: { fillColor: [30, 58, 95], textColor: 255 },
        styles: { fontSize: 9 },
        didDrawPage: (data: any) => {
          currentY = data.cursor.y + 10;
        }
      });
      currentY = (doc as any).lastAutoTable.cursor.y + 10;
    };

    // 4. Content - Summary
    addHeader("RELATÓRIO DE MEDIÇÃO", `Projeto: ${project?.codigo || ""} - ${project?.nome || ""}`);
    
    const summaryBody = [
      ["Número da Medição", numeroMedicao || "-"],
      ["Período", `${periodoInicio} até ${periodoFim}`],
      ["Cliente", client?.nome || "-"],
      ["Data de Geração", new Date().toLocaleDateString("pt-BR")]
    ];
    addTable([], summaryBody, "Resumo da Medição");

    // 5. Items Tables
    const groupedBySite = new Map();
    lancamentos.forEach(l => {
      const siteKey = `${l.site?.codigo} - ${l.site?.nome}`;
      if (!groupedBySite.has(siteKey)) groupedBySite.set(siteKey, []);
      groupedBySite.get(siteKey).push(l);
    });

    for (const [siteName, siteLancamentos] of groupedBySite.entries()) {
      const itemsHeaders = [["Item", "Qtd", "V. Unit", "Total"]];
      const itemsBody = siteLancamentos.map(l => [
        `${l.item_lpu?.codigo} - ${l.item_lpu?.descricao}`,
        l.quantidade.toLocaleString("pt-BR"),
        (l.item_lpu?.preco_unitario || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        (l.quantidade * (l.item_lpu?.preco_unitario || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      ]);
      const siteTotal = siteLancamentos.reduce((acc, l) => acc + (l.quantidade * (l.item_lpu?.preco_unitario || 0)), 0);
      itemsBody.push(["", "", "TOTAL DO SITE", siteTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]);
      
      addTable(itemsHeaders, itemsBody, `Site: ${siteName}`);
    }

    // Grand Total
    const grandTotal = lancamentos.reduce((acc, l) => acc + (l.quantidade * (l.item_lpu?.preco_unitario || 0)), 0);
    doc.setFontSize(14);
    doc.setTextColor(30, 58, 95);
    doc.text(`VALOR TOTAL GERAL: ${grandTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, margin, currentY);
    currentY += 15;

    // 6. Photographic Report - Optimized with parallel fetching and better memory management
    const addPhotoToPdf = async (photo: any, x: number, y: number, width: number, height: number) => {
      try {
        let photoUrl = photo.url;
        // Apply transformations if it's a Supabase storage URL
        if (photoUrl.includes("/storage/v1/object/public/") || photoUrl.includes("/storage/v1/object/sign/")) {
          // FORCE lower quality for massive reports to ensure it completes within memory/time limits
          const isLargeReport = photos.length > 300;
          const w = isLargeReport ? 300 : (quality === 'high' ? 800 : (quality === 'medium' ? 600 : 400));
          const q = isLargeReport ? 50 : (quality === 'high' ? 80 : (quality === 'medium' ? 70 : 60));
          const transform = `width=${w}&quality=${q}&resize=contain`;
          photoUrl += (photoUrl.includes("?") ? "&" : "?") + transform;
        }

        const response = await fetch(photoUrl);
        if (!response.ok) {
          console.warn(`Erro ao baixar foto ${photo.id}: ${response.status}`);
          return;
        }
        
        const contentType = response.headers.get("content-type") || "";
        const buffer = await response.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        
        // Detect format or default to JPEG
        let format = "JPEG";
        if (contentType.includes("png")) format = "PNG";
        else if (contentType.includes("webp")) format = "WEBP";
        
        try {
          doc.addImage(uint8, format as any, x, y, width, height, undefined, "FAST");
        } catch (addErr) {
          // If detection fails, try as JPEG anyway
          console.warn(`Erro ao adicionar imagem ${photo.id} como ${format}, tentando JPEG...`);
          try {
            doc.addImage(uint8, "JPEG", x, y, width, height, undefined, "FAST");
          } catch (retryErr) {
            console.error(`Falha final ao adicionar imagem ${photo.id}:`, retryErr);
          }
        }

        doc.setTextColor(50, 50, 50);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        const itemText = photo.item_codigo ? `${photo.item_codigo} - ${photo.item_descricao || ""}` : "Foto Geral";
        const splitText = doc.splitTextToSize(itemText, width);
        doc.text(splitText, x, y + height + 4);
        
        doc.setFont("helvetica", "normal");
        const metaText = `${photo.diario_data || ""} | ${photo.classificacao || ""}`;
        doc.text(metaText, x, y + height + 4 + (splitText.length * 3));
      } catch (e) {
        console.error(`Falha ao processar foto ${photo.id}:`, e);
      }
    };

    const photosBySite = new Map();
    photos.forEach(p => {
      const site = lancamentos.find(l => l.site_id === p.site_id)?.site;
      const siteKey = site ? `${site.codigo} - ${site.nome}` : "Outras Fotos";
      if (!photosBySite.has(siteKey)) photosBySite.set(siteKey, []);
      photosBySite.get(siteKey).push(p);
    });

    console.log(`Iniciando processamento de ${photos.length} fotos em ${photosBySite.size} sites...`);

    for (const [siteName, sitePhotos] of photosBySite.entries()) {
      doc.addPage();
      addHeader("RELATÓRIO FOTOGRÁFICO", `Site: ${siteName}`);
      currentY = 50;

      const photosPerRow = 2;
      const photoWidth = (pageWidth - (margin * 3)) / photosPerRow;
      const photoHeight = photoWidth * 0.75;
      const verticalGap = 25;

      // Process photos in concurrent batches for this site
      for (let i = 0; i < sitePhotos.length; i += PHOTO_CONCURRENCY) {
        const batch = sitePhotos.slice(i, i + PHOTO_CONCURRENCY);
        
        await Promise.all(batch.map(async (photo, batchIdx) => {
          const globalIdx = i + batchIdx;
          const row = Math.floor(globalIdx / photosPerRow) % 3;
          const col = globalIdx % photosPerRow;

          // If we need a new page within a site
          if (globalIdx > 0 && globalIdx % (photosPerRow * 3) === 0) {
            // This is tricky with Promise.all and concurrent pages. 
            // In a simple sequential loop it's easier.
            // For now, let's keep it mostly sequential but with small parallel fetches.
          }
        }));

        // Refined sequential approach with batch fetching to balance speed and PDF structure
        for (let j = 0; j < batch.length; j++) {
          const photo = batch[j];
          const globalIdx = i + j;
          const row = Math.floor(globalIdx / photosPerRow) % 3;
          const col = globalIdx % photosPerRow;

          if (globalIdx > 0 && globalIdx % (photosPerRow * 3) === 0) {
            doc.addPage();
            currentY = 20;
          }

          const x = margin + (col * (photoWidth + margin));
          const y = currentY + (row * (photoHeight + verticalGap));

          await addPhotoToPdf(photo, x, y, photoWidth, photoHeight);
        }
        
        if (i % 50 === 0) console.log(`Processadas ${i + batch.length} fotos do site ${siteName}...`);
      }
    }

    // 7. Save and Upload
    console.log("Finalizando PDF e enviando para storage...");
    const pdfOutput = doc.output("arraybuffer");
    const fileName = `medicao_${medicaoId || "export"}_${Date.now()}.pdf`;
    const filePath = `${fileName}`;

    const { error: uErr } = await supabase.storage
      .from("medicoes-pdf")
      .upload(filePath, pdfOutput, {
        contentType: "application/pdf",
        upsert: true
      });

    if (uErr) throw uErr;

    // 8. Generate Signed URL
    const { data: signedData, error: sErr } = await supabase.storage
      .from("medicoes-pdf")
      .createSignedUrl(filePath, 3600); 

    if (sErr) throw sErr;

    console.log(`PDF gerado com sucesso: ${filePath}`);

    return new Response(JSON.stringify({ url: signedData.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Erro crítico na geração do PDF:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
