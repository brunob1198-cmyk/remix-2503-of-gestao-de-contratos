import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstInspecao, SgsstInspecaoInput, TipoInspecao, StatusInspecao } from "@/hooks/sgsst/useSgsstInspecoes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SearchCheck } from "lucide-react";

interface InspecaoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspecao?: SgsstInspecao | null;
  onSave: (data: SgsstInspecaoInput) => Promise<void>;
  isLoading?: boolean;
}

export function InspecaoFormDialog({
  open,
  onOpenChange,
  inspecao,
  onSave,
  isLoading = false,
}: InspecaoFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [codigo, setCodigo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoInspecao>("Inspeção de Segurança");
  const [projetoId, setProjetoId] = useState("");
  const [siteId, setSiteId] = useState("none");
  const [areaId, setAreaId] = useState("none");
  const [pgrId, setPgrId] = useState("none");
  const [aprId, setAprId] = useState("none");
  const [ptId, setPtId] = useState("none");
  const [responsavelId, setResponsavelId] = useState("none");
  const [dataPlanejada, setDataPlanejada] = useState("");
  const [status, setStatus] = useState<StatusInspecao>("PLANEJADA");
  const [observacoes, setObservacoes] = useState("");

  // Load projetos
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_insp", empresaId],
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
    queryKey: ["sites_insp", projetoId],
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
    queryKey: ["areas_insp", empresaId],
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

  // Load pgrs
  const { data: pgrs = [] } = useQuery({
    queryKey: ["pgrs_insp", projetoId],
    enabled: !!projetoId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sgsst_pgr")
        .select("id, codigo, titulo")
        .eq("projeto_id", projetoId);
      if (error) throw error;
      return data || [];
    },
  });

  // Load aprs
  const { data: aprs = [] } = useQuery({
    queryKey: ["aprs_insp", projetoId],
    enabled: !!projetoId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sgsst_apr")
        .select("id, codigo, titulo")
        .eq("projeto_id", projetoId);
      if (error) throw error;
      return data || [];
    },
  });

  // Load pts
  const { data: pts = [] } = useQuery({
    queryKey: ["pts_insp", projetoId],
    enabled: !!projetoId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sgsst_pt")
        .select("id, codigo, titulo")
        .eq("projeto_id", projetoId);
      if (error) throw error;
      return data || [];
    },
  });

  // Load responsaveis
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis_insp", empresaId],
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
    if (inspecao) {
      setCodigo(inspecao.codigo || "");
      setTitulo(inspecao.titulo || "");
      setTipo(inspecao.tipo || "Inspeção de Segurança");
      setProjetoId(inspecao.projeto_id || "");
      setSiteId(inspecao.site_id || "none");
      setAreaId(inspecao.area_id || "none");
      setPgrId(inspecao.pgr_id || "none");
      setAprId(inspecao.apr_id || "none");
      setPtId(inspecao.pt_id || "none");
      setResponsavelId(inspecao.responsavel_id || "none");
      setDataPlanejada(inspecao.data_planejada ? inspecao.data_planejada.split("T")[0] : "");
      setStatus(inspecao.status || "PLANEJADA");
      setObservacoes(inspecao.observacoes || "");
    } else {
      setCodigo("");
      setTitulo("");
      setTipo("Inspeção de Segurança");
      setProjetoId("");
      setSiteId("none");
      setAreaId("none");
      setPgrId("none");
      setAprId("none");
      setPtId("none");
      setResponsavelId("none");
      setDataPlanejada(new Date().toISOString().split("T")[0]);
      setStatus("PLANEJADA");
      setObservacoes("");
    }
  }, [inspecao, open]);

  const isReadOnly = inspecao?.status === "CONCLUIDA" || inspecao?.status === "CANCELADA";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !projetoId) return;

    await onSave({
      codigo: codigo.trim() || null,
      titulo: titulo.trim(),
      tipo,
      projeto_id: projetoId,
      site_id: siteId === "none" ? null : siteId,
      area_id: areaId === "none" ? null : areaId,
      pgr_id: pgrId === "none" ? null : pgrId,
      apr_id: aprId === "none" ? null : aprId,
      pt_id: ptId === "none" ? null : ptId,
      responsavel_id: responsavelId === "none" ? null : responsavelId,
      data_planejada: dataPlanejada || new Date().toISOString().split("T")[0],
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
            <SearchCheck className="h-5 w-5 text-primary" />
            {inspecao ? "Editar Inspeção de Segurança" : "Agendar Nova Inspeção de Segurança"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          {isReadOnly && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 text-xs font-medium">
              ⚠️ Esta inspeção está {inspecao?.status} e não permite mais edições operacionais.
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                placeholder="Ex: INSP-2026-001"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo de Inspeção *</Label>
              <Select value={tipo} onValueChange={(val: TipoInspecao) => setTipo(val)} disabled={isReadOnly}>
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inspeção de Segurança">Inspeção de Segurança</SelectItem>
                  <SelectItem value="Inspeção de Área">Inspeção de Área</SelectItem>
                  <SelectItem value="Inspeção de Equipamento">Inspeção de Equipamento</SelectItem>
                  <SelectItem value="Inspeção de EPI">Inspeção de EPI</SelectItem>
                  <SelectItem value="Inspeção de Trabalho">Inspeção de Trabalho</SelectItem>
                  <SelectItem value="Inspeção de Obra">Inspeção de Obra</SelectItem>
                  <SelectItem value="Inspeção Comportamental">Inspeção Comportamental</SelectItem>
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
            <Label htmlFor="titulo">Título da Inspeção *</Label>
            <Input
              id="titulo"
              placeholder="Ex: INSPEÇÃO PERIÓDICA DE PROTEÇÃO COLETIVA E EPIS NO CANTEIRO"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              disabled={isReadOnly}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="site">Canteiro / Site</Label>
              <Select value={siteId} onValueChange={setSiteId} disabled={isReadOnly || !projetoId}>
                <SelectTrigger id="site">
                  <SelectValue placeholder="Selecione o canteiro..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Geral da Obra --</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      [{s.codigo}] {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="area">Setor / Área Mapeada</Label>
              <Select value={areaId} onValueChange={setAreaId} disabled={isReadOnly}>
                <SelectTrigger id="area">
                  <SelectValue placeholder="Selecione a área..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Todas as Áreas --</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pgr">PGR Referência</Label>
              <Select value={pgrId} onValueChange={setPgrId} disabled={isReadOnly || !projetoId}>
                <SelectTrigger id="pgr">
                  <SelectValue placeholder="Vincular PGR..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Nenhum --</SelectItem>
                  {pgrs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo ? `[${p.codigo}] ` : ""}{p.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apr">APR Referência</Label>
              <Select value={aprId} onValueChange={setAprId} disabled={isReadOnly || !projetoId}>
                <SelectTrigger id="apr">
                  <SelectValue placeholder="Vincular APR..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Nenhuma --</SelectItem>
                  {aprs.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.codigo ? `[${a.codigo}] ` : ""}{a.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pt">PT Referência</Label>
              <Select value={ptId} onValueChange={setPtId} disabled={isReadOnly || !projetoId}>
                <SelectTrigger id="pt">
                  <SelectValue placeholder="Vincular PT..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Nenhuma --</SelectItem>
                  {pts.map((ptItem) => (
                    <SelectItem key={ptItem.id} value={ptItem.id}>
                      {ptItem.codigo ? `[${ptItem.codigo}] ` : ""}{ptItem.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="responsavel">Inspetor / TST Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId} disabled={isReadOnly}>
                <SelectTrigger id="responsavel">
                  <SelectValue placeholder="Selecione o inspetor..." />
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
              <Label htmlFor="dataPlanejada">Data Planejada *</Label>
              <Input
                id="dataPlanejada"
                type="date"
                value={dataPlanejada}
                onChange={(e) => setDataPlanejada(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Objetivo e Instruções da Inspeção</Label>
            <Textarea
              id="observacoes"
              placeholder="Escopo da auditoria de campo, normas de referência (NR-18, NR-35)..."
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
            <Button type="submit" disabled={isLoading || isReadOnly || !titulo.trim() || !projetoId}>
              {isLoading ? "Salvando..." : inspecao ? "Atualizar Inspeção" : "Agendar Inspeção"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
