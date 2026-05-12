import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImpostosModal } from "@/components/configuracoes/impostos/ImpostosModal";

export default function ConfigImpostosPage() {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: impostos, isLoading } = useQuery({
    queryKey: ["projeto_impostos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_impostos")
        .select(`
          *,
          projetos (
            nome,
            codigo,
            area_analise
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projeto_impostos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto_impostos"] });
      toast({ title: "Sucesso", description: "Configuração removida com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredImpostos = impostos?.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.projetos?.nome?.toLowerCase().includes(term) ||
      p.projetos?.codigo?.toLowerCase().includes(term)
    );
  });

  const formatPerc = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2 }).format(val);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="space-y-6">
      <div className="hidden">
        <h1 className="text-3xl font-bold tracking-tight">Alíquotas de Imposto — Configuração por Projeto</h1>
        <p className="text-muted-foreground">
          Configure os impostos de venda de cada projeto para calcular a Receita Líquida
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar projeto..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={() => { setEditingId(null); setIsModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Configurar Projeto
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projeto</TableHead>
              <TableHead>Área</TableHead>
              <TableHead className="text-right">ISSQN</TableHead>
              <TableHead className="text-right">PIS</TableHead>
              <TableHead className="text-right">COFINS</TableHead>
              <TableHead className="text-right">INSS</TableHead>
              <TableHead className="text-right">DARA</TableHead>
              <TableHead className="text-right">ICMS</TableHead>
              <TableHead className="text-right font-bold text-primary">TOTAL</TableHead>
              <TableHead className="text-right">Receita Líq.*</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center h-24 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredImpostos?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center h-24 text-muted-foreground">
                  Nenhuma configuração encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredImpostos?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.projetos?.nome}</div>
                    <div className="text-xs text-muted-foreground">{p.projetos?.codigo}</div>
                  </TableCell>
                  <TableCell className="capitalize">{p.projetos?.area_analise || "—"}</TableCell>
                  <TableCell className="text-right">{formatPerc(p.perc_issqn)}</TableCell>
                  <TableCell className="text-right">{formatPerc(p.perc_pis)}</TableCell>
                  <TableCell className="text-right">{formatPerc(p.perc_cofins)}</TableCell>
                  <TableCell className="text-right">{formatPerc(p.perc_inss)}</TableCell>
                  <TableCell className="text-right">{formatPerc(p.perc_dara)}</TableCell>
                  <TableCell className="text-right">{formatPerc(p.perc_icms)}</TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {formatPerc(p.perc_total_impostos)}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <div className="font-medium">{formatCurrency(100000 * (1 - p.perc_total_impostos))}</div>
                    <div className="text-muted-foreground">Para POC R$100k</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingId(p.id);
                          setIsModalOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Tem certeza que deseja excluir esta configuração?")) {
                            deleteMutation.mutate(p.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ImpostosModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        id={editingId}
      />
    </div>
  );
}
