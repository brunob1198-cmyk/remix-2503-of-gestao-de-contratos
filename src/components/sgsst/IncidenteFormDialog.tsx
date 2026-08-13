import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstIncidente, SgsstIncidenteInput, TipoIncidente, GravidadeIncidente, StatusIncidente } from "@/hooks/sgsst/useSgsstIncidentes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Siren } from "lucide-react";

interface IncidenteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incidente?: SgsstIncidente | null;
  onSave: (data: SgsstIncidenteInput) => Promise<void>;
  isLoading?: boolean;
}

export function IncidenteFormDialog({
  open,
  onOpenChange,
  incidente,
  onSave,
  isLoading = false,
}: IncidenteFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState<TipoIncidente>("Incidente");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [siteId, setSiteId] = useState("none");
  const [areaId, setAreaId] = useState("none");
  const [localOcorrencia, setLocalOcorrencia] = useState("");
  const [dataOcorrencia, setDataOcorrencia] = useState("");
  const [horaOcorrencia, setHoraOcorrencia] = useState("");
  const [responsavelRegistroId, setResponsavelRegistroId] = useState("none");
  const [gravidade, setGravidade] = useState<GravidadeIncidente>("MEDIA");
  const [status, setStatus] = useState<StatusIncidente>("REGISTRADO");
  const [observacoes, setObservacoes] = useState("");
  const [pgrId, setPgrId] = useState("none");
  const [aprId, setAprId] = useState("none");
  const [ptId, setPtId] = useState("none");
  const [inspecaoId, setInspecaoId] = useState("none");

  // Load projetos
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_inc", empresaId],
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
    queryKey: ["sites_inc", projetoId],
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
    queryKey: ["areas_inc", empresaId],
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

  // Load responsaveis
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis_inc", empresaId],
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

  // Load pgrs, aprs, pts, inspecoes
  const { data: pgrs = [] } = useQuery({
    queryKey: ["pgrs_inc", projetoId],
    enabled: !!projetoId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("sgsst_pgr").select("id, codigo, titulo").eq("projeto_id", projetoId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: aprs = [] } = useQuery({
    queryKey: ["aprs_inc", projetoId],
    enabled: !!projetoId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("sgsst_apr").select("id, codigo, titulo").eq("projeto_id", projetoId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pts = [] } = useQuery({
    queryKey: ["pts_inc", projetoId],
    enabled: !!projetoId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("sgsst_pt").select("id, codigo, titulo").eq("projeto_id", projetoId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: inspecoes = [] } = useQuery({
    queryKey: ["inspecoes_inc", projetoId],
    enabled: !!projetoId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("sgsst_inspecoes").select("id, codigo, titulo").eq("projeto_id", projetoId);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (incidente) {
      setCodigo(incidente.codigo || "");
      setTipo(incidente.tipo || "Incidente");
      setTitulo(incidente.titulo || "");
      setDescricao(incidente.descricao || "");
      setProjetoId(incidente.projeto_id || "");
      setSiteId(incidente.site_id || "none");
      setAreaId(incidente.area_id || "none");
      setLocalOcorrencia(incidente.local_ocorrencia || "");
      setDataOcorrencia(incidente.data_ocorrencia ? incidente.data_ocorrencia.split("T")[0] : "");
      setHoraOcorrencia(incidente.hora_ocorrencia || "");
      setResponsavelRegistroId(incidente.responsavel_registro_id || "none");
      setGravidade(incidente.gravidade || "MEDIA");
      setStatus(incidente.status || "REGISTRADO");
      setObservacoes(incidente.observacoes || "");
      setPgrId(incidente.pgr_id || "none");
      setAprId(incidente.apr_id || "none");
      setPtId(incidente.pt_id || "none");
      setInspecaoId(incidente.inspecao_id || "none");
    } else {
      setCodigo("");
      setTipo("Incidente");
      setTitulo("");
      setDescricao("");
      setProjetoId("");
      setSiteId("none");
      setAreaId("none");
      setLocalOcorrencia("");
      setDataOcorrencia(new Date().toISOString().split("T")[0]);
      setHoraOcorrencia(new Date().toTimeString().slice(0, 5));
      setResponsavelRegistroId(profile?.id || "none");
      setGravidade("MEDIA");
      setStatus("REGISTRADO");
      setObservacoes("");
      setPgrId("none");
      setAprId("none");
      setPtId("none");
      setInspecaoId("none");
    }
  }, [incidente, open, profile]);

  const isReadOnly = incidente?.status === "ENCERRADO" || incidente?.status === "CANCELADO";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !projetoId || !descricao.trim()) return;

    await onSave({
      codigo: codigo.trim() || null,
      tipo,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      projeto_id: projetoId,
      site_id: siteId === "none" ? null : siteId,
      area_id: areaId === "none" ? null : areaId,
      local_ocorrencia: localOcorrencia.trim() || null,
      data_ocorrencia: dataOcorrencia || new Date().toISOString().split("T")[0],
      hora_ocorrencia: horaOcorrencia ? `${horaOcorrencia}:00` : null,
      responsavel_registro_id: responsavelRegistroId === "none" ? null : responsavelRegistroId,
      gravidade,
      status,
      observacoes: observacoes.trim() || null,
      pgr_id: pgrId === "none" ? null : pgrId,
      apr_id: aprId === "none" ? null : aprId,
      pt_id: ptId === "none" ? null : ptId,
      inspecao_id: inspecaoId === "none" ? null : inspecaoId,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Siren className="h-5 w-5" />
            {incidente ? "Editar Registro de Ocorrência" : "Comunicação / Registro de Ocorrência (Incidente / Acidente)"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          {isReadOnly && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 text-xs font-medium">
              ⚠️ Esta ocorrência está {incidente?.status} e não permite alterações operacionais.
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código Ocorrência</Label>
              <Input
                id="codigo"
                placeholder="Ex: INC-2026-001"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo de Ocorrência *</Label>
              <Select value={tipo} onValueChange={(val: TipoIncidente) => setTipo(val)} disabled={isReadOnly}>
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Incidente">Incidente</SelectItem>
                  <SelectItem value="Acidente">Acidente Geral</SelectItem>
                  <SelectItem value="Quase Acidente">Quase Acidente (Near Miss)</SelectItem>
                  <SelectItem value="Acidente com Afastamento">Acidente C/ Afastamento</SelectItem>
                  <SelectItem value="Acidente sem Afastamento">Acidente S/ Afastamento</SelectItem>
                  <SelectItem value="Ocorrência Ambiental">Ocorrência Ambiental</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gravidade">Gravidade *</Label>
              <Select value={gravidade} onValueChange={(val: GravidadeIncidente) => setGravidade(val)} disabled={isReadOnly}>
                <SelectTrigger id="gravidade">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                  <SelectItem value="MEDIA">Média</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="CRITICA">Crítica / Risco Potencial de Vida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título da Ocorrência *</Label>
            <Input
              id="titulo"
              placeholder="Ex: Queda de ferramenta manual do 3º andar sobre passarela desimpedida"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              disabled={isReadOnly}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição Detalhada do Fato *</Label>
            <Textarea
              id="descricao"
              placeholder="Relato cronológico do evento, condições ambientais no momento, equipamentos envolvidos..."
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
              disabled={isReadOnly}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
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
              <Label htmlFor="area">Setor / Área</Label>
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
              <Label htmlFor="local">Local Exato da Ocorrência</Label>
              <Input
                id="local"
                placeholder="Ex: Torre B, Nível 4, Próximo ao Elevador de Carga"
                value={localOcorrencia}
                onChange={(e) => setLocalOcorrencia(e.target.value)}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataOcorrencia">Data do Evento *</Label>
              <Input
                id="dataOcorrencia"
                type="date"
                value={dataOcorrencia}
                onChange={(e) => setDataOcorrencia(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="horaOcorrencia">Hora do Evento</Label>
              <Input
                id="horaOcorrencia"
                type="time"
                value={horaOcorrencia}
                onChange={(e) => setHoraOcorrencia(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="pgr">PGR Origem</Label>
              <Select value={pgrId} onValueChange={setPgrId} disabled={isReadOnly || !projetoId}>
                <SelectTrigger id="pgr">
                  <SelectValue placeholder="Vincular..." />
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
              <Label htmlFor="apr">APR Origem</Label>
              <Select value={aprId} onValueChange={setAprId} disabled={isReadOnly || !projetoId}>
                <SelectTrigger id="apr">
                  <SelectValue placeholder="Vincular..." />
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
              <Label htmlFor="pt">PT Origem</Label>
              <Select value={ptId} onValueChange={setPtId} disabled={isReadOnly || !projetoId}>
                <SelectTrigger id="pt">
                  <SelectValue placeholder="Vincular..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Nenhuma --</SelectItem>
                  {pts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo ? `[${p.codigo}] ` : ""}{p.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inspecao">Inspeção Origem</Label>
              <Select value={inspecaoId} onValueChange={setInspecaoId} disabled={isReadOnly || !projetoId}>
                <SelectTrigger id="inspecao">
                  <SelectValue placeholder="Vincular..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Nenhuma --</SelectItem>
                  {inspecoes.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.codigo ? `[${i.codigo}] ` : ""}{i.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={isLoading || isReadOnly || !titulo.trim() || !projetoId || !descricao.trim()}>
              {isLoading ? "Salvando..." : incidente ? "Atualizar Ocorrência" : "Registrar Ocorrência"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
