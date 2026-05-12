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
import { Plus, Search, Edit2, Trash2, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MkpParametrosModal } from "@/components/configuracoes/mkp/MkpParametrosModal";
import { MkpImportModal } from "@/components/configuracoes/mkp/MkpImportModal";
import { format } from "date-fns";

export default function MkpParametrosPage() {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: parametros, isLoading } = useQuery({
    queryKey: ["mkp_parametros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkp_parametros")
        .select(`
          *,
          projetos (
            nome,
            codigo
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
        .from("mkp_parametros")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mkp_parametros"] });
      toast({ title: "Sucesso", description: "Parâmetro removido com sucesso." });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredParametros = parametros?.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.projetos?.nome?.toLowerCase().includes(term) ||
      p.obra_codigo?.toLowerCase().includes(term) ||
      p.area?.toLowerCase().includes(term)
    );
  });

  const formatPerc = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2 }).format(val);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Parâmetros MKP — Percentuais por Projeto</h1>
        <p className="text-muted-foreground">
          Configure os % do orçamento/markup para comparação com resultado real
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            Importar do Excel
          </Button>
          <Button onClick={() => { setEditingId(null); setIsModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Novo
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projeto</TableHead>
              <TableHead>Área</TableHead>
              <TableHead className="text-right">% Custo Dir.</TableHead>
              <TableHead className="text-right">% Gerência</TableHead>
              <TableHead className="text-right">% Risco</TableHead>
              <TableHead className="text-right">% Trein.</TableHead>
              <TableHead className="text-right">% Inflação</TableHead>
              <TableHead className="text-right">% MB Alvo</TableHead>
              <TableHead className="text-right">BDI</TableHead>
              <TableHead>Atualizado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center h-24 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredParametros?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center h-24 text-muted-foreground">
                  Nenhum parâmetro encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredParametros?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.projetos?.nome}</div>
                    <div className="text-xs text-muted-foreground">{p.obra_codigo}</div>
                  </TableCell>
                  <TableCell className="capitalize">{p.area?.replace("_", " ") || "—"}</TableCell>
                  <TableCell className="text-right">{formatPerc(p.perc_custo_direto)}</TableCell>
                  <TableCell className="text-right">{formatPerc(p.perc_gerencia)}</TableCell>
                  <TableCell className="text-right">{formatPerc(p.perc_risco)}</TableCell>
                  <TableCell className="text-right">{formatPerc(p.perc_treinamento)}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {formatPerc(p.perc_mb_esperado)}
                  </TableCell>
                  <TableCell className="text-right">{p.bdi_venda.toFixed(4)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.updated_at ? format(new Date(p.updated_at), "dd/MM/yyyy HH:mm") : "—"}
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
                          if (confirm("Tem certeza que deseja excluir este parâmetro?")) {
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

      <MkpParametrosModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        id={editingId}
      />

      <MkpImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />
    </div>
  );
}
