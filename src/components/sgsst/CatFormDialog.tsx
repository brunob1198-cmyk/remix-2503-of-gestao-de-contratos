import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Siren } from "lucide-react";
import {
  TIPO_CAT_LABEL,
  type SgsstCat,
  type SgsstCatInput,
  type TipoCat,
} from "@/hooks/sgsst/useSgsstCats";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";

interface CatFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cat?: SgsstCat | null;
  onSave: (data: SgsstCatInput) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Cadastro de CAT — Comunicação de Acidente de Trabalho.
 *
 * A CAT alimenta o relatório analítico do PCMSO (item "e" do 7.6.2). Era o único
 * dos seis itens obrigatórios que não tinha onde ser registrado.
 */
export function CatFormDialog({
  open,
  onOpenChange,
  cat,
  onSave,
  isLoading = false,
}: CatFormDialogProps) {
  const { colaboradores } = useSgsstColaboradoresResumo();

  const hoje = new Date().toISOString().split("T")[0];

  const [numeroCat, setNumeroCat] = useState("");
  const [tipoCat, setTipoCat] = useState<TipoCat>("INICIAL");
  const [colaboradorId, setColaboradorId] = useState("none");
  const [dataAcidente, setDataAcidente] = useState(hoje);
  const [dataEmissao, setDataEmissao] = useState(hoje);
  const [cid, setCid] = useState("");
  const [descricao, setDescricao] = useState("");
  const [diasAfastamento, setDiasAfastamento] = useState("0");
  const [houveObito, setHouveObito] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (cat) {
      setNumeroCat(cat.numero_cat || "");
      setTipoCat(cat.tipo_cat || "INICIAL");
      setColaboradorId(cat.colaborador_id || "none");
      setDataAcidente(cat.data_acidente?.split("T")[0] || hoje);
      setDataEmissao(cat.data_emissao?.split("T")[0] || hoje);
      setCid(cat.cid || "");
      setDescricao(cat.descricao || "");
      setDiasAfastamento(String(cat.dias_afastamento ?? 0));
      setHouveObito(cat.houve_obito === true);
      setObservacoes(cat.observacoes || "");
    } else {
      setNumeroCat("");
      setTipoCat("INICIAL");
      setColaboradorId("none");
      setDataAcidente(hoje);
      setDataEmissao(hoje);
      setCid("");
      setDescricao("");
      setDiasAfastamento("0");
      setHouveObito(false);
      setObservacoes("");
    }
  }, [cat, open]);

  // O banco recusa CAT de óbito sem o óbito marcado. Manter a UI coerente evita
  // que o usuário só descubra a regra ao salvar.
  useEffect(() => {
    if (tipoCat === "COMUNICACAO_OBITO") setHouveObito(true);
  }, [tipoCat]);

  const acidenteDepoisDaEmissao = !!dataAcidente && !!dataEmissao && dataAcidente > dataEmissao;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataAcidente || !dataEmissao || acidenteDepoisDaEmissao) return;

    await onSave({
      numero_cat: numeroCat.trim() || null,
      tipo_cat: tipoCat,
      colaborador_id: colaboradorId === "none" ? null : colaboradorId,
      incidente_id: null,
      projeto_id: null,
      area_id: null,
      data_acidente: dataAcidente,
      data_emissao: dataEmissao,
      cid: cid.trim() || null,
      descricao: descricao.trim() || null,
      dias_afastamento: Number(diasAfastamento) || 0,
      houve_obito: houveObito,
      observacoes: observacoes.trim() || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-destructive" />
            {cat ? "Editar CAT" : "Registrar CAT"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="numCat">Número da CAT</Label>
              <Input
                id="numCat"
                placeholder="Número do protocolo no INSS"
                value={numeroCat}
                onChange={(e) => setNumeroCat(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tipoCat">Tipo *</Label>
              <Select value={tipoCat} onValueChange={(v: TipoCat) => setTipoCat(v)}>
                <SelectTrigger id="tipoCat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_CAT_LABEL) as TipoCat[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {TIPO_CAT_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="colabCat">Trabalhador acidentado</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger id="colabCat">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Não informado --</SelectItem>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayNome} {c.funcao ? `— ${c.funcao}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O setor do trabalhador é usado na estatística por setor do relatório.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dtAcid">Data do acidente *</Label>
              <Input
                id="dtAcid"
                type="date"
                value={dataAcidente}
                onChange={(e) => setDataAcidente(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dtEmi">Data de emissão *</Label>
              <Input
                id="dtEmi"
                type="date"
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cid">CID</Label>
              <Input
                id="cid"
                placeholder="Ex.: S62.6"
                value={cid}
                onChange={(e) => setCid(e.target.value)}
              />
            </div>
          </div>

          {acidenteDepoisDaEmissao && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              A data do acidente não pode ser posterior à emissão da CAT.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="descCat">Descrição do acidente</Label>
            <Textarea
              id="descCat"
              rows={2}
              placeholder="Ex.: Corte na mão direita ao manusear serra circular sem proteção."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5">
              <Label htmlFor="diasAf">Dias de afastamento</Label>
              <Input
                id="diasAf"
                type="number"
                min={0}
                value={diasAfastamento}
                onChange={(e) => setDiasAfastamento(e.target.value)}
              />
            </div>

            <label className="flex items-start gap-2 pt-6 cursor-pointer">
              <Checkbox
                checked={houveObito}
                disabled={tipoCat === "COMUNICACAO_OBITO"}
                onCheckedChange={(v) => setHouveObito(v === true)}
                aria-label="Houve óbito"
              />
              <span>
                <span className="font-medium">Houve óbito</span>
                {tipoCat === "COMUNICACAO_OBITO" && (
                  <span className="block text-xs text-muted-foreground">
                    Obrigatório para comunicação de óbito.
                  </span>
                )}
              </span>
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obsCat">Observações</Label>
            <Textarea
              id="obsCat"
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || acidenteDepoisDaEmissao}>
              {isLoading ? "Salvando…" : cat ? "Salvar" : "Registrar CAT"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
