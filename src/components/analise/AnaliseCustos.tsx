import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface AnaliseCustosProps {
  projetoIds: string[];
  periodoInicio: Date;
  periodoFim: Date;
}

const CATEGORIAS = [
  "Mão de Obra",
  "Materiais",
  "Equipamentos",
  "Transporte",
  "Indiretos",
  "Financeiros",
];

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

interface ProjetoRow {
  id: string;
  codigo: string;
  nome: string;
  area: string;
  cliente: string;
  valorProduzido: number;
  custoOrcado: number;
  categorias: Record<string, number>;
  totalErp: number;
}

export function AnaliseCustos({ projetoIds, periodoInicio, periodoFim }: AnaliseCustosProps) {
  const startDate = format(startOfMonth(periodoInicio), "yyyy-MM-dd");
  const endDate = format(endOfMonth(periodoFim), "yyyy-MM-dd");

  const { data: rows = [] } = useQuery({
    queryKey: ["analise_custos_matrix", projetoIds, startDate, endDate],
    queryFn: async () => {
      if (projetoIds.length === 0) return [];

      // Fetch projetos with area and cliente
      const { data: projetos } = await supabase
        .from("projetos")
        .select("id, codigo, nome, area_id, cliente_id, areas(nome), clientes(razao_social)")
        .in("id", projetoIds)
        .order("codigo");

      if (!projetos || projetos.length === 0) return [];

      // Fetch all sites for these projects
      const { data: allSites } = await supabase
        .from("sites")
        .select("id, projeto_id")
        .in("projeto_id", projetoIds);

      const sitesByProjeto: Record<string, string[]> = {};
      (allSites || []).forEach(s => {
        if (!sitesByProjeto[s.projeto_id]) sitesByProjeto[s.projeto_id] = [];
        sitesByProjeto[s.projeto_id].push(s.id);
      });

      const allSiteIds = (allSites || []).map(s => s.id);

      // Fetch escopo for all sites at once
      const { data: escopoItens } = allSiteIds.length > 0
        ? await supabase.from("escopo_itens").select("site_id, quantidade, custo_unitario, valor_unitario").in("site_id", allSiteIds)
        : { data: [] };

      // Fetch ERP costs for all projects
      let erpQuery = (supabase as any).from("custo_real_erp").select("projeto_id, categoria_interna, valor")
        .in("projeto_id", projetoIds);
      if (startDate) {
        erpQuery = erpQuery.gte("data_pagamento", startDate).lte("data_pagamento", endDate);
      }
      const { data: erpData } = await erpQuery;

      // Build rows
      const result: ProjetoRow[] = projetos.map((p: any) => {
        const mySiteIds = sitesByProjeto[p.id] || [];
        const myEscopo = (escopoItens || []).filter((e: any) => mySiteIds.includes(e.site_id));

        let custoOrcado = 0;
        let valorProduzido = 0;
        for (const item of myEscopo) {
          custoOrcado += Number(item.custo_unitario || 0) * Number(item.quantidade || 0);
          valorProduzido += Number(item.valor_unitario || 0) * Number(item.quantidade || 0);
        }

        const myErp = (erpData || []).filter((e: any) => e.projeto_id === p.id);
        const categorias: Record<string, number> = {};
        CATEGORIAS.forEach(cat => { categorias[cat] = 0; });
        myErp.forEach((e: any) => {
          const cat = e.categoria_interna || "Indiretos";
          if (categorias[cat] !== undefined) {
            categorias[cat] += Number(e.valor || 0);
          } else {
            categorias["Indiretos"] += Number(e.valor || 0);
          }
        });

        const totalErp = Object.values(categorias).reduce((a, b) => a + b, 0);

        const areaName = p.areas?.nome || "-";
        const clienteName = p.clientes?.razao_social || "-";

        return {
          id: p.id,
          codigo: p.codigo,
          nome: p.nome,
          area: areaName,
          cliente: clienteName,
          valorProduzido,
          custoOrcado,
          categorias,
          totalErp,
        };
      });

      return result;
    },
    enabled: projetoIds.length > 0,
  });

  // Totals
  const totals = {
    valorProduzido: rows.reduce((a, r) => a + r.valorProduzido, 0),
    custoOrcado: rows.reduce((a, r) => a + r.custoOrcado, 0),
    categorias: CATEGORIAS.reduce((acc, cat) => {
      acc[cat] = rows.reduce((a, r) => a + (r.categorias[cat] || 0), 0);
      return acc;
    }, {} as Record<string, number>),
    totalErp: rows.reduce((a, r) => a + r.totalErp, 0),
  };

  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle>Matriz de Custos</CardTitle>
        <CardDescription>Produção, Custo Orçado, Despesas por Categoria e Total Real (ERP)</CardDescription>
      </CardHeader>
      <ScrollArea className="w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-semibold border-r">Área</th>
                <th className="py-3 px-4 font-semibold border-r">Projeto</th>
                <th className="py-3 px-4 font-semibold border-r">Cliente</th>
                <th className="py-3 px-4 font-semibold text-right bg-emerald-50 dark:bg-emerald-950/30 border-r">
                  Produção (R$)
                </th>
                <th className="py-3 px-4 font-semibold text-right bg-blue-50 dark:bg-blue-950/30 border-r">
                  Custo Orçado (R$)
                </th>
                {CATEGORIAS.map((cat) => (
                  <th key={cat} className="py-3 px-4 font-semibold text-right border-r last:border-r-0">
                    {cat} (R$)
                  </th>
                ))}
                <th className="py-3 px-4 font-semibold text-right bg-red-50 dark:bg-red-950/30 border-l-2 border-primary/20">
                  Total Despesas (R$)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors border-b">
                  <td className="py-2.5 px-4 border-r truncate max-w-[120px]">{row.area}</td>
                  <td className="py-2.5 px-4 border-r font-medium truncate max-w-[200px]">
                    {row.codigo} - {row.nome}
                  </td>
                  <td className="py-2.5 px-4 border-r truncate max-w-[160px]">{row.cliente}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/10 border-r">
                    {formatCurrency(row.valorProduzido)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-blue-600 bg-blue-50/50 dark:bg-blue-950/10 border-r">
                    {formatCurrency(row.custoOrcado)}
                  </td>
                  {CATEGORIAS.map((cat) => (
                    <td key={cat} className="py-2.5 px-4 text-right font-mono border-r last:border-r-0">
                      {formatCurrency(row.categorias[cat] || 0)}
                    </td>
                  ))}
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-destructive bg-red-50/50 dark:bg-red-950/10 border-l-2 border-primary/20">
                    {formatCurrency(row.totalErp)}
                  </td>
                </tr>
              ))}
              {rows.length > 1 && (
                <tr className="bg-muted/50 font-bold border-t-2">
                  <td className="py-3 px-4 border-r" colSpan={3}>Total</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/10 border-r">
                    {formatCurrency(totals.valorProduzido)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-600 bg-blue-50/50 dark:bg-blue-950/10 border-r">
                    {formatCurrency(totals.custoOrcado)}
                  </td>
                  {CATEGORIAS.map((cat) => (
                    <td key={cat} className="py-3 px-4 text-right font-mono border-r last:border-r-0">
                      {formatCurrency(totals.categorias[cat] || 0)}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right font-mono font-bold text-destructive bg-red-50/50 dark:bg-red-950/10 border-l-2 border-primary/20">
                    {formatCurrency(totals.totalErp)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Card>
  );
}
