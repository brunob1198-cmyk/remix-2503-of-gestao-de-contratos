import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstEpi, SgsstEpiInput, CategoriaEpi, StatusEpi } from "@/hooks/sgsst/useSgsstEpis";
import { Shield } from "lucide-react";

interface EpiFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epi?: SgsstEpi | null;
  onSave: (data: SgsstEpiInput) => Promise<void>;
  isLoading?: boolean;
}

export function EpiFormDialog({
  open,
  onOpenChange,
  epi,
  onSave,
  isLoading = false,
}: EpiFormDialogProps) {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<CategoriaEpi>("Proteção da Cabeça");
  const [fabricante, setFabricante] = useState("");
  const [modelo, setModelo] = useState("");
  const [ca, setCa] = useState("");
  const [validadeCa, setValidadeCa] = useState("");
  const [unidadeMedida, setUnidadeMedida] = useState("UN");
  const [estoqueAtual, setEstoqueAtual] = useState(10);
  const [estoqueMinimo, setEstoqueMinimo] = useState(5);
  const [status, setStatus] = useState<StatusEpi>("ATIVO");
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    if (epi) {
      setCodigo(epi.codigo || "");
      setNome(epi.nome || "");
      setCategoria(epi.categoria || "Proteção da Cabeça");
      setFabricante(epi.fabricante || "");
      setModelo(epi.modelo || "");
      setCa(epi.ca || "");
      setValidadeCa(epi.validade_ca ? epi.validade_ca.split("T")[0] : "");
      setUnidadeMedida(epi.unidade_medida || "UN");
      setEstoqueAtual(epi.estoque_atual || 0);
      setEstoqueMinimo(epi.estoque_minimo || 5);
      setStatus(epi.status || "ATIVO");
      setDescricao(epi.descricao || "");
    } else {
      setCodigo("");
      setNome("");
      setCategoria("Proteção da Cabeça");
      setFabricante("");
      setModelo("");
      setCa("");
      setValidadeCa("");
      setUnidadeMedida("UN");
      setEstoqueAtual(10);
      setEstoqueMinimo(5);
      setStatus("ATIVO");
      setDescricao("");
    }
  }, [epi, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !ca.trim()) return;

    await onSave({
      codigo: codigo.trim() || null,
      nome: nome.trim(),
      categoria,
      fabricante: fabricante.trim() || null,
      modelo: modelo.trim() || null,
      ca: ca.trim(),
      validade_ca: validadeCa || null,
      unidade_medida: unidadeMedida,
      estoque_atual: Number(estoqueAtual) || 0,
      estoque_minimo: Number(estoqueMinimo) || 5,
      status,
      descricao: descricao.trim() || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {epi ? "Editar EPI no Catálogo" : "Cadastrar Equipamento de Proteção Individual (EPI)"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código Interno</Label>
              <Input
                id="codigo"
                placeholder="Ex: EPI-CAP-01"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ca">Número do CA *</Label>
              <Input
                id="ca"
                placeholder="Ex: 12345"
                value={ca}
                onChange={(e) => setCa(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="validadeCa">Validade do CA *</Label>
              <Input
                id="validadeCa"
                type="date"
                value={validadeCa}
                onChange={(e) => setValidadeCa(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome do EPI *</Label>
            <Input
              id="nome"
              placeholder="Ex: Capacete de Segurança Aba Frontal com Jugular H-700"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select value={categoria} onValueChange={(val: CategoriaEpi) => setCategoria(val)}>
                <SelectTrigger id="categoria">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Proteção da Cabeça">Proteção da Cabeça</SelectItem>
                  <SelectItem value="Proteção dos Olhos e Face">Proteção dos Olhos e Face</SelectItem>
                  <SelectItem value="Proteção Auditiva">Proteção Auditiva</SelectItem>
                  <SelectItem value="Proteção Respiratória">Proteção Respiratória</SelectItem>
                  <SelectItem value="Proteção das Mãos">Proteção das Mãos</SelectItem>
                  <SelectItem value="Proteção dos Pés">Proteção dos Pés</SelectItem>
                  <SelectItem value="Proteção do Corpo">Proteção do Corpo</SelectItem>
                  <SelectItem value="Proteção Contra Quedas">Proteção Contra Quedas</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fabricante">Fabricante</Label>
              <Input
                id="fabricante"
                placeholder="Ex: 3M, MSA, Conforto"
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modelo">Modelo / Tipo</Label>
              <Input
                id="modelo"
                placeholder="Ex: Classe B, Tipo II"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="um">Unidade Medida</Label>
              <Select value={unidadeMedida} onValueChange={setUnidadeMedida}>
                <SelectTrigger id="um">
                  <SelectValue placeholder="UN" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UN">Unidade (UN)</SelectItem>
                  <SelectItem value="PAR">Par (PAR)</SelectItem>
                  <SelectItem value="CONJUNTO">Conjunto (CJ)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="estAtual">Estoque Atual *</Label>
              <Input
                id="estAtual"
                type="number"
                min={0}
                value={estoqueAtual}
                onChange={(e) => setEstoqueAtual(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="estMin">Estoque Mínimo *</Label>
              <Input
                id="estMin"
                type="number"
                min={0}
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(val: StatusEpi) => setStatus(val)}>
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
            <Label htmlFor="desc">Descrição / Especificações Técnicas</Label>
            <Textarea
              id="desc"
              placeholder="Especificações NBR/NR-6, instruções de higienização e guarda..."
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !nome.trim() || !ca.trim()}>
              {isLoading ? "Salvando..." : epi ? "Atualizar EPI" : "Cadastrar EPI"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
