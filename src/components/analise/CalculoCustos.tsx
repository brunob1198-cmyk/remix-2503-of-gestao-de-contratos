import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";

function fmt(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(2)}`;
}

interface DiarioResumo {
  id: string;
  data: string;
  producoes: Array<{ codigo: string; descricao: string; quantidade: number; valorTotal: number }>;
  equipe: Array<{ nome: string; horas: number; custoTotal: number }>;
  equipamentos: Array<{ descricao: string; horas: number; custoTotal: number }>;
  veiculos: Array<{ descricao: string; placa: string | null; custoDiaria: number }>;
  totalProducao: number;
  totalCusto: number;
  margem: number;
}

export function CalculoCustos({ siteId }: { siteId: string }) {
  const [diarioSelecionado, setDiarioSelecionado] = useState<string>("");

  // Fetch all diários for this site
  const { data: diarios = [], isLoading } = useQuery({
    queryKey: ["calculo_custos_diarios", siteId],
    queryFn: async () => {
      const { data: ds } = await supabase
        .from("diarios_obra")
        .select("id, data")
        .eq("site_id", siteId)
        .order("data", { ascending: false });
      return ds || [];
    },
    enabled: !!siteId,
  });

  // Fetch detail for selected diário
  const { data: detalhe, isLoading: loadingDetalhe } = useQuery({
    queryKey: ["calculo_custos_detalhe", diarioSelecionado],
    queryFn: async (): Promise<DiarioResumo | null> => {
      if (!diarioSelecionado) return null;
      const d = diarios.find(x => x.id === diarioSelecionado);
      if (!d) return null;

      const [prodRes, eqRes, eqpRes, vecRes] = await Promise.all([
        supabase.from("diario_producao").select("*, item_lpu:itens_lpu(codigo, descricao, unidade, preco_unitario)").eq("diario_id", diarioSelecionado),
        supabase.from("diario_equipe").select("*").eq("diario_id", diarioSelecionado),
        supabase.from("diario_equipamentos").select("*").eq("diario_id", diarioSelecionado),
        supabase.from("diario_veiculos").select("*").eq("diario_id", diarioSelecionado),
      ]);

      const producoes = (prodRes.data || []).map(p => ({
        codigo: (p.item_lpu as any)?.codigo || "",
        descricao: (p.item_lpu as any)?.descricao || "",
        quantidade: Number(p.quantidade),
        valorTotal: Number(p.valor_total),
      }));

      const equipe = (eqRes.data || []).map(e => ({
        nome: e.nome,
        horas: Number(e.horas),
        custoTotal: Number(e.custo_total),
      }));

      const equipamentos = (eqpRes.data || []).map(e => ({
        descricao: e.descricao,
        horas: Number(e.horas),
        custoTotal: Number(e.custo_total),
      }));

      const veiculos = (vecRes.data || []).map(v => ({
        descricao: v.descricao,
        placa: v.placa,
        custoDiaria: Number(v.custo_diaria),
      }));

      const totalProducao = producoes.reduce((s, p) => s + p.valorTotal, 0);
      const custoEquipe = equipe.reduce((s, e) => s + e.custoTotal, 0);
      const custoEquipamentos = equipamentos.reduce((s, e) => s + e.custoTotal, 0);
      const custoVeiculos = veiculos.reduce((s, v) => s + v.custoDiaria, 0);
      const totalCusto = custoEquipe + custoEquipamentos + custoVeiculos;

      return {
        id: diarioSelecionado,
        data: d.data,
        producoes,
        equipe,
        equipamentos,
        veiculos,
        totalProducao,
        totalCusto,
        margem: totalProducao - totalCusto,
      };
    },
    enabled: !!diarioSelecionado,
  });

  // Fetch accumulated cost by service (all diários)
  const { data: custosPorServico = [] } = useQuery({
    queryKey: ["custos_por_servico", siteId],
    queryFn: async () => {
      const { data: ds } = await supabase
        .from("diarios_obra")
        .select("id")
        .eq("site_id", siteId);
      const ids = ds?.map(d => d.id) || [];
      if (ids.length === 0) return [];

      let allProd: any[] = [];
      let allCusto = 0;

      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const [prodRes, eqRes, eqpRes, vecRes] = await Promise.all([
          supabase.from("diario_producao").select("*, item_lpu:itens_lpu(codigo, descricao)").in("diario_id", chunk),
          supabase.from("diario_equipe").select("custo_total").in("diario_id", chunk),
          supabase.from("diario_equipamentos").select("custo_total").in("diario_id", chunk),
          supabase.from("diario_veiculos").select("custo_diaria").in("diario_id", chunk),
        ]);
        allProd = [...allProd, ...(prodRes.data || [])];
        allCusto += (eqRes.data || []).reduce((s, e) => s + Number(e.custo_total), 0);
        allCusto += (eqpRes.data || []).reduce((s, e) => s + Number(e.custo_total), 0);
        allCusto += (vecRes.data || []).reduce((s, v) => s + Number(v.custo_diaria), 0);
      }

      // Group production by item code
      const map = new Map<string, { codigo: string; descricao: string; receita: number }>();
      let totalReceita = 0;
      allProd.forEach(p => {
        const item = p.item_lpu as any;
        if (!item) return;
        const key = item.codigo;
        const ex = map.get(key) || { codigo: item.codigo, descricao: item.descricao, receita: 0 };
        ex.receita += Number(p.valor_total);
        totalReceita += Number(p.valor_total);
        map.set(key, ex);
      });

      return Array.from(map.values()).map(s => {
        const ratio = totalReceita > 0 ? s.receita / totalReceita : 0;
        const custoRateado = allCusto * ratio;
        return {
          ...s,
          custo: custoRateado,
          margem: s.receita - custoRateado,
          margemPct: s.receita > 0 ? ((s.receita - custoRateado) / s.receita) * 100 : 0,
        };
      }).sort((a, b) => b.receita - a.receita);
    },
    enabled: !!siteId,
  });

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  const chartData = custosPorServico.slice(0, 8).map(s => ({
    name: s.codigo,
    Receita: Math.round(s.receita),
    Custo: Math.round(s.custo),
  }));

  return (
    <div className="space-y-6">
      {/* Daily selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">📅 Resultado do Dia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={diarioSelecionado} onValueChange={setDiarioSelecionado}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Selecione uma data" />
            </SelectTrigger>
            <SelectContent>
              {diarios.map(d => (
                <SelectItem key={d.id} value={d.id}>
                  {format(new Date(d.data + "T12:00:00"), "dd/MM/yyyy")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {loadingDetalhe && <Skeleton className="h-48 w-full" />}

          {detalhe && (
            <div className="space-y-4">
              {/* Produção */}
              <div>
                <p className="font-medium text-sm mb-2">🧱 Produção</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2">Item</th>
                        <th className="text-right px-3 py-2">Qtd</th>
                        <th className="text-right px-3 py-2">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.producoes.map((p, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{p.descricao}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{p.quantidade}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(p.valorTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-right text-sm font-semibold mt-1 tabular-nums">Subtotal: {fmt(detalhe.totalProducao)}</p>
              </div>

              {/* Apontamento */}
              <div>
                <p className="font-medium text-sm mb-2">👷 Apontamento (Custo)</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {/* Equipe */}
                  <div className="border rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">👤 Pessoas</p>
                    {detalhe.equipe.map((e, i) => (
                      <div key={i} className="flex justify-between text-sm py-0.5">
                        <span>{e.nome} ({e.horas}h)</span>
                        <span className="tabular-nums">{fmt(e.custoTotal)}</span>
                      </div>
                    ))}
                    {detalhe.equipe.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                  </div>

                  {/* Equipamentos */}
                  <div className="border rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">🚜 Equipamentos</p>
                    {detalhe.equipamentos.map((e, i) => (
                      <div key={i} className="flex justify-between text-sm py-0.5">
                        <span>{e.descricao} ({e.horas}h)</span>
                        <span className="tabular-nums">{fmt(e.custoTotal)}</span>
                      </div>
                    ))}
                    {detalhe.equipamentos.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                  </div>

                  {/* Veículos */}
                  <div className="border rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">🚛 Veículos</p>
                    {detalhe.veiculos.map((v, i) => (
                      <div key={i} className="flex justify-between text-sm py-0.5">
                        <span>{v.descricao} {v.placa && `(${v.placa})`}</span>
                        <span className="tabular-nums">{fmt(v.custoDiaria)}</span>
                      </div>
                    ))}
                    {detalhe.veiculos.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                  </div>
                </div>
                <p className="text-right text-sm font-semibold mt-2 tabular-nums">Total custo: {fmt(detalhe.totalCusto)}</p>
              </div>

              {/* Resultado */}
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="font-medium text-sm mb-2">📊 Resultado do Dia</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Produção</p>
                    <p className="text-lg font-bold tabular-nums">{fmt(detalhe.totalProducao)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Custo</p>
                    <p className="text-lg font-bold tabular-nums">{fmt(detalhe.totalCusto)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Margem</p>
                    <p className={`text-lg font-bold tabular-nums ${detalhe.margem >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {fmt(detalhe.margem)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custo acumulado por serviço */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">🏗️ Custo Acumulado por Serviço</CardTitle>
        </CardHeader>
        <CardContent>
          {custosPorServico.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Sem dados de produção para este site</p>
          ) : (
            <>
              {chartData.length > 1 && (
                <div className="mb-6">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="Receita" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Custo" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="space-y-2">
                {custosPorServico.map(s => (
                  <div key={s.codigo} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                    <div className="flex-1">
                      <span className="font-medium">{s.codigo}</span>
                      <span className="text-muted-foreground ml-2">{s.descricao}</span>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-xs text-muted-foreground">Receita</p>
                        <p className="tabular-nums">{fmt(s.receita)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Custo</p>
                        <p className="tabular-nums">{fmt(s.custo)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Margem</p>
                        <p className={`tabular-nums font-medium ${s.margemPct >= 20 ? "text-emerald-600" : s.margemPct >= 10 ? "text-amber-600" : "text-red-600"}`}>
                          {fmt(s.margem)}
                        </p>
                      </div>
                      <Badge variant="outline" className={
                        s.margemPct >= 20 ? "border-emerald-500 text-emerald-700" :
                        s.margemPct >= 10 ? "border-amber-500 text-amber-700" :
                        "border-red-500 text-red-700"
                      }>
                        {s.margemPct.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
