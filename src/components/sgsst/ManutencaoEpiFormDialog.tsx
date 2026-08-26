import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, AlertTriangle } from "lucide-react";
import {
  TIPO_MANUTENCAO_LABEL,
  TIPO_MANUTENCAO_AJUDA,
  RESULTADO_MANUTENCAO_LABEL,
  proximaPrevista,
  type TipoManutencaoEpi,
  type ResultadoManutencaoEpi,
} from "@/utils/sgsstEpiHigienizacao";
import {
  useSgsstEpis,
  type SgsstEpiManutencaoInput,
  type SgsstEpiEntrega,
} from "@/hooks/sgsst/useSgsstEpis";

/**
 * Registro de higienização, manutenção ou inspeção de EPI — NR-06 6.6.1 alínea "f".
 *
 * Duas coisas que a tela decide, e que valem registro:
 *
 * 1. **A próxima execução é calculada, não digitada.** A periodicidade está no
 *    cadastro do EPI; recalcular de cabeça a cada lançamento é onde o erro entra. O
 *    campo continua editável, porque um caso excepcional existe.
 *
 * 2. **Descarte avisa o que vai acontecer com o estoque antes de salvar.** Condenar
 *    itens do estoque baixa o estoque; condenar a peça que está com o trabalhador
 *    não mexe em nada, porque ela já saiu na entrega. As duas coisas surpreendem
 *    quem não foi avisado.
 */

interface ManutencaoEpiFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: SgsstEpiManutencaoInput) => Promise<void>;
  isLoading?: boolean;
  /** Quando vem de uma entrega específica, o EPI já está definido. */
  entregaVinculada?: SgsstEpiEntrega | null;
}

