import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil } from "lucide-react";
import { FrenteObra } from "@/hooks/usePlanejamento";

interface Site {
  id: string;
  codigo: string;
  nome: string;
}

interface Props {
  frente: FrenteObra;
  sites?: Site[];
  onSave: (data: Partial<FrenteObra> & { id: string; propagateDataInicio?: boolean }) => void;
  isLoading?: boolean;
  trigger?: React.ReactNode;
}

export function FrenteEditDialog({ frente, sites = [], onSave, isLoading, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(frente.nome || "");
  const [descricao, setDescricao] = useState(frente.descricao || "");
  const [siteId, setSiteId] = useState((frente as any).site_id || "");
  const [dataInicio, setDataInicio] = useState(frente.data_inicio || "");
  const [dataFim, setDataFim] = useState(frente.data_fim || "");
  const [propagateDataInicio, setPropagateDataInicio] = useState(true);

  useEffect(() => {
    if (open) {
      setNome(frente.nome || "");
      setDescricao(frente.descricao || "");
      setSiteId((frente as any).site_id || "");
      setDataInicio(frente.data_inicio || "");
      setDataFim(frente.data_fim || "");
      setPropagateDataInicio(true);
    }
  }, [open, frente]);

  const handleSubmit = () => {
    if (!nome.trim()) return;

    onSave({
      id: frente.id,
      nome: nome.trim(),
      descricao: descricao || null,
      site_id: siteId && siteId !== "none" ? siteId : null,
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
      propagateDataInicio,
    } as any);

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground">
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Frente de Obra</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Nome da Frente *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Manutenção" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Observações adicionais" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sites.length > 0 && (
              <div>
                <Label>Site / Centro de Custo</Label>
                <Select value={siteId || "none"} onValueChange={(v) => setSiteId(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vincular a um site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.codigo} - {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label>Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div>
                <Label>Data Fim (Opcional)</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t pt-3">
            <Checkbox
              id="propagate-date"
              checked={propagateDataInicio}
              onCheckedChange={(c) => setPropagateDataInicio(Boolean(c))}
            />
            <Label htmlFor="propagate-date" className="text-xs text-muted-foreground cursor-pointer">
              Atualizar também a data de início de todas as atividades desta frente
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isLoading || !nome.trim()}>
              {isLoading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
