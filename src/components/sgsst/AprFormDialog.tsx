import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstApr, SgsstAprInput, StatusApr } from "@/hooks/sgsst/useSgsstApr";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AprFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apr?: SgsstApr | null;
  onSave: (data: SgsstAprInput) => Promise<void>;
  isLoading?: boolean;
}

export function AprFormDialog({
  open,
  onOpenChange,
  apr,
  onSave,
  isLoading = false,
}: AprFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [codigo, setCodigo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [siteId, setSiteId] = useState("none");
  const [areaId, setAreaId] = useState("none");
  const [atividade, setAtividade] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState("none");
  const [data, setData] = useState("");
  const [validade, setValidade] = useState("");
  const [status, setStatus] = useState<StatusApr>("RASCUNHO");
  const [observacoes, setObservacoes] = useState("");

  // Load projetos
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_apr", empresaId],
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
    queryKey: ["sites_apr", projetoId],
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
    queryKey: ["areas_apr", empresaId],
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
    queryKey: ["responsaveis_apr", empresaId],
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
    if (apr) {
      setCodigo(apr.codigo || "");
      setTitulo(apr.titulo || "");
      setProjetoId(apr.projeto_id || "");
      setSiteId(apr.site_id || "none");
      setAreaId(apr.area_id || "none");
      setAtividade(apr.atividade || "");
      setDescricao(apr.descricao || "");
      setResponsavelId(apr.responsavel_id || "none");
      setData(apr.data ? apr.data.split("T")[0] : "");
      setValidade(apr.validade ? apr.validade.split("T")[0] : "");
      setStatus(apr.status || "RASCUNHO");
      setObservacoes(apr.observacoes || "");
    } else {
      setCodigo("");
      setTitulo("");
      setProjetoId("");
      setSiteId("none");
      setAreaId("none");
      setAtividade("");
      setDescricao("");
      setResponsavelId("none");
      setData(new Date().toISOString().split("T")[0]);
      setValidade("");
      setStatus("RASCUNHO");
      setObservacoes("");
    }
  }, [apr, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !projetoId || !atividade.trim()) return;

    await onSave({
      codigo: codigo.trim() || null,
      titulo: titulo.trim(),
      projeto_id: projetoId,
      site_id: siteId === "none" ? null : siteId,
      area_id: areaId === "none" ? null : areaId,
      atividade: atividade.trim(),
      descricao: descricao.trim() || null,
      responsavel_id: responsavelId === "none" ? null : responsavelId,
      data: data || new Date().toISOString().split("T")[0],
      validade: validade || null,
      status,
      observacoes: observacoes.trim() || null,
    });

    onOpenChange(false);
  };

  const isReadOnly = apr?.status === "APROVADA" || apr?.status === "CANCELADA" || apr?.status === "ENCERRADA";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>{apr ? "Editar APR (Análise Preliminar de Riscos)" : "Nova APR (Análise Preliminar de Riscos)"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {isReadOnly && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 text-xs font-medium">
              ⚠️ Esta APR está {apr?.status}. Para alterar sua estrutura, ela deve retornar para o estado de RASCUNHO/EM_ANALISE.
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código do Documento</Label>
              <Input
                id="codigo"
                placeholder="Ex: APR-2026-001"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="titulo">Título da APR *</Label>
              <Input
                id="titulo"
                placeholder="Ex: APR — TRABALHO EM ALTURA E MONTAGEM DE ESTRUTURA"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
              <Label htmlFor="site">Canteiro / Site (Opcional)</Label>
              <Select value={siteId} onValueChange={setSiteId} disabled={isReadOnly || !projetoId}>
                <SelectTrigger id="site">
                  <SelectValue placeholder="Selecione o canteiro..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Todos os Canteiros / Sites --</SelectItem>
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
              <Label htmlFor="area">Setor / Área de Execução</Label>
              <Select value={areaId} onValueChange={setAreaId} disabled={isReadOnly}>
                <SelectTrigger id="area">
                  <SelectValue placeholder="Selecione o setor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Geral da Obra --</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="atividade">Atividade / Tarefa Avaliada *</Label>
              <Input
                id="atividade"
                placeholder="Ex: Içamento de vigas de aço com guindaste"
                value={atividade}
                onChange={(e) => setAtividade(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="responsavel">Elaborador / Responsável</Label>
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
              <Label htmlFor="data">Data de Elaboração *</Label>
              <Input
                id="data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="validade">Validade da APR</Label>
              <Input
                id="validade"
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição Detalhada dos Trabalhos</Label>
            <Textarea
              id="descricao"
              placeholder="Descreva a metodologia executiva da tarefa..."
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={isReadOnly}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Observações de Segurança / Recomendações</Label>
            <Textarea
              id="observacoes"
              placeholder="Ex: Condições impeditivas de trabalho em caso de chuva ou vento superior a 35km/h..."
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
              {isLoading ? "Salvando..." : apr ? "Atualizar APR" : "Cadastrar APR"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
