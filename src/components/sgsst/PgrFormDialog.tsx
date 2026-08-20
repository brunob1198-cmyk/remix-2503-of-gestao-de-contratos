import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstPgr, SgsstPgrInput, StatusPgr } from "@/hooks/sgsst/useSgsstPgr";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PgrFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pgr?: SgsstPgr | null;
  onSave: (data: SgsstPgrInput) => Promise<void>;
  isLoading?: boolean;
}

export function PgrFormDialog({
  open,
  onOpenChange,
  pgr,
  onSave,
  isLoading = false,
}: PgrFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [codigo, setCodigo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [siteId, setSiteId] = useState("none");
  const [responsavelId, setResponsavelId] = useState("none");
  const [dataInicio, setDataInicio] = useState("");
  const [dataRevisao, setDataRevisao] = useState("");
  const [status, setStatus] = useState<StatusPgr>("RASCUNHO");
  const [objetivo, setObjetivo] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Campos que o documento emitido precisa (NR-01) e que nao existiam.
  const [metodologia, setMetodologia] = useState("");
  const [responsavelTecnico, setResponsavelTecnico] = useState("");
  const [registroResponsavel, setRegistroResponsavel] = useState("");
  const [periodicidadeRevisao, setPeriodicidadeRevisao] = useState("24");

  // Load projetos
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_pgr", empresaId],
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

  // Load sites for selected projeto
  const { data: sites = [] } = useQuery({
    queryKey: ["sites_pgr", projetoId],
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

  // Load profiles (responsaveis)
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["responsaveis_pgr", empresaId],
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
    if (pgr) {
      setCodigo(pgr.codigo || "");
      setTitulo(pgr.titulo || "");
      setProjetoId(pgr.projeto_id || "");
      setSiteId(pgr.site_id || "none");
      setResponsavelId(pgr.responsavel_id || "none");
      setDataInicio(pgr.data_inicio ? pgr.data_inicio.split("T")[0] : "");
      setDataRevisao(pgr.data_revisao ? pgr.data_revisao.split("T")[0] : "");
      setStatus(pgr.status || "RASCUNHO");
      setObjetivo(pgr.objetivo || "");
      setObservacoes(pgr.observacoes || "");
      setMetodologia(pgr.metodologia || "");
      setResponsavelTecnico(pgr.responsavel_tecnico || "");
      setRegistroResponsavel(pgr.registro_responsavel || "");
      setPeriodicidadeRevisao(String(pgr.periodicidade_revisao_meses ?? 24));
    } else {
      setCodigo("");
      setTitulo("");
      setProjetoId("");
      setSiteId("none");
      setResponsavelId("none");
      setDataInicio(new Date().toISOString().split("T")[0]);
      setDataRevisao("");
      setStatus("RASCUNHO");
      setObjetivo("");
      setObservacoes("");
      setMetodologia("");
      setResponsavelTecnico("");
      setRegistroResponsavel("");
      setPeriodicidadeRevisao("24");
    }
  }, [pgr, open]);

  const periodicidadeNumero = Number(periodicidadeRevisao);
  const periodicidadeInvalida =
    !Number.isInteger(periodicidadeNumero) || periodicidadeNumero < 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !projetoId || periodicidadeInvalida) return;

    await onSave({
      codigo: codigo.trim() || null,
      titulo: titulo.trim(),
      projeto_id: projetoId,
      site_id: siteId === "none" ? null : siteId,
      responsavel_id: responsavelId === "none" ? null : responsavelId,
      data_inicio: dataInicio || new Date().toISOString().split("T")[0],
      data_revisao: dataRevisao || null,
      status,
      objetivo: objetivo.trim() || null,
      observacoes: observacoes.trim() || null,
      metodologia: metodologia.trim() || null,
      responsavel_tecnico: responsavelTecnico.trim() || null,
      registro_responsavel: registroResponsavel.trim() || null,
      periodicidade_revisao_meses: periodicidadeNumero,
    });

    onOpenChange(false);
  };

  const isEncerrado = pgr?.status === "ENCERRADO";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pgr ? "Editar Documento PGR" : "Novo PGR (Programa de Gerenciamento de Riscos)"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {isEncerrado && (
            <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 text-xs font-medium">
              ⚠️ Este PGR está ENCERRADO. As alterações principais estão bloqueadas para conformidade legal.
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código do Documento</Label>
              <Input
                id="codigo"
                placeholder="Ex: PGR-2026-001"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                disabled={isEncerrado}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="titulo">Título do PGR *</Label>
              <Input
                id="titulo"
                placeholder="Ex: PGR — PROGRAMA DE GERENCIAMENTO DE RISCOS DA OBRA O010.25"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                disabled={isEncerrado}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="projeto">Obra / Projeto *</Label>
              <Select value={projetoId} onValueChange={setProjetoId} disabled={isEncerrado}>
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
              <Select value={siteId} onValueChange={setSiteId} disabled={isEncerrado || !projetoId}>
                <SelectTrigger id="site">
                  <SelectValue placeholder="Selecione o canteiro..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Todos os Canteiros / Todos os Sites --</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      [{s.codigo}] {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="responsavel">Responsável Técnico</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId} disabled={isEncerrado}>
                <SelectTrigger id="responsavel">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Não Definido --</SelectItem>
                  {responsaveis.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome || "Sem Nome"} {r.cargo ? `(${r.cargo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataInicio">Data de Início Vigência *</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                required
                disabled={isEncerrado}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataRevisao">Data de Próxima Revisão</Label>
              <Input
                id="dataRevisao"
                type="date"
                value={dataRevisao}
                onChange={(e) => setDataRevisao(e.target.value)}
                disabled={isEncerrado}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status do PGR</Label>
            <Select value={status} onValueChange={(val: StatusPgr) => setStatus(val)} disabled={isEncerrado}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Selecione o status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RASCUNHO">RASCUNHO</SelectItem>
                <SelectItem value="ATIVO">ATIVO</SelectItem>
                <SelectItem value="EM_REVISAO">EM_REVISAO</SelectItem>
                <SelectItem value="ENCERRADO">ENCERRADO</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="objetivo">Objetivo e Escopo do PGR</Label>
            <Textarea
              id="objetivo"
              placeholder="Descreva o objetivo geral do Programa de Gerenciamento de Riscos..."
              rows={2}
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              disabled={isEncerrado}
            />
          </div>

          {/* Campos que o PGR emitido precisa (NR-01) */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div>
              <h4 className="text-sm font-semibold leading-none">Responsabilidade e revisão</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Aparecem no PGR emitido. Sem responsável técnico e metodologia, o documento sai
                com aviso de pendência.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="respTec">Responsável técnico</Label>
                <Input
                  id="respTec"
                  placeholder="Nome de quem assina"
                  value={responsavelTecnico}
                  onChange={(e) => setResponsavelTecnico(e.target.value)}
                  disabled={isEncerrado}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="regResp">Registro profissional</Label>
                <Input
                  id="regResp"
                  placeholder="Ex: CREA 123456"
                  value={registroResponsavel}
                  onChange={(e) => setRegistroResponsavel(e.target.value)}
                  disabled={isEncerrado}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="periodRev">Revisar a cada (meses)</Label>
                <Input
                  id="periodRev"
                  type="number"
                  min={1}
                  value={periodicidadeRevisao}
                  onChange={(e) => setPeriodicidadeRevisao(e.target.value)}
                  disabled={isEncerrado}
                  aria-invalid={periodicidadeInvalida}
                  className={periodicidadeInvalida ? "border-destructive" : undefined}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              A NR-01 1.5.4.4.5 pede revisão a cada <strong>24 meses</strong>, ou <strong>36</strong>{" "}
              quando há sistema de gestão de SST certificado. O prazo é contado da última
              revisão registrada — ou do início da vigência, se nunca houve revisão.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="metodologia">Metodologia de identificação e avaliação</Label>
              <Textarea
                id="metodologia"
                rows={2}
                placeholder="Ex: Identificação por observação direta e entrevista; avaliação por matriz 5x5 de probabilidade e severidade; medições conforme NHO da Fundacentro"
                value={metodologia}
                onChange={(e) => setMetodologia(e.target.value)}
                disabled={isEncerrado}
              />
              <p className="text-xs text-muted-foreground">
                A norma exige que o programa declare como os riscos foram identificados e
                avaliados. É a seção que o fiscal lê antes do inventário.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Observações Gerais</Label>
            <Textarea
              id="observacoes"
              placeholder="Notas adicionais sobre o histórico ou emissão..."
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={isEncerrado}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading || isEncerrado || !titulo.trim() || !projetoId || periodicidadeInvalida
              }
            >
              {isLoading ? "Salvando..." : pgr ? "Atualizar" : "Cadastrar PGR"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
