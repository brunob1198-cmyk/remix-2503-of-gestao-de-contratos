import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstAso, SgsstAsoInput, TipoExameOcupacional, AptidaoAso, StatusAso } from "@/hooks/sgsst/useSgsstAsosAndExames";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";
import { useSgsstPcmso } from "@/hooks/sgsst/useSgsstPcmso";
import { useSgsstExames } from "@/hooks/sgsst/useSgsstAsosAndExames";
import { Stethoscope, AlertTriangle } from "lucide-react";
import { addYears, format } from "date-fns";

interface AsoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aso?: SgsstAso | null;
  initialExameId?: string | null;
  onSave: (data: SgsstAsoInput) => Promise<void>;
  isLoading?: boolean;
}

export function AsoFormDialog({
  open,
  onOpenChange,
  aso,
  initialExameId,
  onSave,
  isLoading = false,
}: AsoFormDialogProps) {
  const { colaboradores } = useSgsstColaboradoresResumo();
  const { pcmsoList } = useSgsstPcmso();
  const { exames } = useSgsstExames();

  const [colaboradorId, setColaboradorId] = useState("");
  const [exameId, setExameId] = useState("none");
  const [pcmsoId, setPcmsoId] = useState("none");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [tipo, setTipo] = useState<TipoExameOcupacional>("Periódico");
  const [aptidao, setAptidao] = useState<AptidaoAso>("APTO");
  const [validade, setValidade] = useState("");
  const [medicoResponsavel, setMedicoResponsavel] = useState("");
  const [crmMedico, setCrmMedico] = useState("");
  const [descricaoRestricao, setDescricaoRestricao] = useState("");
  const [dataInicioRestricao, setDataInicioRestricao] = useState("");
  const [dataTerminoRestricao, setDataTerminoRestricao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState<StatusAso>("ATIVO");

  useEffect(() => {
    if (aso) {
      setColaboradorId(aso.colaborador_id || "");
      setExameId(aso.exame_id || "none");
      setPcmsoId(aso.pcmso_id || "none");
      setNumeroDocumento(aso.numero_documento || "");
      setDataEmissao(aso.data_emissao ? aso.data_emissao.split("T")[0] : "");
      setTipo(aso.tipo || "Periódico");
      setAptidao(aso.aptidao || "APTO");
      setValidade(aso.validade ? aso.validade.split("T")[0] : "");
      setMedicoResponsavel(aso.medico_responsavel || "");
      setCrmMedico(aso.crm_medico || "");
      setDescricaoRestricao(aso.descricao_restricao || "");
      setDataInicioRestricao(aso.data_inicio_restricao ? aso.data_inicio_restricao.split("T")[0] : "");
      setDataTerminoRestricao(aso.data_termino_restricao ? aso.data_termino_restricao.split("T")[0] : "");
      setObservacoes(aso.observacoes || "");
      setStatus(aso.status || "ATIVO");
    } else {
      const todayStr = new Date().toISOString().split("T")[0];
      const nextYearStr = format(addYears(new Date(), 1), "yyyy-MM-dd");

      setColaboradorId("");
      setExameId(initialExameId || "none");
      setPcmsoId("none");
      setNumeroDocumento("");
      setDataEmissao(todayStr);
      setTipo("Periódico");
      setAptidao("APTO");
      setValidade(nextYearStr);
      setMedicoResponsavel("");
      setCrmMedico("");
      setDescricaoRestricao("");
      setDataInicioRestricao("");
      setDataTerminoRestricao("");
      setObservacoes("");
      setStatus("ATIVO");

      if (initialExameId) {
        const foundExame = exames.find((e) => e.id === initialExameId);
        if (foundExame) {
          setColaboradorId(foundExame.colaborador_id);
          setPcmsoId(foundExame.pcmso_id || "none");
          setTipo(foundExame.tipo);
        }
      }
    }
  }, [aso, initialExameId, open]);

  // Handle auto-calculating 1 year validade upon emissions date change
  const handleEmissaoChange = (valStr: string) => {
    setDataEmissao(valStr);
    try {
      if (valStr) {
        const d = new Date(valStr);
        setValidade(format(addYears(d, 1), "yyyy-MM-dd"));
      }
    } catch {}
  };

  const isReadOnly = aso?.status === "SUBSTITUIDO" || aso?.status === "CANCELADO";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colaboradorId || !dataEmissao || !validade) return;

    await onSave({
      colaborador_id: colaboradorId,
      exame_id: exameId === "none" ? null : exameId,
      pcmso_id: pcmsoId === "none" ? null : pcmsoId,
      numero_documento: numeroDocumento.trim() || null,
      data_emissao: dataEmissao,
      tipo,
      aptidao,
      validade,
      medico_responsavel: medicoResponsavel.trim() || null,
      crm_medico: crmMedico.trim() || null,
      descricao_restricao: aptidao === "APTO_COM_RESTRICAO" ? descricaoRestricao.trim() || null : null,
      data_inicio_restricao: aptidao === "APTO_COM_RESTRICAO" ? dataInicioRestricao || null : null,
      data_termino_restricao: aptidao === "APTO_COM_RESTRICAO" ? dataTerminoRestricao || null : null,
      observacoes: observacoes.trim() || null,
      status,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            {aso ? "Editar ASO (Atestado de Saúde Ocupacional)" : "Emitir Novo ASO (Atestado de Saúde Ocupacional)"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          {isReadOnly && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 text-xs font-medium">
              ⚠️ Este ASO está {aso?.status} e não permite alterações operacionais.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="colab">Colaborador / Trabalhador *</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId} disabled={isReadOnly}>
              <SelectTrigger id="colab">
                <SelectValue placeholder="Selecione o colaborador..." />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayNome} (CPF: {c.cpf || "—"}) — {c.funcao || "Sem função"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="doc">Número / Doc. ASO</Label>
              <Input
                id="doc"
                placeholder="Ex: ASO-2026-889"
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo de Exame *</Label>
              <Select value={tipo} onValueChange={(val: TipoExameOcupacional) => setTipo(val)} disabled={isReadOnly}>
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admissional">Admissional</SelectItem>
                  <SelectItem value="Periódico">Periódico</SelectItem>
                  <SelectItem value="Retorno ao Trabalho">Retorno ao Trabalho</SelectItem>
                  <SelectItem value="Mudança de Risco/Função">Mudança de Risco/Função</SelectItem>
                  <SelectItem value="Demissional">Demissional</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="aptidao">Conclusão de Aptidão *</Label>
              <Select value={aptidao} onValueChange={(val: AptidaoAso) => setAptidao(val)} disabled={isReadOnly}>
                <SelectTrigger id="aptidao" className="font-semibold">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APTO" className="text-emerald-700 font-bold">APTO</SelectItem>
                  <SelectItem value="APTO_COM_RESTRICAO" className="text-amber-700 font-bold">APTO COM RESTRIÇÃO</SelectItem>
                  <SelectItem value="INAPTO" className="text-red-700 font-bold">INAPTO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dataEmissao">Data de Emissão *</Label>
              <Input
                id="dataEmissao"
                type="date"
                value={dataEmissao}
                onChange={(e) => handleEmissaoChange(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="validade">Validade do ASO *</Label>
              <Input
                id="validade"
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>
          </div>

          {/* Seção Condicional de Restrições Ocupacionais */}
          {aptidao === "APTO_COM_RESTRICAO" && (
            <div className="p-3 bg-amber-50/70 border border-amber-300 rounded-md space-y-3">
              <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-xs">
                <AlertTriangle className="h-4 w-4" /> Detalhamento da Restrição Ocupacional
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="descRestricao">Descrição da Restrição *</Label>
                <Input
                  id="descRestricao"
                  placeholder="Ex: Não realizar trabalho em altura acima de 2 metros por 90 dias"
                  value={descricaoRestricao}
                  onChange={(e) => setDescricaoRestricao(e.target.value)}
                  required={aptidao === "APTO_COM_RESTRICAO"}
                  disabled={isReadOnly}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="iniRest">Início da Restrição</Label>
                  <Input
                    id="iniRest"
                    type="date"
                    value={dataInicioRestricao}
                    onChange={(e) => setDataInicioRestricao(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fimRest">Término da Restrição</Label>
                  <Input
                    id="fimRest"
                    type="date"
                    value={dataTerminoRestricao}
                    onChange={(e) => setDataTerminoRestricao(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="medico">Médico Examinador / Emitente</Label>
              <Input
                id="medico"
                placeholder="Ex: Dr. Roberto Guimarães"
                value={medicoResponsavel}
                onChange={(e) => setMedicoResponsavel(e.target.value)}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="crm">CRM do Médico</Label>
              <Input
                id="crm"
                placeholder="Ex: CRM-SP 123456"
                value={crmMedico}
                onChange={(e) => setCrmMedico(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pcmso">PCMSO Vinculado</Label>
              <Select value={pcmsoId} onValueChange={setPcmsoId} disabled={isReadOnly}>
                <SelectTrigger id="pcmso">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Sem PCMSO Vinculado --</SelectItem>
                  {pcmsoList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.codigo || "PCMSO"}] {p.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exameOrigem">Exame Ocupacional de Origem</Label>
              <Select value={exameId} onValueChange={setExameId} disabled={isReadOnly}>
                <SelectTrigger id="exameOrigem">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Sem Exame Direto --</SelectItem>
                  {exames.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_exame} ({e.tipo})
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
              placeholder="Notas gerais sobre o ASO..."
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={isReadOnly}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || isReadOnly || !colaboradorId || !dataEmissao || !validade}>
              {isLoading ? "Salvando..." : aso ? "Atualizar ASO" : "Emitir ASO"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
