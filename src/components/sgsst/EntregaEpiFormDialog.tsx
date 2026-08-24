import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstEpiEntregaInput, MotivoEntregaEpi, useSgsstEpis } from "@/hooks/sgsst/useSgsstEpis";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";
import { PackageCheck, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface EntregaEpiFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: SgsstEpiEntregaInput) => Promise<void>;
  isLoading?: boolean;
}

export function EntregaEpiFormDialog({
  open,
  onOpenChange,
  onSave,
  isLoading = false,
}: EntregaEpiFormDialogProps) {
  const { colaboradores } = useSgsstColaboradoresResumo();
  const { epis } = useSgsstEpis();

  const [colaboradorId, setColaboradorId] = useState("");
  const [epiId, setEpiId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [dataEntrega, setDataEntrega] = useState("");
  const [motivo, setMotivo] = useState<MotivoEntregaEpi>("PRIMEIRA_ENTREGA");
  const [tamanhoModelo, setTamanhoModelo] = useState("");
  const [observacao, setObservacao] = useState("");
  // NR-06 6.6.1 "d": orientar o trabalhador sobre uso, guarda e conservacao. O
  // padrao e falso de proposito — marcar por padrao transformaria a exigencia da
  // norma em texto decorativo que ninguem le.
  const [orientacaoUso, setOrientacaoUso] = useState(false);

  useEffect(() => {
    setColaboradorId("");
    setEpiId("");
    setQuantidade(1);
    setDataEntrega(new Date().toISOString().split("T")[0]);
    setMotivo("PRIMEIRA_ENTREGA");
    setTamanhoModelo("");
    setObservacao("");
    setOrientacaoUso(false);
  }, [open]);

  const selectedEpi = epis.find((e) => e.id === epiId);
  const caVencido = selectedEpi?.statusValidadeCa === "VENCIDO";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colaboradorId || !epiId || caVencido) return;

    await onSave({
      colaborador_id: colaboradorId,
      epi_id: epiId,
      quantidade: Number(quantidade) || 1,
      data_entrega: dataEntrega || new Date().toISOString().split("T")[0],
      motivo,
      tamanho_modelo: tamanhoModelo.trim() || null,
      confirmacao_recebimento: true,
      observacao: observacao.trim() || null,
      orientacao_uso: orientacaoUso,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            Registrar Entrega / Substituição de EPI ao Colaborador
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="colab">Colaborador / Trabalhador Beneficiário *</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger id="colab">
                <SelectValue placeholder="Selecione o trabalhador..." />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayNome} (CPF: {c.cpf || "—"}) — {c.funcao || "Sem função"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="epi">Equipamento de Proteção Individual (EPI) *</Label>
            <Select value={epiId} onValueChange={setEpiId}>
              <SelectTrigger id="epi">
                <SelectValue placeholder="Selecione o EPI no catálogo..." />
              </SelectTrigger>
              <SelectContent>
                {epis.map((e) => {
                  const isVencido = e.statusValidadeCa === "VENCIDO";
                  return (
                    <SelectItem key={e.id} value={e.id} disabled={isVencido}>
                      {e.nome} (CA: {e.ca}) — Saldo: {e.estoque_atual} {e.unidade_medida} {isVencido ? "[CA VENCIDO - BLOQUEADO]" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {caVencido && (
            <div className="bg-red-50 text-red-800 p-3 rounded border border-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <span>O CA deste EPI está vencido! A regulamentação da NR-6 proíbe a entrega de equipamentos com CA vencido.</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qtd">Quantidade *</Label>
              <Input
                id="qtd"
                type="number"
                min={1}
                max={selectedEpi?.estoque_atual || 100}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataEnt">Data da Entrega *</Label>
              <Input
                id="dataEnt"
                type="date"
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo da Entrega *</Label>
              <Select value={motivo} onValueChange={(val: MotivoEntregaEpi) => setMotivo(val)}>
                <SelectTrigger id="motivo">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMEIRA_ENTREGA">Primeira Entrega</SelectItem>
                  <SelectItem value="SUBSTITUICAO">Substituição Periódica</SelectItem>
                  <SelectItem value="PERDA">Extravio / Perda</SelectItem>
                  <SelectItem value="DANIFICADO">EPI Danificado</SelectItem>
                  <SelectItem value="VENCIMENTO">Validade Vencida</SelectItem>
                  <SelectItem value="OUTROS">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tam">Tamanho / Especificação do Modelo</Label>
            <Input
              id="tam"
              placeholder="Ex: Tamanho P, M, G, Calçado N° 41"
              value={tamanhoModelo}
              onChange={(e) => setTamanhoModelo(e.target.value)}
            />
          </div>

          {/* NR-06 6.6.1 alínea "d" */}
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <Checkbox
              id="orientacao"
              checked={orientacaoUso}
              onCheckedChange={(v) => setOrientacaoUso(v === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor="orientacao" className="text-xs font-semibold cursor-pointer">
                Trabalhador orientado quanto ao uso, guarda e conservação
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Exigência da NR-06 item 6.6.1 alínea "d". A ficha de entrega mostra esta
                marcação por fornecimento — entrega sem orientação sai apontada.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações / Termo de Recebimento</Label>
            <Textarea
              id="obs"
              placeholder="Declaro ter recebido o EPI acima em perfeitas condições e orientado sobre seu uso correto (NR-6)..."
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !colaboradorId || !epiId || caVencido}>
              {isLoading ? "Salvando..." : "Confirmar & Registrar Entrega"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
