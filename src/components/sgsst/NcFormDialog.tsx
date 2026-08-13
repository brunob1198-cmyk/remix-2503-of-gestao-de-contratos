import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstNaoConformidade, SgsstNaoConformidadeInput, OrigemNC, CriticidadeNC, StatusNC } from "@/hooks/sgsst/useSgsstNaoConformidades";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertOctagon } from "lucide-react";

interface NcFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nc?: SgsstNaoConformidade | null;
  onSave: (data: SgsstNaoConformidadeInput) => Promise<void>;
  isLoading?: boolean;
}

export function NcFormDialog({
  open,
  onOpenChange,
  nc,
  onSave,
  isLoading = false,
}: NcFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [codigo, setCodigo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [origemTipo, setOrigemTipo] = useState<OrigemNC>("MANUAL");
  const [origemId, setOrigemId] = useState<string | null>(null);
  const [projetoId, setProjetoId] = useState("");
  const [siteId, setSiteId] = useState("none");
  const [areaId, setAreaId] = useState("none");
  const [responsavelId, setResponsavelId] = useState("none");
  const [dataIdentificacao, setDataIdentificacao] = useState("");
  const [criticidade, setCriticidade] = useState<CriticidadeNC>("MEDIA");
  const [prazo, setPrazo] = useState("");
  const [status, setStatus] = useState<StatusNC>("ABERTA");
  const [causa, setCausa] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Load projetos
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_nc", empresaId],
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
    queryKey: ["sites_nc", projetoId],
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
    queryKey: ["areas_nc", empresaId],
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
    queryKey: ["responsaveis_nc_form", empresaId],
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
    if (nc) {
      setCodigo(nc.codigo || "");
      setTitulo(nc.titulo || "");
      setDescricao(nc.descricao || "");
      setOrigemTipo(nc.origem_tipo || "MANUAL");
      setOrigemId(nc.origem_id || null);
      setProjetoId(nc.projeto_id || "");
      setSiteId(nc.site_id || "none");
      setAreaId(nc.area_id || "none");
      setResponsavelId(nc.responsavel_id || "none");
      setDataIdentificacao(nc.data_identificacao ? nc.data_identificacao.split("T")[0] : "");
      setCriticidade(nc.criticidade || "MEDIA");
      setPrazo(nc.prazo ? nc.prazo.split("T")[0] : "");
      setStatus(nc.status || "ABERTA");
      setCausa(nc.causa || "");
      setObservacoes(nc.observacoes || "");
    } else {
      setCodigo("");
      setTitulo("");
      setDescricao("");
      setOrigemTipo("MANUAL");
      setOrigemId(null);
      setProjetoId("");
      setSiteId("none");
      setAreaId("none");
      setResponsavelId("none");
      setDataIdentificacao(new Date().toISOString().split("T")[0]);
      setCriticidade("MEDIA");
      setPrazo("");
      setStatus("ABERTA");
      setCausa("");
      setObservacoes("");
    }
  }, [nc, open]);

  const isReadOnly = nc?.status === "CONCLUIDA" || nc?.status === "CANCELADA";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !projetoId || !descricao.trim()) return;

    await onSave({
      codigo: codigo.trim() || null,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      origem_tipo: origemTipo,
      origem_id: origemId,
      projeto_id: projetoId,
      site_id: siteId === "none" ? null : siteId,
      area_id: areaId === "none" ? null : areaId,
      responsavel_id: responsavelId === "none" ? null : responsavelId,
      data_identificacao: dataIdentificacao || new Date().toISOString().split("T")[0],
      criticidade,
      prazo: prazo || null,
      status,
      causa: causa.trim() || null,
      observacoes: observacoes.trim() || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertOctagon className="h-5 w-5" />
            {nc ? "Editar Não Conformidade" : "Registrar Nova Não Conformidade de Segurança"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
          {isReadOnly && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 text-xs font-medium">
              ⚠️ Esta Não Conformidade está {nc?.status} e não permite alterações operacionais.
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código NC</Label>
              <Input
                id="codigo"
                placeholder="Ex: NC-2026-001"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="origem">Tipo de Origem *</Label>
              <Select value={origemTipo} onValueChange={(val: OrigemNC) => setOrigemTipo(val)} disabled={isReadOnly}>
                <SelectTrigger id="origem">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual / Avulso</SelectItem>
                  <SelectItem value="INSPECAO">Inspeção de Segurança</SelectItem>
                  <SelectItem value="INCIDENTE">Incidente / Acidente</SelectItem>
                  <SelectItem value="PGR">PGR</SelectItem>
                  <SelectItem value="APR">APR</SelectItem>
                  <SelectItem value="PT">Permissão de Trabalho (PT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="criticidade">Criticidade *</Label>
              <Select value={criticidade} onValueChange={(val: CriticidadeNC) => setCriticidade(val)} disabled={isReadOnly}>
                <SelectTrigger id="criticidade">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                  <SelectItem value="MEDIA">Média</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="CRITICA">Crítica (Interdição/Risco)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título da Não Conformidade *</Label>
            <Input
              id="titulo"
              placeholder="Ex: Ausência de linha de vida estaiada no nível 5 da Fachada Leste"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              disabled={isReadOnly}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição da Não Conformidade / Apontamento *</Label>
            <Textarea
              id="descricao"
              placeholder="Detalhamento técnico da não conformidade observada, desacordo com a NR..."
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
              <Label htmlFor="responsavel">Responsável pelo Tratamento</Label>
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
              <Label htmlFor="dataIdentificacao">Data de Identificação *</Label>
              <Input
                id="dataIdentificacao"
                type="date"
                value={dataIdentificacao}
                onChange={(e) => setDataIdentificacao(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prazo">Prazo Limite de Adequação</Label>
              <Input
                id="prazo"
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="causa">Análise Inicial de Causa</Label>
            <Textarea
              id="causa"
              placeholder="Fator desencadeador da não conformidade..."
              rows={2}
              value={causa}
              onChange={(e) => setCausa(e.target.value)}
              disabled={isReadOnly}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || isReadOnly || !titulo.trim() || !projetoId || !descricao.trim()}>
              {isLoading ? "Salvando..." : nc ? "Atualizar Não Conformidade" : "Registrar Não Conformidade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
