import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SgsstColaboradorDados } from "@/hooks/sgsst/useSgsstColaboradores";
import { useSgsstFuncoes } from "@/hooks/sgsst/useSgsstFuncoes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uploadImage } from "@/services/uploadImage";
import { resolveFileUrl } from "@/utils/fileUrlResolver";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Upload, Briefcase, Shield, MapPin, Calendar, FileCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ColaboradorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaboradorToEdit?: SgsstColaboradorDados | null;
  onSave: (data: any) => Promise<void>;
}

export function ColaboradorFormDialog({
  open,
  onOpenChange,
  colaboradorToEdit,
  onSave,
}: ColaboradorFormDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const { funcoes } = useSgsstFuncoes();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFoto, setIsUploadingFoto] = useState(false);

  // Form States
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [genero, setGenero] = useState("Masculino");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [fotoR2Key, setFotoR2Key] = useState("");

  const [funcaoId, setFuncaoId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [matricula, setMatricula] = useState("");
  const [tipoVinculo, setTipoVinculo] = useState<"CLT" | "PJ" | "Terceirizado" | "Estagiario" | "Outro">("CLT");
  const [status, setStatus] = useState<"ativo" | "afastado" | "desligado">("ativo");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [dataDemissao, setDataDemissao] = useState("");

  const [cnhNumero, setCnhNumero] = useState("");
  const [cnhCategoria, setCnhCategoria] = useState("");
  const [cnhValidade, setCnhValidade] = useState("");

  const [tamanhoCalcado, setTamanhoCalcado] = useState("");
  const [tamanhoCamisa, setTamanhoCamisa] = useState("");
  const [tamanhoCalca, setTamanhoCalca] = useState("");
  const [endereco, setEndereco] = useState("");

  // Load Areas
  const { data: areas = [] } = useQuery({
    queryKey: ["areas_select_colab", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("areas" as any).select("id, nome").eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Load Projetos
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_select_colab", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos" as any).select("id, codigo, nome").eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (colaboradorToEdit) {
      setNome(colaboradorToEdit.nome || colaboradorToEdit.profile?.nome || colaboradorToEdit.recurso?.nome || "");
      setCpf(colaboradorToEdit.cpf || colaboradorToEdit.profile?.cpf || "");
      setRg(colaboradorToEdit.rg || "");
      setDataNascimento(colaboradorToEdit.data_nascimento || "");
      setGenero(colaboradorToEdit.genero || "Masculino");
      setTelefone(colaboradorToEdit.telefone || "");
      setEmail(colaboradorToEdit.email || "");
      setFotoUrl(colaboradorToEdit.foto_url || colaboradorToEdit.profile?.avatar_url || "");
      setFotoR2Key(colaboradorToEdit.foto_r2_key || "");

      setFuncaoId(colaboradorToEdit.funcao_id || "");
      setAreaId(colaboradorToEdit.area_id || "");
      setProjetoId(colaboradorToEdit.projeto_id || "");
      setMatricula(colaboradorToEdit.matricula || "");
      setTipoVinculo(colaboradorToEdit.tipo_vinculo || "CLT");
      setStatus(colaboradorToEdit.status || "ativo");
      setDataAdmissao(colaboradorToEdit.data_admissao || "");
      setDataDemissao(colaboradorToEdit.data_demissao || "");

      setCnhNumero(colaboradorToEdit.cnh_numero || "");
      setCnhCategoria(colaboradorToEdit.cnh_categoria || "");
      setCnhValidade(colaboradorToEdit.cnh_validade || "");

      setTamanhoCalcado(colaboradorToEdit.tamanho_calcado || "");
      setTamanhoCamisa(colaboradorToEdit.tamanho_camisa || "");
      setTamanhoCalca(colaboradorToEdit.tamanho_calca || "");
      setEndereco(colaboradorToEdit.endereco || "");
    } else {
      setNome("");
      setCpf("");
      setRg("");
      setDataNascimento("");
      setGenero("Masculino");
      setTelefone("");
      setEmail("");
      setFotoUrl("");
      setFotoR2Key("");
      setFuncaoId("");
      setAreaId("");
      setProjetoId("");
      setMatricula("");
      setTipoVinculo("CLT");
      setStatus("ativo");
      setDataAdmissao("");
      setDataDemissao("");
      setCnhNumero("");
      setCnhCategoria("");
      setCnhValidade("");
      setTamanhoCalcado("");
      setTamanhoCamisa("");
      setTamanhoCalca("");
      setEndereco("");
    }
  }, [colaboradorToEdit, open]);

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingFoto(true);
      const res = await uploadImage(file);
      if (res) {
        setFotoUrl(res);
        setFotoR2Key(res);
        toast.success("Foto do colaborador enviada com sucesso!");
      }
    } catch (err: any) {
      toast.error(`Erro ao fazer upload da foto: ${err.message || err}`);
    } finally {
      setIsUploadingFoto(false);
    }
  };

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").substring(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const formatRG = (value: string) => {
    // RG varies by state, but let's follow a common pattern: 00.000.000-0 or 00.000.000-X
    const clean = value.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
    if (clean.length <= 9) {
      return clean
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})([0-9X])$/, "$1-$2");
    }
    return clean;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Por favor, preencha o nome do colaborador.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        nome: nome.trim(),
        cpf: cpf.trim() || null,
        rg: rg.trim() || null,
        data_nascimento: dataNascimento || null,
        genero,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        foto_url: fotoUrl || null,
        foto_r2_key: fotoR2Key || null,
        funcao_id: funcaoId || null,
        area_id: areaId || null,
        projeto_id: projetoId || null,
        matricula: matricula.trim() || null,
        tipo_vinculo: tipoVinculo,
        status,
        data_admissao: dataAdmissao || null,
        data_demissao: dataDemissao || null,
        cnh_numero: cnhNumero.trim() || null,
        cnh_categoria: cnhCategoria.trim() || null,
        cnh_validade: cnhValidade || null,
        tamanho_calcado: tamanhoCalcado.trim() || null,
        tamanho_camisa: tamanhoCamisa.trim() || null,
        tamanho_calca: tamanhoCalca.trim() || null,
        endereco: endereco.trim() || null,
      });
      onOpenChange(false);
    } catch (err) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <User className="h-5 w-5 text-primary" />
            {colaboradorToEdit ? "Editar Cadastro de Colaborador" : "Novo Cadastro de Colaborador (Dossiê SST)"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <Tabs defaultValue="pessoal" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="pessoal" className="gap-1 text-xs">
                <User className="h-3.5 w-3.5" /> 1. Dados Pessoais
              </TabsTrigger>
              <TabsTrigger value="ocupacional" className="gap-1 text-xs">
                <Briefcase className="h-3.5 w-3.5" /> 2. Função & Vínculo
              </TabsTrigger>
              <TabsTrigger value="complementar" className="gap-1 text-xs">
                <Shield className="h-3.5 w-3.5" /> 3. EPIs, CNH & Endereço
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: DADOS PESSOAIS */}
            <TabsContent value="pessoal" className="space-y-4 pt-3">
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-slate-50 rounded-lg border">
                <Avatar className="h-20 w-20 border-2 border-primary/20">
                  <AvatarImage src={fotoUrl ? resolveFileUrl(fotoUrl) : ""} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                    {nome ? nome.substring(0, 2).toUpperCase() : "COL"}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-1 text-center sm:text-left flex-1">
                  <Label className="text-xs font-semibold">Foto de Perfil do Trabalhador</Label>
                  <p className="text-xs text-muted-foreground">Upload de imagem oficial para crachá e ficha de EPI/ASO.</p>
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleFotoUpload}
                      disabled={isUploadingFoto}
                      className="text-xs max-w-xs"
                    />
                    {isUploadingFoto && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nome Completo *</Label>
                  <Input
                    placeholder="Ex: João da Silva"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">CPF</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    maxLength={14}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">RG</Label>
                  <Input
                    placeholder="Ex: 12.345.678-9"
                    value={rg}
                    onChange={(e) => setRg(formatRG(e.target.value))}
                    maxLength={12}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Gênero</Label>
                  <Select value={genero} onValueChange={setGenero}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                      <SelectItem value="Outro">Outro / Não Informado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
                  <Input
                    placeholder="(00) 90000-0000"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">E-mail Profissional/Pessoal</Label>
                  <Input
                    type="email"
                    placeholder="joao@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: OCUPACIONAL & VÍNCULO */}
            <TabsContent value="ocupacional" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Função Ocupacional / Cargo SGSST *</Label>
                  <Select value={funcaoId} onValueChange={setFuncaoId}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Selecione a função..." />
                    </SelectTrigger>
                    <SelectContent>
                      {funcoes.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome} {f.cbo ? `(CBO: ${f.cbo})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Setor / Área de Trabalho</Label>
                  <Select value={areaId} onValueChange={setAreaId}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Selecione o setor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Obra / Projeto Alocado</Label>
                  <Select value={projetoId} onValueChange={setProjetoId}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Selecione o projeto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projetos.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          [{p.codigo}] {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Matrícula</Label>
                  <Input
                    placeholder="Ex: MAT-00123"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Tipo de Vínculo</Label>
                  <Select value={tipoVinculo} onValueChange={(val: any) => setTipoVinculo(val)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLT">CLT</SelectItem>
                      <SelectItem value="PJ">PJ / Quarteirizado</SelectItem>
                      <SelectItem value="Terceirizado">Terceirizado</SelectItem>
                      <SelectItem value="Estagiario">Estagiário</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Status do Trabalhador</Label>
                  <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="afastado">Afastado (INSS / Licença)</SelectItem>
                      <SelectItem value="desligado">Desligado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Data de Admissão</Label>
                  <Input
                    type="date"
                    value={dataAdmissao}
                    onChange={(e) => setDataAdmissao(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Data de Demissão</Label>
                  <Input
                    type="date"
                    value={dataDemissao}
                    onChange={(e) => setDataDemissao(e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: EPIs, CNH & ENDEREÇO */}
            <TabsContent value="complementar" className="space-y-4 pt-3">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Grade de Tamanhos para EPI</h4>
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded border">
                  <div className="space-y-1">
                    <Label className="text-xs">Calçado / Bota</Label>
                    <Input placeholder="Ex: 41" value={tamanhoCalcado} onChange={(e) => setTamanhoCalcado(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Camisa / Camiseta</Label>
                    <Input placeholder="Ex: G" value={tamanhoCamisa} onChange={(e) => setTamanhoCamisa(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Calça / Uniforme</Label>
                    <Input placeholder="Ex: 42" value={tamanhoCalca} onChange={(e) => setTamanhoCalca(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Carteira de Habilitação (CNH)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded border">
                  <div className="space-y-1">
                    <Label className="text-xs">N° CNH</Label>
                    <Input placeholder="00000000000" value={cnhNumero} onChange={(e) => setCnhNumero(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Categoria</Label>
                    <Input placeholder="Ex: AB, D" value={cnhCategoria} onChange={(e) => setCnhCategoria(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Validade CNH</Label>
                    <Input type="date" value={cnhValidade} onChange={(e) => setCnhValidade(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Endereço Residencial Completo</Label>
                <Textarea
                  rows={2}
                  placeholder="Rua, Número, Bairro, Cidade - UF, CEP"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : colaboradorToEdit ? "Salvar Alterações" : "Cadastrar Colaborador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
