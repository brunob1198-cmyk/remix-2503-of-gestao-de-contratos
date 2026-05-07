import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Plus, Trash2, Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface FCAEvento {
  id: string;
  fato: string;
  causa: string;
  acao: string;
}

interface FCAModalProps {
  projetoId: string;
  projetoNome: string;
  mesReferencia: string; // YYYY-MM
  mesLabel: string; // Ex: Mar/2026
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FCAModal({
  projetoId,
  projetoNome,
  mesReferencia,
  mesLabel,
  open,
  onOpenChange,
}: FCAModalProps) {
  const queryClient = useQueryClient();
  const [newFato, setNewFato] = useState("");
  const [newCausa, setNewCausa] = useState("");
  const [newAcao, setNewAcao] = useState("");

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["fca_eventos", projetoId, mesReferencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fca_eventos")
        .select("id, fato, causa, acao")
        .eq("projeto_id", projetoId)
        .eq("mes_referencia", mesReferencia)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as FCAEvento[];
    },
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: async (evento: Omit<FCAEvento, "id">) => {
      const { error } = await supabase.from("fca_eventos").insert([
        {
          projeto_id: projetoId,
          mes_referencia: mesReferencia,
          ...evento,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fca_eventos", projetoId, mesReferencia] });
      setNewFato("");
      setNewCausa("");
      setNewAcao("");
      toast.success("Evento FCA registrado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao adicionar FCA:", error);
      toast.error("Erro ao registrar evento FCA.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fca_eventos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fca_eventos", projetoId, mesReferencia] });
      toast.success("Evento removido.");
    },
  });

  const handleAdd = () => {
    if (!newFato || !newCausa || !newAcao) {
      toast.error("Preencha todos os campos.");
      return;
    }
    addMutation.mutate({ fato: newFato, causa: newCausa, acao: newAcao });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <DialogTitle>Análise FCA - {mesLabel}</DialogTitle>
          </div>
          <DialogDescription>
            Registro de Fato, Causa e Ação para o projeto: <strong>{projetoNome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto my-4 border rounded-md">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0">
              <TableRow>
                <TableHead className="w-[30%]">Fato</TableHead>
                <TableHead className="w-[30%]">Causa</TableHead>
                <TableHead className="w-[30%]">Ação</TableHead>
                <TableHead className="w-[10%] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : eventos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Nenhum desvio registrado para este período.
                  </TableCell>
                </TableRow>
              ) : (
                eventos.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="align-top whitespace-pre-wrap">{e.fato}</TableCell>
                    <TableCell className="align-top whitespace-pre-wrap">{e.causa}</TableCell>
                    <TableCell className="align-top whitespace-pre-wrap">{e.acao}</TableCell>
                    <TableCell className="text-center align-top">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteMutation.mutate(e.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-muted/20 rounded-lg border">
          <div className="space-y-1">
            <label className="text-xs font-medium px-1">Fato</label>
            <Input
              placeholder="O que aconteceu?"
              value={newFato}
              onChange={(e) => setNewFato(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium px-1">Causa</label>
            <Input
              placeholder="Por que aconteceu?"
              value={newCausa}
              onChange={(e) => setNewCausa(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="space-y-1 flex flex-col justify-end">
            <label className="text-xs font-medium px-1">Ação</label>
            <div className="flex gap-2">
              <Input
                placeholder="Como corrigir?"
                value={newAcao}
                onChange={(e) => setNewAcao(e.target.value)}
                className="bg-background"
              />
              <Button
                onClick={handleAdd}
                disabled={addMutation.isPending}
                className="shrink-0"
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
