import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface MkpImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportItem {
  obra_codigo: string;
  perc_custo_direto: number;
  perc_gerencia: number;
  perc_risco: number;
  perc_treinamento: number;
  perc_inflacao: number;
  projeto_id?: string;
  projeto_nome?: string;
}

export function MkpImportModal({ isOpen, onClose }: MkpImportModalProps) {
  const [rawData, setRawData] = useState("");
  const [preview, setPreview] = useState<ImportItem[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projetos } = useQuery({
    queryKey: ["projetos_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, codigo, nome");
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const handleProcess = () => {
    if (!rawData.trim()) return;

    const lines = rawData.trim().split("\n");
    const items: ImportItem[] = lines.map((line) => {
      const cols = line.split("\t");
      const obra_codigo = cols[0]?.trim() || "";
      
      // Tenta associar ao projeto pelo código da obra (VLOOKUP interno)
      const projeto = projetos?.find(p => p.codigo === obra_codigo);

      const parsePerc = (val: string) => {
        if (!val) return 0;
        const clean = val.replace("%", "").replace(",", ".").trim();
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num / 100;
      };

      return {
        obra_codigo,
        perc_custo_direto: parsePerc(cols[1]),
        perc_gerencia: parsePerc(cols[2]),
        perc_risco: parsePerc(cols[3]),
        perc_treinamento: parsePerc(cols[4]),
        perc_inflacao: parsePerc(cols[5]),
        projeto_id: projeto?.id,
        projeto_nome: projeto?.nome,
      };
    });

    setPreview(items);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const toInsert = preview
        .filter(item => item.projeto_id) // Só importa se achou o projeto
        .map(item => ({
          projeto_id: item.projeto_id,
          obra_codigo: item.obra_codigo,
          perc_custo_direto: item.perc_custo_direto,
          perc_gerencia: item.perc_gerencia,
          perc_risco: item.perc_risco,
          perc_treinamento: item.perc_treinamento,
          perc_inflacao: item.perc_inflacao,
          // MB e BDI serão calculados no modal ou gatilho, mas aqui calculamos o MB básico
          perc_mb_esperado: 1 - (item.perc_custo_direto + item.perc_gerencia + item.perc_risco + item.perc_treinamento + item.perc_inflacao),
          bdi_venda: 1.0, // Default, será ajustado na edição individual
        }));

      if (toInsert.length === 0) throw new Error("Nenhum item válido para importar.");

      const { error } = await supabase
        .from("mkp_parametros")
        .upsert(toInsert, { onConflict: "projeto_id" });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mkp_parametros"] });
      toast({ title: "Sucesso", description: `${preview.length} parâmetros importados.` });
      setRawData("");
      setPreview([]);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Parâmetros do Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Cole as colunas na ordem: <strong>Código Obra | % Custo Dir. | % Gerência | % Risco | % Trein. | % Inflação</strong>
            </p>
            <Textarea
              placeholder="Cole aqui os dados tabulados..."
              rows={5}
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
            />
            <Button variant="secondary" onClick={handleProcess}>Processar Dados</Button>
          </div>

          {preview.length > 0 && (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Obra</TableHead>
                    <TableHead>Projeto Detectado</TableHead>
                    <TableHead className="text-right">% CD</TableHead>
                    <TableHead className="text-right">% Ger</TableHead>
                    <TableHead className="text-right">% MB Est.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((item, idx) => (
                    <TableRow key={idx} className={!item.projeto_id ? "bg-red-50" : ""}>
                      <TableCell>{item.obra_codigo}</TableCell>
                      <TableCell>
                        {item.projeto_nome || <span className="text-destructive">Não encontrado</span>}
                      </TableCell>
                      <TableCell className="text-right">{(item.perc_custo_direto * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{(item.perc_gerencia * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-right">
                        {( (1 - (item.perc_custo_direto + item.perc_gerencia + item.perc_risco + item.perc_treinamento + item.perc_inflacao)) * 100 ).toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={() => importMutation.mutate()} 
            disabled={preview.length === 0 || importMutation.isPending}
          >
            {importMutation.isPending ? "Importando..." : "Confirmar Importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
