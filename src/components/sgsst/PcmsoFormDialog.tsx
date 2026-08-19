import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstPcmso, SgsstPcmsoInput, StatusPcmso } from "@/hooks/sgsst/useSgsstPcmso";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { HeartPulse } from "lucide-react";

interface PcmsoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pcmso?: SgsstPcmso | null;
  onSave: (data: SgsstPcmsoInput) => Promise<void>;
  isLoading?: boolean;
}

export function PcmsoFormDialog({
  open,
  onOpenChange,
  pcmso,
  onSave,
  isLoading = false,
}: PcmsoFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [codigo, setCodigo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [projetoId, setProjetoId] = useState("none");
  const [responsavel, setResponsavel] = useState("");
  const [medicoResponsavel, setMedicoResponsavel] = useState("");
  const [crmMedico, setCrmMedico] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataRevisao, setDataRevisao] = useState("");
  const [status, setStatus] = useState<StatusPcmso>("RASCUNHO");
  const [objetivo, setObjetivo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [agravosSaude, setAgravosSaude] = useState("");
  const [criteriosConduta, setCriteriosConduta] = useState("");
  const [anoReferencia, setAnoReferencia] = useState<string>(String(new Date().getFullYear()));

  // Load projetos
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_pcmso", empresaId],
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
    if (pcmso) {
      setCodigo(pcmso.codigo || "");
      setTitulo(pcmso.titulo || "");
      setProjetoId(pcmso.projeto_id || "none");
      setResponsavel(pcmso.responsavel || "");
      setMedicoResponsavel(pcmso.medico_responsavel || "");
      setCrmMedico(pcmso.crm_medico || "");
      setDataInicio(pcmso.data_inicio ? pcmso.data_inicio.split("T")[0] : "");
      setDataRevisao(pcmso.data_revisao ? pcmso.data_revisao.split("T")[0] : "");
      setStatus(pcmso.status || "RASCUNHO");
      setObjetivo(pcmso.objetivo || "");
      setObservacoes(pcmso.observacoes || "");
      setAgravosSaude(pcmso.agravos_saude || "");
      setCriteriosConduta(pcmso.criterios_conduta || "");
      setAnoReferencia(String(pcmso.ano_referencia ?? new Date().getFullYear()));
    } else {
      setCodigo("");
      setTitulo("");
      setProjetoId("none");
      setResponsavel("");
      setMedicoResponsavel("");
      setCrmMedico("");
      setDataInicio(new Date().toISOString().split("T")[0]);
      setDataRevisao("");
      setStatus("RASCUNHO");
      setObjetivo("Prevenção, rastreamento e diagnóstico precoce dos agravos à saúde relacionados ao trabalho.");
      setObservacoes("");
    }
  }, [pcmso, open]);

  const isReadOnly = pcmso?.status === "ENCERRADO" || pcmso?.status === "CANCELADO";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    await onSave({
      codigo: codigo.trim() || null,
      titulo: titulo.trim(),
      projeto_id: projetoId === "none" ? null : projetoId,
      responsavel: responsavel.trim() || null,
      medico_responsavel: medicoResponsavel.trim() || null,
      crm_medico: crmMedico.trim() || null,
      data_inicio: dataInicio || new Date().toISOString().split("T")[0],
      data_revisao: dataRevisao || null,
      status,
      objetivo: objetivo.trim() || null,
      observacoes: observacoes.trim() || null,
      agravos_saude: agravosSaude.trim() || null,
      criterios_conduta: criteriosConduta.trim() || null,
      ano_referencia: Number(anoReferencia) || new Date().getFullYear(),
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" />
            {pcmso ? "Editar PCMSO (Saúde Ocupacional)" : "Elaborar Novo PCMSO (NR-7)"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          {isReadOnly && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 text-xs font-medium">
              ⚠️ Este PCMSO está {pcmso?.status} e não permite mais edições operacionais.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código do Programa</Label>
              <Input
                id="codigo"
                placeholder="Ex: PCMSO-2026-001"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="projeto">Obra / Projeto Específico (Opcional)</Label>
              <Select value={projetoId} onValueChange={setProjetoId} disabled={isReadOnly}>
                <SelectTrigger id="projeto">
                  <SelectValue placeholder="Selecione a obra..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Programa Geral da Empresa --</SelectItem>
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
            <Label htmlFor="titulo">Título do PCMSO *</Label>
            <Input
              id="titulo"
              placeholder="Ex: PCMSO 2026 — PROGRAMA DE CONTROLE MÉDICO DE SAÚDE OCUPACIONAL"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              disabled={isReadOnly}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="medico">Médico do Trabalho Responsável</Label>
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

            <div className="space-y-1.5">
              <Label htmlFor="resp">Gestor / Coordenador</Label>
              <Input
                id="resp"
                placeholder="Ex: Enf. Mariana Silva"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dataInicio">Data de Início da Vigência *</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataRevisao">Data Prevista para Revisão Anual</Label>
              <Input
                id="dataRevisao"
                type="date"
                value={dataRevisao}
                onChange={(e) => setDataRevisao(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="objetivo">Objetivo Geral do PCMSO</Label>
            <Textarea
              id="objetivo"
              placeholder="Diretrizes do programa, prevenção de agravos ocupacionais..."
              rows={2}
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              disabled={isReadOnly}
            />
          </div>

          {/* Campos exigidos pelo item 7.5 da NR-07. Sem eles o programa não pode
              ser emitido como documento: são o conteúdo que a norma manda descrever. */}
          <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 space-y-3 dark:border-amber-900 dark:bg-amber-950/20">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              Conteúdo obrigatório do programa · NR-07 item 7.5
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="agravos">Agravos à saúde relacionados aos riscos *</Label>
              <Textarea
                id="agravos"
                placeholder="Ex.: Exposição a ruído acima de 85 dB(A) pode causar perda auditiva induzida por ruído (PAIR). Sílica cristalina está associada a silicose e câncer de pulmão..."
                rows={3}
                value={agravosSaude}
                onChange={(e) => setAgravosSaude(e.target.value)}
                disabled={isReadOnly}
              />
              <p className="text-xs text-muted-foreground">
                Descreva o que cada risco da obra pode causar à saúde. É o que liga o
                inventário de riscos aos exames escolhidos.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="criterios">Critérios de interpretação e conduta *</Label>
              <Textarea
                id="criterios"
                placeholder="Ex.: Audiometria com perda em 3, 4 e 6 kHz → afastar da exposição, reavaliar em 30 dias e comunicar ao SESMT. Espirometria alterada → encaminhar ao pneumologista..."
                rows={3}
                value={criteriosConduta}
                onChange={(e) => setCriteriosConduta(e.target.value)}
                disabled={isReadOnly}
              />
              <p className="text-xs text-muted-foreground">
                O que fazer quando um exame vem alterado. Precisa ser conhecido por
                todos os médicos que realizam os exames.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="anoRef">Ano de referência</Label>
              <Input
                id="anoRef"
                type="number"
                min={2000}
                max={2100}
                value={anoReferencia}
                onChange={(e) => setAnoReferencia(e.target.value)}
                disabled={isReadOnly}
              />
              <p className="text-xs text-muted-foreground">Base do relatório anual.</p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="observacoes">Observações Gerais</Label>
              <Textarea
                id="observacoes"
                placeholder="Contatos de emergência, particularidades da obra..."
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || isReadOnly || !titulo.trim()}>
              {isLoading ? "Salvando..." : pcmso ? "Atualizar PCMSO" : "Elaborar PCMSO"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
