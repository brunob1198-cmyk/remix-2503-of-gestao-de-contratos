import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface Site {
  id: string;
  codigo: string;
  nome: string;
}

interface Props {
  projetoId: string;
  sites?: Site[];
  onCreate: (data: any) => void;
  isLoading?: boolean;
}

export function FrenteForm({ projetoId, sites = [], onCreate, isLoading }: Props) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [siteId, setSiteId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const handleSubmit = () => {
    if (!nome.trim()) return;
    onCreate({
      projeto_id: projetoId,
      nome: nome.trim(),
      descricao: descricao || undefined,
      site_id: siteId || undefined,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
    });
    setNome("");
    setDescricao("");
    setSiteId("");
    setDataInicio("");
    setDataFim("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Nova Frente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Frente de Obra</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Trecho A" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          {sites.length > 0 && (
            <div>
              <Label>Site (opcional)</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vincular a um site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.codigo} - {s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Data Fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={isLoading || !nome.trim()} className="w-full">
            Criar Frente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
