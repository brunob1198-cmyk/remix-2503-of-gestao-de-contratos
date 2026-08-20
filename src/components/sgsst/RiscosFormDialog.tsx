import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstRisco, SgsstRiscoInput, CategoriaRisco } from "@/hooks/sgsst/useSgsstRiscos";
import {
  parseLimite,
  TECNICA_AJUDA,
  type TecnicaAvaliacao,
} from "@/utils/sgsstRiscoLimite";
import { Ruler, Info } from "lucide-react";

/** Unidades recorrentes, oferecidas como atalho sem impedir texto livre. */
const UNIDADES_SUGERIDAS = ["dB(A)", "mg/m³", "ppm", "m/s²", "IBUTG °C", "% O₂", "f/cm³"];

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
  const [tecnica, setTecnica] = useState<TecnicaAvaliacao | "">("");
  const [limite, setLimite] = useState("");
  const [unidade, setUnidade] = useState("");
  const [baseLegal, setBaseLegal] = useState("");

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
      setTecnica(risco.tecnica_avaliacao || "");
      setLimite(
        risco.limite_tolerancia === null || risco.limite_tolerancia === undefined
          ? ""
          : String(risco.limite_tolerancia).replace(".", ",")
      );
      setUnidade(risco.unidade_medida || "");
      setBaseLegal(risco.base_legal || "");
    } else {
      setCodigo("");
      setNome("");
      setCategoria("Físico");
      setAgente("");
      setFonteGeradora("");
      setConsequencia("");
      setDescricao("");
      setStatus("ativo");
      setTecnica("");
      setLimite("");
      setUnidade("");
      setBaseLegal("");
    }
  }, [risco, open]);

  const limiteParseado = parseLimite(limite);
  const limiteInvalido = limiteParseado === undefined;

  // Limite sem unidade não diz nada — 85 do quê? Avisamos em vez de gravar um
  // número órfão que depois vai imprimir num PGR.
  const faltaUnidade = limiteParseado !== null && limiteParseado !== undefined && !unidade.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || limiteInvalido) return;

    await onSave({
      codigo: codigo.trim() || null,
      nome: nome.trim(),
      categoria,
      agente: agente.trim() || null,
      fonte_geradora: fonteGeradora.trim() || null,
      consequencia: consequencia.trim() || null,
      descricao: descricao.trim() || null,
      status,
      tecnica_avaliacao: tecnica || null,
      limite_tolerancia: limiteParseado ?? null,
      unidade_medida: unidade.trim() || null,
      base_legal: baseLegal.trim() || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Rola o conteudo: com o bloco de avaliacao o formulario passa da altura
          da viewport em telas de notebook. */}
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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

          {/* Avaliação e limite — o que transforma o risco em decisão técnica */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <Ruler className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold leading-none">Avaliação e limite de tolerância</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Define se o risco exige medição e contra qual valor o resultado será
                  comparado. É o que o PGR usa para concluir se a exposição é aceitável.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tecnica">Técnica de avaliação</Label>
                <Select
                  value={tecnica || "nao_definida"}
                  onValueChange={(val) =>
                    setTecnica(val === "nao_definida" ? "" : (val as TecnicaAvaliacao))
                  }
                >
                  <SelectTrigger id="tecnica">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_definida">Não definida</SelectItem>
                    <SelectItem value="QUALITATIVA">Qualitativa</SelectItem>
                    <SelectItem value="QUANTITATIVA">Quantitativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="limite">Limite de tolerância</Label>
                <Input
                  id="limite"
                  inputMode="decimal"
                  placeholder="Ex: 85"
                  value={limite}
                  onChange={(e) => setLimite(e.target.value)}
                  aria-invalid={limiteInvalido}
                  className={limiteInvalido ? "border-destructive" : undefined}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="unidade">Unidade de medida</Label>
                <Input
                  id="unidade"
                  list="unidades-sugeridas"
                  placeholder="Ex: dB(A)"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  aria-invalid={faltaUnidade}
                  className={faltaUnidade ? "border-amber-500" : undefined}
                />
                <datalist id="unidades-sugeridas">
                  {UNIDADES_SUGERIDAS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>
            </div>

            {limiteInvalido && (
              <p className="text-xs text-destructive">
                Informe um número (use vírgula para decimal, ex.: 0,05) ou deixe em branco.
              </p>
            )}

            {faltaUnidade && !limiteInvalido && (
              <p className="text-xs text-amber-700 dark:text-amber-500">
                Informe a unidade: um limite de {limite} sem unidade não permite comparar
                com a medição.
              </p>
            )}

            {tecnica && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{TECNICA_AJUDA[tecnica]}</span>
              </p>
            )}

            {tecnica === "QUANTITATIVA" && !limite.trim() && (
              <p className="text-xs text-amber-700 dark:text-amber-500">
                Risco quantitativo sem limite cadastrado: a medição vai existir, mas não
                haverá parâmetro para dizer se está conforme. Se o limite depende da
                substância ou do tempo de exposição, registre a base legal abaixo.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="baseLegal">Base legal do limite</Label>
              <Input
                id="baseLegal"
                placeholder="Ex: NR-15 Anexo 1 — 85 dB(A) para 8h de exposição"
                value={baseLegal}
                onChange={(e) => setBaseLegal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A norma que fundamenta o valor adotado. Use este campo também quando o
                limite não é um número fixo (tabela por substância, regime de trabalho).
              </p>
            </div>
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
            <Button type="submit" disabled={isLoading || !nome.trim() || limiteInvalido}>
              {isLoading ? "Salvando..." : risco ? "Atualizar Risco" : "Cadastrar Risco"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
