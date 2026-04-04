import { useState, useEffect } from "react";
import { AtividadePlanejamento } from "@/hooks/usePlanejamento";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Save, X, Link2, Users } from "lucide-react";
import { format, addDays, parseISO } from "date-fns";
import { Recurso, RecursoAlocacao } from "@/hooks/useRecursos";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  adiantado: { label: "Adiantado", variant: "default" },
  no_prazo: { label: "No Prazo", variant: "secondary" },
  atrasado: { label: "Atrasado", variant: "destructive" },
  nao_iniciado: { label: "Não Iniciado", variant: "outline" },
  concluido: { label: "Concluído", variant: "default" },
};

interface Props {
  atividade: AtividadePlanejamento | null;
  onClose: () => void;
  allAtividades: AtividadePlanejamento[];
  onUpdate?: (data: any) => void;
  projetoRecursos?: Recurso[];
  atividadeRecursoIds?: string[];
  onUpdateRecursos?: (atividadeId: string, recursoIds: string[]) => void;
}

export function AtividadeDetailSheet({
  atividade,
  onClose,
  allAtividades,
  onUpdate,
  projetoRecursos = [],
  atividadeRecursoIds = [],
  onUpdateRecursos,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [qtdTotal, setQtdTotal] = useState("");
  const [prodDiaria, setProdDiaria] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [predecessoras, setPredecessoras] = useState<string[]>([]);
  const [selectedRecursos, setSelectedRecursos] = useState<string[]>([]);

  useEffect(() => {
    if (atividade) {
      setQtdTotal(String(atividade.quantidade_total));
      setProdDiaria(String(atividade.producao_diaria_prevista));
      setDataInicio(atividade.data_inicio || "");
      setPredecessoras(atividade.predecessoras || []);
      setSelectedRecursos(atividadeRecursoIds);
      setEditing(false);
    }
  }, [atividade, atividadeRecursoIds]);

  if (!atividade) return null;

  const statusInfo = STATUS_MAP[atividade.status || "nao_iniciado"];
  const predecessorasNomes = (atividade.predecessoras || []).map((pId) => {
    const p = allAtividades.find((a) => a.id === pId);
    return p?.nome || pId;
  });

  const duracao = qtdTotal && prodDiaria ? Math.ceil(Number(qtdTotal) / Number(prodDiaria)) : atividade.duracao_dias || 0;
  const dataFim = dataInicio && duracao ? format(addDays(parseISO(dataInicio), duracao - 1), "yyyy-MM-dd") : "";

  const handleSave = () => {
    if (!onUpdate) return;
    onUpdate({
      id: atividade.id,
      quantidade_total: Number(qtdTotal),
      producao_diaria_prevista: Number(prodDiaria),
      data_inicio: dataInicio || null,
      data_fim_prevista: dataFim || null,
      predecessoras,
    });
    if (onUpdateRecursos) {
      onUpdateRecursos(atividade.id, selectedRecursos);
    }
    setEditing(false);
  };

  const togglePredecessora = (id: string) => {
    setPredecessoras((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const toggleRecurso = (id: string) => {
    setSelectedRecursos((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };

  const otherAtividades = allAtividades.filter((a) => a.id !== atividade.id);

  return (
    <Sheet open={!!atividade} onOpenChange={() => onClose()}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">{atividade.nome}</SheetTitle>
            {onUpdate && !editing && (
              <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>

          <div>
            <span className="text-sm text-muted-foreground">Progresso</span>
            <div className="flex items-center gap-3 mt-1">
              <Progress value={atividade.percentual_executado || 0} className="flex-1" />
              <span className="text-sm font-semibold">{atividade.percentual_executado?.toFixed(1)}%</span>
            </div>
          </div>

          {editing ? (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Qtd. Total</Label>
                  <Input type="number" value={qtdTotal} onChange={(e) => setQtdTotal(e.target.value)} />
                </div>
                <div>
                  <Label>Prod. Diária</Label>
                  <Input type="number" value={prodDiaria} onChange={(e) => setProdDiaria(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              {duracao > 0 && (
                <p className="text-xs text-muted-foreground">
                  Duração: <strong>{duracao} dias</strong>
                  {dataFim && <> — Fim: <strong>{format(parseISO(dataFim), "dd/MM/yyyy")}</strong></>}
                </p>
              )}

              {/* Predecessoras */}
              {otherAtividades.length > 0 && (
                <div>
                  <Label className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Predecessoras</Label>
                  <div className="space-y-1.5 mt-1 max-h-32 overflow-y-auto border rounded-md p-2 bg-background">
                    {otherAtividades.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={predecessoras.includes(a.id)} onCheckedChange={() => togglePredecessora(a.id)} />
                        <span>{a.frente_nome}: {a.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Recursos */}
              {projetoRecursos.length > 0 && (
                <div>
                  <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Recursos Alocados</Label>
                  <div className="space-y-1.5 mt-1 max-h-32 overflow-y-auto border rounded-md p-2 bg-background">
                    {projetoRecursos.map((r) => (
                      <label key={r.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={selectedRecursos.includes(r.id)} onCheckedChange={() => toggleRecurso(r.id)} />
                        <span>{r.nome} <span className="text-muted-foreground">({r.tipo})</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSave} size="sm" className="flex-1">
                  <Save className="h-4 w-4 mr-1" /> Salvar
                </Button>
                <Button onClick={() => setEditing(false)} size="sm" variant="outline">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Frente</span>
                  <p className="font-medium">{atividade.frente_nome}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duração</span>
                  <p className="font-medium">{atividade.duracao_dias} dias</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Qtd. Total</span>
                  <p className="font-medium">{atividade.quantidade_total}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Qtd. Produzida</span>
                  <p className="font-medium">{atividade.qtd_produzida}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Produção Diária</span>
                  <p className="font-medium">{atividade.producao_diaria_prevista}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Início</span>
                  <p className="font-medium">
                    {atividade.data_inicio ? format(parseISO(atividade.data_inicio), "dd/MM/yyyy") : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fim Previsto</span>
                  <p className="font-medium">
                    {atividade.data_fim_prevista ? format(parseISO(atividade.data_fim_prevista), "dd/MM/yyyy") : "—"}
                  </p>
                </div>
              </div>

              {predecessorasNomes.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Predecessoras</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {predecessorasNomes.map((n, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{n}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {atividadeRecursoIds.length > 0 && projetoRecursos.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Recursos</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {atividadeRecursoIds.map((rId) => {
                      const r = projetoRecursos.find((x) => x.id === rId);
                      return r ? <Badge key={rId} variant="secondary" className="text-xs">{r.nome}</Badge> : null;
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
