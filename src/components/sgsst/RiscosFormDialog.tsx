import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstRisco, SgsstRiscoInput, CategoriaRisco } from "@/hooks/sgsst/useSgsstRiscos";

interface RiscosFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risco?: SgsstRisco | null;
  onSave: (data: SgsstRiscoInput) => Promise<void>;
  isLoading?: boolean;
}

export function RiscosFormDialog({
  open,
  onOpenChange,
  risco,
  onSave,
  isLoading = false,
}: RiscosFormDialogProps) {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<CategoriaRisco>("Físico");
  const [agente, setAgente] = useState("");
  const [fonteGeradora, setFonteGeradora] = useState("");
  const [consequencia, setConsequencia] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");

  useEffect(() => {
    if (risco) {
      setCodigo(risco.codigo || "");
      setNome(risco.nome || "");
      setCategoria(risco.categoria || "Físico");
      setAgente(risco.agente || "");
      setFonteGeradora(risco.fonte_geradora || "");
      setConsequencia(risco.consequencia || "");
      setDescricao(risco.descricao || "");
      setStatus(risco.status || "ativo");
    } else {
      setCodigo("");
      setNome("");
      setCategoria("Físico");
      setAgente("");
      setFonteGeradora("");
      setConsequencia("");
      setDescricao("");
      setStatus("ativo");
    }
  }, [risco, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    await onSave({
      codigo: codigo.trim() || null,
      nome: nome.trim(),
      categoria,
      agente: agente.trim() || null,
      fonte_geradora: fonteGeradora.trim() || null,
      consequencia: consequencia.trim() || null,
      descricao: descricao.trim() || null,
      status,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{risco ? "Editar Risco (Catálogo)" : "Novo Risco (Catálogo)"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código Identificador</Label>
              <Input
                id="codigo"
                placeholder="Ex: FIS-001"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="nome">Nome do Perigo / Risco *</Label>
              <Input
                id="nome"
                placeholder="Ex: RUÍDO EXCESSIVO CONTÍNUO OU INTERMITENTE"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select value={categoria} onValueChange={(val: CategoriaRisco) => setCategoria(val)}>
                <SelectTrigger id="categoria">
                  <SelectValue placeholder="Selecione a categoria..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Físico">Físico</SelectItem>
                  <SelectItem value="Químico">Químico</SelectItem>
                  <SelectItem value="Biológico">Biológico</SelectItem>
                  <SelectItem value="Ergonômico">Ergonômico</SelectItem>
                  <SelectItem value="Acidente">Acidente</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="agente">Agente Nocivo / Fator de Risco</Label>
              <Input
                id="agente"
                placeholder="Ex: Pressão sonora acima de 85 dB(A)"
                value={agente}
                onChange={(e) => setAgente(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fonte">Fonte Geradora</Label>
              <Input
                id="fonte"
                placeholder="Ex: Maquinário pesado, geradores, serras"
                value={fonteGeradora}
                onChange={(e) => setFonteGeradora(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="consequencia">Consequência / Danos à Saúde</Label>
            <Input
              id="consequencia"
              placeholder="Ex: Perda auditiva induzida por ruído (PAIR), estresse, fadiga"
              value={consequencia}
              onChange={(e) => setConsequencia(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição Detalhada / Observações</Label>
            <Textarea
              id="descricao"
              placeholder="Detalhes adicionais, normas de referência ou orientações de prevenção..."
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !nome.trim()}>
              {isLoading ? "Salvando..." : risco ? "Atualizar Risco" : "Cadastrar Risco"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
