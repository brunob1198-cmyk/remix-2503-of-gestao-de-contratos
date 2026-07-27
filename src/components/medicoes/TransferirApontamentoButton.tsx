import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, AlertTriangle, Loader2 } from "lucide-react";
import { useProjetos } from "@/hooks/useProjetos";
import { useTransferirDiario } from "@/hooks/useTransferirDiario";

interface TransferirApontamentoButtonProps {
  diarioId: string;
  currentDate: string;
  currentProjetoId?: string;
  onTransferredData?: (novaData: string) => void;
  onTransferredProjeto?: (result: { targetDiarioId: string; destinoSiteId: string; destinoProjetoId: string }) => void;
  /** Mutation opcional para mover de data. Se não informado, o popover só mostra a aba Projeto. */
  moverDiarioMutation?: {
    mutateAsync: (args: { diarioId: string; novaData: string }) => Promise<unknown>;
    isPending?: boolean;
  };
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
  label?: string;
}

export function TransferirApontamentoButton({
  diarioId,
  currentDate,
  currentProjetoId,
  onTransferredData,
  onTransferredProjeto,
  moverDiarioMutation,
  size = "default",
  variant = "outline",
  label = "Transferir Apontamento",
}: TransferirApontamentoButtonProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"data" | "projeto">(moverDiarioMutation ? "data" : "projeto");
  const [novaData, setNovaData] = useState(currentDate);
  const [destinoProjetoId, setDestinoProjetoId] = useState<string>("");

  const { projetos } = useProjetos();
  const { transferirParaProjeto } = useTransferirDiario();

  useEffect(() => {
    if (open) {
      setNovaData(currentDate);
      setDestinoProjetoId("");
      setTab(moverDiarioMutation ? "data" : "projeto");
    }
  }, [open, currentDate, moverDiarioMutation]);

  const projetosDestino = useMemo(
    () => (projetos || []).filter((p: any) => p.id !== currentProjetoId),
    [projetos, currentProjetoId]
  );

  const handleTransferirData = async () => {
    if (!moverDiarioMutation || !novaData || novaData === currentDate) return;
    try {
      await moverDiarioMutation.mutateAsync({ diarioId, novaData });
      onTransferredData?.(novaData);
      setOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransferirProjeto = async () => {
    if (!destinoProjetoId) return;
    try {
      const result = await transferirParaProjeto.mutateAsync({
        diarioId,
        destinoProjetoId,
        novaData: novaData !== currentDate ? novaData : undefined,
      });
      onTransferredProjeto?.({
        targetDiarioId: result.targetDiarioId,
        destinoSiteId: result.destinoSiteId,
        destinoProjetoId,
      });
      setOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} size={size} className="gap-2">
          <Copy className="h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-4" align="end">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "data" | "projeto")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="data" disabled={!moverDiarioMutation}>Outra Data</TabsTrigger>
            <TabsTrigger value="projeto">Outro Projeto</TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="space-y-3 mt-3">
            <div>
              <h4 className="font-medium text-sm mb-1">Mover para outra data</h4>
              <p className="text-xs text-muted-foreground">Todos os dados deste dia serão movidos.</p>
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
              />
              <Button
                onClick={handleTransferirData}
                disabled={!novaData || novaData === currentDate || moverDiarioMutation?.isPending}
              >
                {moverDiarioMutation?.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Transferir
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="projeto" className="space-y-3 mt-3">
            <div>
              <h4 className="font-medium text-sm mb-1">Transferir para outro projeto</h4>
              <p className="text-xs text-muted-foreground">
                O site atual será replicado no projeto destino (ou reutilizado se já existir com o mesmo código).
                O projeto destino precisa ter os mesmos itens da LPU (por código).
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Projeto destino</label>
              <Select value={destinoProjetoId} onValueChange={setDestinoProjetoId}>
                <SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                <SelectContent>
                  {projetosDestino.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Data (opcional)</label>
              <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
            </div>

            {transferirParaProjeto.isError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {(transferirParaProjeto.error as Error)?.message}
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full"
              onClick={handleTransferirProjeto}
              disabled={!destinoProjetoId || transferirParaProjeto.isPending}
            >
              {transferirParaProjeto.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Transferir Apontamento
            </Button>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