function hojeIso(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function ManutencaoEpiFormDialog({
  open,
  onOpenChange,
  onSave,
  isLoading = false,
  entregaVinculada,
}: ManutencaoEpiFormDialogProps) {
  const { epis } = useSgsstEpis({ pageSize: 200 });

  const [epiId, setEpiId] = useState("");
  const [tipo, setTipo] = useState<TipoManutencaoEpi>("HIGIENIZACAO");
  const [dataExecucao, setDataExecucao] = useState(hojeIso());
  const [quantidade, setQuantidade] = useState(1);
  const [executadoPorNome, setExecutadoPorNome] = useState("");
  const [resultado, setResultado] = useState<ResultadoManutencaoEpi>("APROVADO");
  const [proximaEm, setProximaEm] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!open) return;

    setEpiId(entregaVinculada?.epi_id ?? "");
    setTipo("HIGIENIZACAO");
    setDataExecucao(hojeIso());
    setQuantidade(entregaVinculada?.quantidade ?? 1);
    setExecutadoPorNome("");
    setResultado("APROVADO");
    setProximaEm("");
    setObservacao("");
  }, [open, entregaVinculada]);

  const epiSelecionado = epis.find((e) => e.id === epiId);

  // A próxima execução vem da periodicidade do cadastro. Recalcular de cabeça a
  // cada lançamento é onde o erro entra.
  const sugestaoProxima = proximaPrevista(
    dataExecucao,
    epiSelecionado?.higienizacao_periodicidade_dias ?? null
  );

  useEffect(() => {
    if (sugestaoProxima) setProximaEm(sugestaoProxima);
  }, [sugestaoProxima]);

  const descarteDoEstoque = resultado === "DESCARTADO" && !entregaVinculada;
  const descarteComTrabalhador = resultado === "DESCARTADO" && !!entregaVinculada;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!epiId) return;

    await onSave({
      epi_id: epiId,
      entrega_id: entregaVinculada?.id ?? null,
      tipo,
      data_execucao: dataExecucao || hojeIso(),
      quantidade: Number(quantidade) || 1,
      executado_por_nome: executadoPorNome.trim() || null,
      resultado,
      proxima_prevista: proximaEm || null,
      observacao: observacao.trim() || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Registrar Higienização / Manutenção de EPI
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          {entregaVinculada ? (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-xs font-semibold">
                Execução sobre a peça entregue ao trabalhador
              </p>
              <p className="text-[11px] text-muted-foreground">
                {entregaVinculada.epi?.nome} · entregue em{" "}
                {entregaVinculada.data_entrega} ·{" "}
                {entregaVinculada.colaborador?.profile?.nome ||
                  entregaVinculada.colaborador?.recurso?.nome ||
                  entregaVinculada.colaborador?.nome ||
                  "trabalhador"}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="epiManut">Equipamento *</Label>
              <Select value={epiId} onValueChange={setEpiId}>
                <SelectTrigger id="epiManut">
                  <SelectValue placeholder="Selecione o EPI do catálogo..." />
                </SelectTrigger>
                <SelectContent>
                  {epis.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome} (CA {e.ca}) — estoque {e.estoque_atual}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Sem vínculo com entrega, a execução é sobre os itens em estoque.
              </p>
            </div>
          )}

          {epiSelecionado && !epiSelecionado.exige_higienizacao && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Este EPI está cadastrado como <strong>descartável</strong> (sem
                higienização exigida). O registro é aceito, mas o painel não vai cobrar
                periodicidade dele. Se for reutilizável, marque a exigência no cadastro.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipoManut">Tipo *</Label>
              <Select value={tipo} onValueChange={(v: TipoManutencaoEpi) => setTipo(v)}>
                <SelectTrigger id="tipoManut">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_MANUTENCAO_LABEL) as TipoManutencaoEpi[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_MANUTENCAO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataManut">Data da execução *</Label>
              <Input
                id="dataManut"
                type="date"
                value={dataExecucao}
                onChange={(e) => setDataExecucao(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qtdManut">Quantidade *</Label>
              <Input
                id="qtdManut"
                type="number"
                min={1}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {TIPO_MANUTENCAO_AJUDA[tipo]}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="execPor">Executado por</Label>
              <Input
                id="execPor"
                placeholder="Ex: Lavanderia Industrial XYZ"
                value={executadoPorNome}
                onChange={(e) => setExecutadoPorNome(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Costuma ser terceiro — lavanderia ou assistência do fabricante.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resultManut">Resultado *</Label>
              <Select
                value={resultado}
                onValueChange={(v: ResultadoManutencaoEpi) => setResultado(v)}
              >
                <SelectTrigger id="resultManut">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(RESULTADO_MANUTENCAO_LABEL) as ResultadoManutencaoEpi[]
                  ).map((r) => (
                    <SelectItem key={r} value={r}>
                      {RESULTADO_MANUTENCAO_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* O efeito no estoque é dito antes de salvar, não descoberto depois. */}
          {descarteDoEstoque && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-[11px] text-red-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                O descarte vai <strong>baixar {quantidade} unidade(s) do estoque</strong>{" "}
                deste EPI. Equipamento condenado deixou de existir — manter o estoque
                faria a tela seguir oferecendo para entrega uma peça que foi para o lixo.
              </p>
            </div>
          )}

          {descarteComTrabalhador && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                A peça está com o trabalhador, então o estoque não muda — ela já saiu na
                entrega. Registre a <strong>substituição imediata</strong> como nova
                entrega, conforme a NR-06 6.6.1 alínea "e".
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="proxManut">Próxima execução prevista</Label>
            <Input
              id="proxManut"
              type="date"
              value={proximaEm}
              onChange={(e) => setProximaEm(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {epiSelecionado?.higienizacao_periodicidade_dias
                ? `Calculada pela periodicidade do cadastro (${epiSelecionado.higienizacao_periodicidade_dias} dias). Pode ser ajustada.`
                : "Este EPI não tem periodicidade cadastrada, então nada foi calculado — informe a data se houver."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obsManut">Observação</Label>
            <Textarea
              id="obsManut"
              rows={2}
              placeholder="Componente substituído, laudo do fabricante, motivo do descarte..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !epiId}>
              {isLoading ? "Salvando..." : "Registrar execução"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
