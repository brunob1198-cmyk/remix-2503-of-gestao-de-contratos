import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { FrenteObra } from "@/hooks/usePlanejamento";

interface Props {
  projetoId: string;
  onCreate: (data: any) => void;
  isLoading?: boolean;
}

export function FrenteForm({ projetoId, onCreate, isLoading }: Props) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const handleSubmit = () => {
    if (!nome.trim()) return;
    onCreate({
      projeto_id: projetoId,
      nome: nome.trim(),
      descricao: descricao || undefined,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
    });
    setNome("");
    setDescricao("");
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
