import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstPt, SgsstPtInput, TipoPt, StatusPt } from "@/hooks/sgsst/useSgsstPt";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck } from "lucide-react";

interface PtFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pt?: SgsstPt | null;
  onSave: (data: SgsstPtInput) => Promise<void>;
  isLoading?: boolean;
}

export function PtFormDialog({
  open,
  onOpenChange,
  pt,
  onSave,
  isLoading = false,
}: PtFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [codigo, setCodigo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoPt>("Trabalho em Altura");
  const [projetoId, setProjetoId] = useState("");
  const [siteId, setSiteId] = useState("none");
  const [areaId, setAreaId] = useState("none");
  const [aprId, setAprId] = useState("none");
  const [atividade, setAtividade] = useState("");
  const [localExecucao, setLocalExecucao] = useState("");
  const [responsavelId, setResponsavelId] = useState("none");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [status, setStatus] = useState<StatusPt>("RASCUNHO");
  const [observacoes, setObservacoes] = useState("");

  // Load projetos
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_pt", empresaId],
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

  // Load sites
  const { data: sites = [] } = useQuery({
    queryKey: ["sites_pt", projetoId],
    enabled: !!projetoId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("id, codigo, nome")
        .eq("projeto_id", projetoId);
      if (error) throw error;
      return data || [];
    },
  });

  // Load areas
  const { data: areas = [] } = useQuery({
    queryKey: ["areas_pt", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("id, nome")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Load aprs
  const { data: aprs = [] } = useQuery({
    queryKey: ["aprs_pt", projetoId],
    enabled: !!projetoId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sgsst_apr")
        .select("id, codigo, titulo, atividade")
        .eq("projeto_id", projetoId);
      if (error) throw error;
      return data || [];
    },
  });

  // Load responsaveis
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis_pt", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cargo")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (pt) {
      setCodigo(pt.codigo || "");
      setTitulo(pt.titulo || "");
      setTipo(pt.tipo || "Trabalho em Altura");
      setProjetoId(pt.projeto_id || "");
      setSiteId(pt.site_id || "none");
      setAreaId(pt.area_id || "none");
      setAprId(pt.apr_id || "none");
      setAtividade(pt.atividade || "");
      setLocalExecucao(pt.local_execucao || "");
      setResponsavelId(pt.responsavel_id || "none");
      setDataInicio(pt.data_inicio ? pt.data_inicio.split("T")[0] : "");
      setDataFim(pt.data_fim ? pt.data_fim.split("T")[0] : "");
      setStatus(pt.status || "RASCUNHO");
      setObservacoes(pt.observacoes || "");
    } else {
      setCodigo("");
      setTitulo("");
      setTipo("Trabalho em Altura");
      setProjetoId("");
      setSiteId("none");
      setAreaId("none");
      setAprId("none");
      setAtividade("");
      setLocalExecucao("");
      setResponsavelId("none");
      setDataInicio(new Date().toISOString().split("T")[0]);
      setDataFim("");
      setStatus("RASCUNHO");
      setObservacoes("");
    }
  }, [pt, open]);

  // When selecting an APR, pre-fill activity title
  const handleSelectApr = (id: string) => {
    setAprId(id);
    if (id !== "none") {
      const found = aprs.find((a) => a.id === id);
      if (found) {
        if (!titulo) setTitulo(`PT — ${found.titulo}`);
        if (!atividade) setAtividade(found.atividade);
      }
    }
  };

  const isReadOnly = pt?.status === "ENCERRADA" || pt?.status === "CANCELADA";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !projetoId || !atividade.trim()) return;

    await onSave({
      codigo: codigo.trim() || null,
      titulo: titulo.trim(),
      tipo,
      projeto_id: projetoId,
      site_id: siteId === "none" ? null : siteId,
      area_id: areaId === "none" ? null : areaId,
      apr_id: aprId === "none" ? null : aprId,
      atividade: atividade.trim(),
      local_execucao: localExecucao.trim() || null,
      responsavel_id: responsavelId === "none" ? null : responsavelId,
      data_inicio: dataInicio ? new Date(dataInicio).toISOString() : new Date().toISOString(),
      data_fim: dataFim ? new Date(dataFim).toISOString() : null,
      status,
      observacoes: observacoes.trim() || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {pt ? "Editar Permissão de Trabalho (PT)" : "Emissão de Permissão de Trabalho (PT)"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          {isReadOnly && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 text-xs font-medium">
              ⚠️ Esta Permissão de Trabalho está {pt?.status} e não permite mais edições operacionais.
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código PT</Label>
              <Input
                id="codigo"
                placeholder="Ex: PT-2026-001"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo de PT *</Label>
              <Select value={tipo} onValueChange={(val: TipoPt) => setTipo(val)} disabled={isReadOnly}>
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Trabalho a Quente">Trabalho a Quente</SelectItem>
                  <SelectItem value="Trabalho em Altura">Trabalho em Altura</SelectItem>
                  <SelectItem value="Espaço Confinado">Espaço Confinado</SelectItem>
                  <SelectItem value="Trabalho com Eletricidade">Trabalho com Eletricidade</SelectItem>
                  <SelectItem value="Escavação">Escavação</SelectItem>
                  <SelectItem value="Içamento">Içamento</SelectItem>
                  <SelectItem value="Trabalho com Produtos Químicos">Produtos Químicos</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="projeto">Obra / Projeto *</Label>
              <Select value={projetoId} onValueChange={setProjetoId} disabled={isReadOnly}>
                <SelectTrigger id="projeto">
                  <SelectValue placeholder="Selecione a obra..." />
                </SelectTrigger>
                <SelectContent>
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
            <Label htmlFor="titulo">Título da PT *</Label>
            <Input
              id="titulo"
              placeholder="Ex: PT — SOLDA E CORTE DE ESTRUTURA METÁLICA NA COBERTURA"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              disabled={isReadOnly}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="apr">Vincular Análise Preliminar de Riscos (APR)</Label>
              <Select value={aprId} onValueChange={handleSelectApr} disabled={isReadOnly || !projetoId}>
                <SelectTrigger id="apr">
                  <SelectValue placeholder="Selecione a APR vinculada..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Sem APR Vinculada --</SelectItem>
                  {aprs.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.codigo ? `[${a.codigo}] ` : ""}{a.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="site">Canteiro / Site</Label>
              <Select value={siteId} onValueChange={setSiteId} disabled={isReadOnly || !projetoId}>
                <SelectTrigger id="site">
                  <SelectValue placeholder="Selecione o canteiro..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Geral do Projeto --</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      [{s.codigo}] {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="atividade">Atividade / Serviço *</Label>
              <Input
                id="atividade"
                placeholder="Ex: Montagem e solda de pilares metálicos a 12m de altura"
                value={atividade}
                onChange={(e) => setAtividade(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="local">Local Exato de Execução</Label>
              <Input
                id="local"
                placeholder="Ex: Bloco B, Nível 3, Eixo 4-C"
                value={localExecucao}
                onChange={(e) => setLocalExecucao(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="responsavel">Supervisor / Emissor Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId} disabled={isReadOnly}>
                <SelectTrigger id="responsavel">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Não Definido --</SelectItem>
                  {responsaveis.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome || "Sem Nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataInicio">Validade Início *</Label>
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
              <Label htmlFor="dataFim">Validade Término</Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Observações / Recomendações Especiais de Segurança</Label>
            <Textarea
              id="observacoes"
              placeholder="Instruções de emergência, equipamentos de resgate, contatos de rádio..."
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
            <Button type="submit" disabled={isLoading || isReadOnly || !titulo.trim() || !projetoId || !atividade.trim()}>
              {isLoading ? "Salvando..." : pt ? "Atualizar PT" : "Emitir PT"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
