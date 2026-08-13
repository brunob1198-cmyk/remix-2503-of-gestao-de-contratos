import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstFuncao, SgsstFuncaoInput } from "@/hooks/sgsst/useSgsstFuncoes";

interface FuncaoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcao?: SgsstFuncao | null;
  onSave: (data: SgsstFuncaoInput) => Promise<void>;
  isLoading?: boolean;
}

export function FuncaoFormDialog({
  open,
  onOpenChange,
  funcao,
  onSave,
  isLoading = false,
}: FuncaoFormDialogProps) {
  const [nome, setNome] = useState("");
  const [cbo, setCbo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [requisitosMinimos, setRequisitosMinimos] = useState("");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");

  useEffect(() => {
    if (funcao) {
      setNome(funcao.nome || "");
      setCbo(funcao.cbo || "");
      setDescricao(funcao.descricao || "");
      setRequisitosMinimos(funcao.requisitos_minimos || "");
      setStatus(funcao.status || "ativo");
    } else {
      setNome("");
      setCbo("");
      setDescricao("");
      setRequisitosMinimos("");
      setStatus("ativo");
    }
  }, [funcao, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    await onSave({
      nome: nome.trim(),
      cbo: cbo.trim() || null,
      descricao: descricao.trim() || null,
      requisitos_minimos: requisitosMinimos.trim() || null,
      status,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{funcao ? "Editar Função/Cargo" : "Nova Função/Cargo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome da Função *</Label>
            <Input
              id="nome"
              placeholder="Ex: TÉCNICO DE SEGURANÇA DO TRABALHO"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cbo">CBO (Código Brasileiro de Ocupações)</Label>
              <Input
                id="cbo"
                placeholder="Ex: 3516-05"
                value={cbo}
                onChange={(e) => setCbo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(val: "ativo" | "inativo") => setStatus(val)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição da Função / Atividades</Label>
            <Textarea
              id="descricao"
              placeholder="Descreva as principais atribuições e responsabilidades..."
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="requisitos">Requisitos Mínimos (Treinamentos / NRs / Formação)</Label>
            <Textarea
              id="requisitos"
              placeholder="Ex: Curso Técnico em Segurança do Trabalho, NR-35..."
              rows={2}
              value={requisitosMinimos}
              onChange={(e) => setRequisitosMinimos(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !nome.trim()}>
              {isLoading ? "Salvando..." : funcao ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
