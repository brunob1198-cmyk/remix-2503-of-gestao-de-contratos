import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { FrenteObra, AtividadePlanejamento } from "@/hooks/usePlanejamento";
import { addDays, format } from "date-fns";

interface Props {
  frentes: FrenteObra[];
  atividades: AtividadePlanejamento[];
  onCreate: (data: any) => void;
  isLoading?: boolean;
}

export function AtividadeForm({ frentes, atividades, onCreate, isLoading }: Props) {
  const [open, setOpen] = useState(false);
  const [frenteId, setFrenteId] = useState("");
  const [nome, setNome] = useState("");
  const [qtdTotal, setQtdTotal] = useState("");
  const [prodDiaria, setProdDiaria] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [predecessoras, setPredecessoras] = useState<string[]>([]);

  const duracao = qtdTotal && prodDiaria ? Math.ceil(Number(qtdTotal) / Number(prodDiaria)) : 0;
  const dataFim = dataInicio && duracao ? format(addDays(new Date(dataInicio), duracao), "yyyy-MM-dd") : "";

  const handleSubmit = () => {
    if (!frenteId || !nome.trim() || !qtdTotal || !prodDiaria) return;
    onCreate({
      frente_id: frenteId,
      nome: nome.trim(),
      quantidade_total: Number(qtdTotal),
      producao_diaria_prevista: Number(prodDiaria),
      data_inicio: dataInicio || undefined,
      data_fim_prevista: dataFim || undefined,
      predecessoras,
    });
    setNome("");
    setQtdTotal("");
    setProdDiaria("");
    setDataInicio("");
    setPredecessoras([]);
    setOpen(false);
  };

  const togglePredecessora = (id: string) => {
    setPredecessoras((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Atividade
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Atividade</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Frente *</Label>
            <Select value={frenteId} onValueChange={setFrenteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a frente" />
              </SelectTrigger>
              <SelectContent>
                {frentes.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nome da Atividade *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Escavação" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Quantidade Total *</Label>
              <Input type="number" value={qtdTotal} onChange={(e) => setQtdTotal(e.target.value)} />
            </div>
            <div>
              <Label>Produção Diária Prevista *</Label>
              <Input type="number" value={prodDiaria} onChange={(e) => setProdDiaria(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Data Início</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          {duracao > 0 && (
            <p className="text-sm text-muted-foreground">
              Duração calculada: <strong>{duracao} dias</strong>
              {dataFim && <> — Previsão de término: <strong>{format(new Date(dataFim), "dd/MM/yyyy")}</strong></>}
            </p>
          )}

          {atividades.length > 0 && (
            <div>
              <Label>Predecessoras</Label>
              <div className="space-y-2 mt-1 max-h-32 overflow-y-auto border rounded-md p-2">
                {atividades.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={predecessoras.includes(a.id)}
                      onCheckedChange={() => togglePredecessora(a.id)}
                    />
                    <span>{a.frente_nome}: {a.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={isLoading || !frenteId || !nome.trim()} className="w-full">
            Criar Atividade
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
