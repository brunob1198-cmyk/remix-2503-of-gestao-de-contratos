import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SgsstTreinamento, SgsstTreinamentoInput, CategoriaTreinamento, StatusTreinamento } from "@/hooks/sgsst/useSgsstTreinamentos";
import { useSgsstFuncoes } from "@/hooks/sgsst/useSgsstFuncoes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap } from "lucide-react";

interface TreinamentoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treinamento?: SgsstTreinamento | null;
  onSave: (data: SgsstTreinamentoInput) => Promise<void>;
  isLoading?: boolean;
}

export function TreinamentoFormDialog({
  open,
  onOpenChange,
  treinamento,
  onSave,
  isLoading = false,
}: TreinamentoFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const { funcoes } = useSgsstFuncoes();

  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<CategoriaTreinamento>("NR");
  const [cargaHoraria, setCargaHoraria] = useState(8);
  const [validadeMeses, setValidadeMeses] = useState<number | "">(12);
  const [obrigatorio, setObrigatorio] = useState(false);
  const [funcaoId, setFuncaoId] = useState("none");
  const [projetoId, setProjetoId] = useState("none");
  const [status, setStatus] = useState<StatusTreinamento>("ATIVO");
  const [observacoes, setObservacoes] = useState("");

  // Load projetos
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_tr_form", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, codigo, nome")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (treinamento) {
      setCodigo(treinamento.codigo || "");
      setNome(treinamento.nome || "");
      setDescricao(treinamento.descricao || "");
      setCategoria(treinamento.categoria || "NR");
      setCargaHoraria(treinamento.carga_horaria || 8);
      setValidadeMeses(treinamento.validade_meses !== null && treinamento.validade_meses !== undefined ? treinamento.validade_meses : "");
      setObrigatorio(!!treinamento.obrigatorio);
      setFuncaoId(treinamento.funcao_id || "none");
      setProjetoId(treinamento.projeto_id || "none");
      setStatus(treinamento.status || "ATIVO");
      setObservacoes(treinamento.observacoes || "");
    } else {
      setCodigo("");
      setNome("");
      setDescricao("");
      setCategoria("NR");
      setCargaHoraria(8);
      setValidadeMeses(12);
      setObrigatorio(false);
      setFuncaoId("none");
      setProjetoId("none");
      setStatus("ATIVO");
      setObservacoes("");
    }
  }, [treinamento, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    await onSave({
      codigo: codigo.trim() || null,
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      categoria,
      carga_horaria: Number(cargaHoraria) || 8,
      validade_meses: validadeMeses !== "" ? Number(validadeMeses) : null,
      obrigatorio,
      funcao_id: funcaoId === "none" ? null : funcaoId,
      projeto_id: projetoId === "none" ? null : projetoId,
      status,
      observacoes: observacoes.trim() || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            {treinamento ? "Editar Treinamento no Catálogo" : "Cadastrar Treinamento / Capacitação"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código do Treinamento</Label>
              <Input
                id="codigo"
                placeholder="Ex: NR-35-BAS"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select value={categoria} onValueChange={(val: CategoriaTreinamento) => setCategoria(val)}>
                <SelectTrigger id="categoria">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NR">Norma Regulamentadora (NR)</SelectItem>
                  <SelectItem value="Integração">Integração de Segurança</SelectItem>
                  <SelectItem value="Segurança">Segurança do Trabalho</SelectItem>
                  <SelectItem value="Saúde">Saúde Ocupacional</SelectItem>
                  <SelectItem value="Operacional">Operacional / Técnico</SelectItem>
                  <SelectItem value="Comportamental">Comportamental / Liderança</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(val: StatusTreinamento) => setStatus(val)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="INATIVO">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome do Treinamento *</Label>
            <Input
              id="nome"
              placeholder="Ex: NR-35 — Trabalho em Altura (Capacitação Básica)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição / Ementa</Label>
            <Textarea
              id="desc"
              placeholder="Ementa do treinamento, objetivos de aprendizagem, conteúdo programático..."
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="carga">Carga Horária (Horas) *</Label>
              <Input
                id="carga"
                type="number"
                min={1}
                value={cargaHoraria}
                onChange={(e) => setCargaHoraria(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="validade">Validade (Meses)</Label>
              <Input
                id="validade"
                type="number"
                min={0}
                placeholder="Ex: 12, 24 (Vazio = Indeterminado)"
                value={validadeMeses}
                onChange={(e) => setValidadeMeses(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>

            <div className="flex flex-col justify-center space-y-2 pt-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="obrig"
                  checked={obrigatorio}
                  onCheckedChange={setObrigatorio}
                />
                <Label htmlFor="obrig" className="cursor-pointer font-semibold">
                  Obrigatório
                </Label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="funcao">Requisito por Função (Opcional)</Label>
              <Select value={funcaoId} onValueChange={setFuncaoId}>
                <SelectTrigger id="funcao">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Todas as Funções --</SelectItem>
                  {funcoes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="projeto">Requisito por Obra (Opcional)</Label>
              <Select value={projetoId} onValueChange={setProjetoId}>
                <SelectTrigger id="projeto">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Geral da Empresa --</SelectItem>
                  {projetos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.codigo}] {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações Gerais</Label>
            <Textarea
              id="obs"
              placeholder="Instruções de reciclagem, equipamentos de apoio..."
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !nome.trim()}>
              {isLoading ? "Salvando..." : treinamento ? "Atualizar Treinamento" : "Cadastrar Treinamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
