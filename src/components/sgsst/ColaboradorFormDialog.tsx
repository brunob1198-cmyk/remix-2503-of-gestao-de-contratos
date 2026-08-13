import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SgsstColaboradorDados, SgsstColaboradorInput } from "@/hooks/sgsst/useSgsstColaboradores";
import { SgsstFuncao } from "@/hooks/sgsst/useSgsstFuncoes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ColaboradorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaborador?: SgsstColaboradorDados | null;
  funcoes: SgsstFuncao[];
  onSave: (data: SgsstColaboradorInput) => Promise<void>;
  isLoading?: boolean;
}

export function ColaboradorFormDialog({
  open,
  onOpenChange,
  colaborador,
  funcoes,
  onSave,
  isLoading = false,
}: ColaboradorFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const [profileId, setProfileId] = useState<string>("none");
  const [recursoId, setRecursoId] = useState<string>("none");
  const [funcaoId, setFuncaoId] = useState<string>("none");
  const [areaId, setAreaId] = useState<string>("none");
  const [matricula, setMatricula] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [dataDemissao, setDataDemissao] = useState("");
  const [tipoVinculo, setTipoVinculo] = useState<"CLT" | "PJ" | "Terceirizado" | "Estagiario" | "Outro">("CLT");
  const [status, setStatus] = useState<"ativo" | "afastado" | "desligado">("ativo");

  // Load profiles from the same empresa
  const { data: profilesList = [] } = useQuery({
    queryKey: ["profiles_list", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cpf, cargo")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Load recursos (trabalhadores) from the same empresa
  const { data: recursosList = [] } = useQuery({
    queryKey: ["recursos_list", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("recursos" as any)
        .select("id, nome, cargo, tipo")
        .eq("empresa_id", empresaId!) as any);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Load areas (setores) from the same empresa
  const { data: areasList = [] } = useQuery({
    queryKey: ["areas_list", empresaId],
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

  useEffect(() => {
    if (colaborador) {
      setProfileId(colaborador.profile_id || "none");
      setRecursoId(colaborador.recurso_id || "none");
      setFuncaoId(colaborador.funcao_id || "none");
      setAreaId(colaborador.area_id || "none");
      setMatricula(colaborador.matricula || "");
      setDataAdmissao(colaborador.data_admissao || "");
      setDataDemissao(colaborador.data_demissao || "");
      setTipoVinculo(colaborador.tipo_vinculo || "CLT");
      setStatus(colaborador.status || "ativo");
    } else {
      setProfileId("none");
      setRecursoId("none");
      setFuncaoId("none");
      setAreaId("none");
      setMatricula("");
      setDataAdmissao("");
      setDataDemissao("");
      setTipoVinculo("CLT");
      setStatus("ativo");
    }
  }, [colaborador, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const actualProfileId = profileId === "none" ? null : profileId;
    const actualRecursoId = recursoId === "none" ? null : recursoId;
    const actualFuncaoId = funcaoId === "none" ? null : funcaoId;
    const actualAreaId = areaId === "none" ? null : areaId;

    await onSave({
      profile_id: actualProfileId,
      recurso_id: actualRecursoId,
      funcao_id: actualFuncaoId,
      area_id: actualAreaId,
      matricula: matricula.trim() || null,
      data_admissao: dataAdmissao || null,
      data_demissao: dataDemissao || null,
      tipo_vinculo: tipoVinculo,
      status,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {colaborador ? "Editar Dados do Colaborador (SGSST)" : "Novo Registro de Colaborador (SGSST)"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile">Usuário do Sistema (Profiles)</Label>
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger id="profile">
                  <SelectValue placeholder="Selecione um usuário..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Nenhum / Trabalhador sem Login --</SelectItem>
                  {profilesList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome || "Sem Nome"} {p.cpf ? `(CPF: ${p.cpf})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="recurso">Recurso de Canteiro / Trabalhador</Label>
              <Select value={recursoId} onValueChange={setRecursoId}>
                <SelectTrigger id="recurso">
                  <SelectValue placeholder="Selecione um recurso..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Nenhum --</SelectItem>
                  {recursosList.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome} {r.cargo ? `(${r.cargo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="funcao">Função Ocupacional / Cargo SGSST</Label>
              <Select value={funcaoId} onValueChange={setFuncaoId}>
                <SelectTrigger id="funcao">
                  <SelectValue placeholder="Selecione a função..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Nenhuma Função --</SelectItem>
                  {funcoes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome} {f.cbo ? `(CBO ${f.cbo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="area">Setor / Área de Trabalho</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger id="area">
                  <SelectValue placeholder="Selecione a área..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Nenhuma Área --</SelectItem>
                  {areasList.map((a) => (
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
              <Label htmlFor="matricula">Matrícula</Label>
              <Input
                id="matricula"
                placeholder="Ex: MAT-00123"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tipoVinculo">Tipo de Vínculo</Label>
              <Select
                value={tipoVinculo}
                onValueChange={(val: "CLT" | "PJ" | "Terceirizado" | "Estagiario" | "Outro") => setTipoVinculo(val)}
              >
                <SelectTrigger id="tipoVinculo">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLT">CLT</SelectItem>
                  <SelectItem value="PJ">PJ</SelectItem>
                  <SelectItem value="Terceirizado">Terceirizado</SelectItem>
                  <SelectItem value="Estagiario">Estagiário</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(val: "ativo" | "afastado" | "desligado") => setStatus(val)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                  <SelectItem value="desligado">Desligado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dataAdmissao">Data de Admissão</Label>
              <Input
                id="dataAdmissao"
                type="date"
                value={dataAdmissao}
                onChange={(e) => setDataAdmissao(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dataDemissao">Data de Demissão</Label>
              <Input
                id="dataDemissao"
                type="date"
                value={dataDemissao}
                onChange={(e) => setDataDemissao(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : colaborador ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
