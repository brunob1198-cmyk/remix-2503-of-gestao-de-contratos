import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import "https://esm.sh/jspdf-autotable@3.5.25";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { medicaoId, lancamentoIds, tipoMedicao, quality = 'medium' } = await req.json();

    if (!medicaoId && (!lancamentoIds || lancamentoIds.length === 0)) {
      throw new Error("ID da medição ou lançamentos não fornecidos.");
    }

    const qualityScale = quality === 'high' ? 1.0 : quality === 'medium' ? 0.7 : 0.4;


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

    // 2. Fetch Photos
    const fetchPhotos = async () => {
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

      // Fetch production details for photos
      const prodIds = allFotos.map(f => f.diario_producao_id).filter(Boolean);
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

    const photos = await fetchPhotos();

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

    // Table Helper
    const addTable = (headers: string[][], body: any[][], title?: string) => {
      if (title) {
        doc.setTextColor(30, 58, 95);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin, currentY);
        currentY += 8;
      }
      (doc as any).autoTable({
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

    // 5. Items Tables (Grouped by Site if Mista)
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


    // 6. Photographic Report
    doc.addPage();
    addHeader("RELATÓRIO FOTOGRÁFICO", `Total de fotos: ${photos.length}`);
    currentY = 50;

    // Process photos in batches to avoid memory issues and handle large volume
    const addPhotoToPdf = async (photo: any, x: number, y: number, width: number, height: number) => {
      try {
        // Optimize image size using Supabase transformation if it's a storage URL
        let photoUrl = photo.url;
        if (photoUrl.includes("/storage/v1/object/public/") || photoUrl.includes("/storage/v1/object/sign/")) {
          const w = quality === 'high' ? 800 : (quality === 'medium' ? 600 : 400);
          const q = quality === 'high' ? 80 : (quality === 'medium' ? 70 : 60);
          const transform = `width=${w}&quality=${q}`;
          photoUrl += (photoUrl.includes("?") ? "&" : "?") + transform;
        }


        const response = await fetch(photoUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const buffer = await response.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        
        // Determine image type - default to JPEG for safety and size
        const type = "JPEG";
        doc.addImage(uint8, type, x, y, width, height, undefined, "FAST");

        
        // Add caption/info below image
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
        console.error("Error adding photo to PDF:", e);
      }
    };

    const photosPerRow = 2;
    const photoWidth = (pageWidth - (margin * 3)) / photosPerRow;
    const photoHeight = photoWidth * 0.75;
    const verticalGap = 25;

    for (let i = 0; i < photos.length; i++) {
      const row = Math.floor(i / photosPerRow) % 3; // 3 rows per page
      const col = i % photosPerRow;

      if (i > 0 && i % (photosPerRow * 3) === 0) {
        doc.addPage();
        currentY = 20;
      }

      const x = margin + (col * (photoWidth + margin));
      const y = currentY + (row * (photoHeight + verticalGap));

      await addPhotoToPdf(photos[i], x, y, photoWidth, photoHeight);
    }

    // 7. Save and Upload
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
      .createSignedUrl(filePath, 3600); // 1 hour

    if (sErr) throw sErr;

    return new Response(JSON.stringify({ url: signedData.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
