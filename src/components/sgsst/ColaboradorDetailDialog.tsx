import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SgsstColaboradorDados,
  SgsstColaboradorTreinamento,
  useSgsstColaboradores,
} from "@/hooks/sgsst/useSgsstColaboradores";
import { resolveFileUrl } from "@/utils/fileUrlResolver";
import { uploadImage } from "@/services/uploadImage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { calculateVencimentoTreinamento } from "@/utils/sgsstTreinamentosUtils";
import {
  User,
  GraduationCap,
  FileCheck,
  Plus,
  Trash2,
  Download,
  ExternalLink,
  Loader2,
  Calendar,
  Shield,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  IdCard,
  FileDown,
  Edit2,
} from "lucide-react";
import { useEmpresaAtual } from "@/hooks/useEmpresaAtual";
import { useAuth } from "@/contexts/AuthContext";
import { useSgsstColaboradorDossie } from "@/hooks/sgsst/useSgsstColaboradorDossie";
import { gerarPdfDossie, pendenciasDossie } from "@/lib/dossieDocumento";
import { format, parseISO, differenceInYears } from "date-fns";
import { toast } from "sonner";

interface ColaboradorDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaborador: SgsstColaboradorDados | null;
}

export function ColaboradorDetailDialog({
  open,
  onOpenChange,
  colaborador,
}: ColaboradorDetailDialogProps) {
  const { addTreinamento, updateTreinamento, removeTreinamento } = useSgsstColaboradores();
  const { empresa } = useEmpresaAtual();
  const { profile: usuario } = useAuth();

  // As quatro fontes do dossiê só são consultadas com o diálogo aberto: a lista
  // tem dezenas de linhas, e carregar quatro consultas por linha seria custo sem
  // uso nenhum.
  const dossie = useSgsstColaboradorDossie(colaborador?.id, { enabled: open });

  // Data em dd/MM/yyyy, tolerante a valor invalido: a coluna e texto e o dossie
  // nao pode estourar por causa de uma data mal gravada.
  const dataBr = (valor?: string | null) => {
    if (!valor) return '—';
    try {
      return format(parseISO(valor), 'dd/MM/yyyy');
    } catch {
      return valor;
    }
  };
  const [emitindo, setEmitindo] = useState(false);

  const emitirDossie = async () => {
    if (!colaborador) return;

    const dadosDoDossie = {
      colaborador,
      treinamentosDoDossie: colaborador.treinamentos ?? [],
      matriculas: dossie.matriculas,
      asos: dossie.asos,
      entregasEpi: dossie.entregasEpi,
      pendencias: dossie.pendencias,
      empresa: empresa ?? null,
      geradoPor: usuario?.nome ?? null,
    };

    // Fonte que falhou é dita, não silenciada: um dossiê que sai sem a seção de
    // ASO porque a consulta caiu pareceria um trabalhador sem exame algum.
    if (dossie.erros.length > 0) {
      toast.warning("Parte do dossiê não pôde ser lida", {
        description: `Sem dados de: ${dossie.erros.map((e) => e.fonte).join(", ")}.`,
      });
    }

    const pendencias = pendenciasDossie(dadosDoDossie);
    if (pendencias.length > 0) {
      toast.warning(`${pendencias.length} pendência(s) no dossiê`, {
        description: pendencias.slice(0, 3).join(" · "),
      });
    }

    setEmitindo(true);
    try {
      await gerarPdfDossie(dadosDoDossie);
    } catch (e) {
      toast.error(`Erro ao emitir o dossiê: ${(e as Error).message}`);
    } finally {
      setEmitindo(false);
    }
  };

  const [isAddingTreinamento, setIsAddingTreinamento] = useState(false);
  // Nulo = cadastrando; preenchido = corrigindo um lancamento existente.
  const [treinamentoEmEdicao, setTreinamentoEmEdicao] = useState<SgsstColaboradorTreinamento | null>(null);
  const [isUploadingCert, setIsUploadingCert] = useState(false);

  // New Training Form States
  const [nomeTreinamento, setNomeTreinamento] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState<string>("8");
  const [dataConclusao, setDataConclusao] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [certificadoUrl, setCertificadoUrl] = useState("");
  const [certificadoR2Key, setCertificadoR2Key] = useState("");
  const [observacoes, setObservacoes] = useState("");

  if (!colaborador) return null;

  const nome = colaborador.nome || colaborador.profile?.nome || colaborador.recurso?.nome || "Colaborador";
  const foto = colaborador.foto_url || colaborador.profile?.avatar_url || "";

  // Calculate Age
  let idade = "—";
  if (colaborador.data_nascimento) {
    try {
      idade = `${differenceInYears(new Date(), parseISO(colaborador.data_nascimento))} anos`;
    } catch {
      idade = "—";
    }
  }

  const handleCertificadoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingCert(true);
      const res = await uploadImage(file);
      if (res) {
        setCertificadoUrl(res);
        setCertificadoR2Key(res);
        toast.success("Certificado enviado ao Cloudflare R2 com sucesso!");
      }
    } catch (err: any) {
      toast.error(`Erro ao enviar certificado: ${err.message || err}`);
    } finally {
      setIsUploadingCert(false);
    }
  };

  const limparFormularioDoTreinamento = () => {
    setNomeTreinamento("");
    setCargaHoraria("8");
    setDataConclusao("");
    setDataValidade("");
    setCertificadoUrl("");
    setCertificadoR2Key("");
    setObservacoes("");
    setTreinamentoEmEdicao(null);
    setIsAddingTreinamento(false);
  };

  /**
   * Abre o formulário limpo para um cadastro novo.
   *
   * Zera `treinamentoEmEdicao` antes de abrir: reaproveitar o mesmo formulário
   * para os dois casos é o que evita duplicar tela, mas deixa a armadilha de
   * abrir "novo" ainda apontando para o registro que acabou de ser editado — e o
   * cadastro sobrescreveria aquele lançamento em vez de criar outro.
   */
  const limparFormularioAbrindoCadastro = () => {
    limparFormularioDoTreinamento();
    setIsAddingTreinamento(true);
  };

  /** Abre o mesmo formulário do cadastro, já preenchido com o lançamento. */
  const iniciarEdicaoDoTreinamento = (tr: SgsstColaboradorTreinamento) => {
    setTreinamentoEmEdicao(tr);
    setNomeTreinamento(tr.nome_treinamento ?? "");
    setCargaHoraria(String(tr.carga_horaria ?? 8));
    setDataConclusao(tr.data_conclusao ?? "");
    setDataValidade(tr.data_validade ?? "");
    // O anexo vem junto: é o que se perdia no caminho de apagar e lançar de novo.
    setCertificadoUrl(tr.certificado_url ?? "");
    setCertificadoR2Key(tr.certificado_r2_key ?? "");
    setObservacoes(tr.observacoes ?? "");
    setIsAddingTreinamento(true);
  };

  const handleSaveTreinamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeTreinamento.trim()) {
      toast.error("Informe o nome do treinamento ou NR.");
      return;
    }

    try {
      if (treinamentoEmEdicao) {
        await updateTreinamento.mutateAsync({
          id: treinamentoEmEdicao.id,
          nome_treinamento: nomeTreinamento.trim(),
          carga_horaria: cargaHoraria ? parseInt(cargaHoraria) : 8,
          // `null` e não `undefined` na edição: `undefined` seria omitido do update
          // e o campo ficaria com o valor antigo — limpar uma data seria impossível.
          data_conclusao: dataConclusao || null,
          data_validade: dataValidade || null,
          certificado_url: certificadoUrl || null,
          certificado_r2_key: certificadoR2Key || null,
          observacoes: observacoes.trim() || null,
        });
      } else {
        await addTreinamento.mutateAsync({
          colaborador_id: colaborador.id,
          nome_treinamento: nomeTreinamento.trim(),
          carga_horaria: cargaHoraria ? parseInt(cargaHoraria) : 8,
          data_conclusao: dataConclusao || undefined,
          data_validade: dataValidade || undefined,
          certificado_url: certificadoUrl || undefined,
          certificado_r2_key: certificadoR2Key || undefined,
          observacoes: observacoes.trim() || undefined,
        });
      }

      limparFormularioDoTreinamento();
    } catch (err) {
      // Handled in mutation
    }
  };

  const handleRemoveTr = async (id: string) => {
    if (confirm("Tem certeza que deseja remover este registro de treinamento?")) {
      await removeTreinamento.mutateAsync(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={foto ? resolveFileUrl(foto) : ""} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                {nome.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {nome}
              </DialogTitle>
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 pt-1">
                <span>Função: <strong className="text-foreground">{colaborador.funcao?.nome || "Sem Função"}</strong></span>
                <span>CPF: <strong className="text-foreground">{colaborador.cpf || "—"}</strong></span>
                <span>Idade: <strong className="text-foreground">{idade}</strong></span>
                <Badge variant="outline" className="capitalize text-xs font-semibold">
                  {colaborador.status}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="dossie" className="w-full pt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="dossie" className="gap-1.5 text-xs">
              <User className="h-3.5 w-3.5" /> Dossiê Completo do Colaborador
            </TabsTrigger>
            <TabsTrigger value="treinamentos" className="gap-1.5 text-xs">
              <GraduationCap className="h-3.5 w-3.5" /> NRs & Certificados ({colaborador.treinamentos?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: DOSSIÊ COMPLETO */}
          <TabsContent value="dossie" className="space-y-4 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="py-2.5 px-4 bg-slate-50 border-b">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 text-slate-800">
                    <IdCard className="h-4 w-4 text-primary" /> Identificação & Documentos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Nome Completo:</span>
                    <span className="font-semibold">{nome}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">CPF:</span>
                    <span className="font-semibold">{colaborador.cpf || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">RG:</span>
                    <span className="font-semibold">{colaborador.rg || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Nascimento:</span>
                    <span className="font-semibold">{colaborador.data_nascimento || "—"} ({idade})</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Gênero:</span>
                    <span className="font-semibold">{colaborador.genero || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Telefone:</span>
                    <span className="font-semibold">{colaborador.telefone || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">E-mail:</span>
                    <span className="font-semibold">{colaborador.email || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-2.5 px-4 bg-slate-50 border-b">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 text-slate-800">
                    <Briefcase className="h-4 w-4 text-primary" /> Dados Contratuais & Setor
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Função SGSST:</span>
                    <span className="font-semibold text-primary">{colaborador.funcao?.nome || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Setor / Área:</span>
                    <span className="font-semibold">{colaborador.area?.nome || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Obra / Projeto:</span>
                    <span className="font-semibold">{colaborador.projeto ? `[${colaborador.projeto.codigo}] ${colaborador.projeto.nome}` : "—"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Matrícula:</span>
                    <span className="font-mono font-semibold">{colaborador.matricula || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Tipo de Vínculo:</span>
                    <span className="font-semibold">{colaborador.tipo_vinculo}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Admissão:</span>
                    <span className="font-semibold">{colaborador.data_admissao || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-2.5 px-4 bg-slate-50 border-b">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 text-slate-800">
                    <Shield className="h-4 w-4 text-primary" /> Grade EPI & CNH
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Calçado:</span>
                    <span className="font-bold">{colaborador.tamanho_calcado || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Camisa:</span>
                    <span className="font-bold">{colaborador.tamanho_camisa || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Calça:</span>
                    <span className="font-bold">{colaborador.tamanho_calca || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">CNH / Categoria:</span>
                    <span className="font-semibold">{colaborador.cnh_numero ? `${colaborador.cnh_numero} (Cat: ${colaborador.cnh_categoria || "A/B"})` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Validade CNH:</span>
                    <span className="font-semibold">{colaborador.cnh_validade || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-2.5 px-4 bg-slate-50 border-b">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 text-slate-800">
                    <MapPin className="h-4 w-4 text-primary" /> Endereço Residencial
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-xs">
                  <p className="text-muted-foreground leading-relaxed">{colaborador.endereco || "Nenhum endereço cadastrado."}</p>
                </CardContent>
              </Card>
            </div>

            {/*
              EXIGÊNCIAS DA FUNÇÃO — o que faltava para o roteiro 12.3.

              O treinamento vinculado à função JÁ era cobrado, mas só no PDF: o hook
              `useSgsstColaboradorDossie` calculava `pendencias` a partir da matriz e a
              tela usava esse dado apenas para montar o arquivo. Quem abria a aba
              chamada "Dossiê Completo do Colaborador" via identificação, contrato, EPI
              e endereço — e nada sobre o que a função exige.

              Dado calculado e exibido em nenhum lugar é o mesmo que dado ausente para
              quem usa: o usuário vinculou o treinamento, abriu o dossiê e concluiu que
              não estava sendo cobrado.
            */}
            <Card>
              <CardHeader className="py-2.5 px-4 bg-slate-50 border-b">
                <CardTitle className="text-xs font-bold flex items-center gap-2 text-slate-800">
                  <GraduationCap className="h-4 w-4 text-primary" /> Exigências da Função
                  {colaborador.funcao?.nome && (
                    <span className="font-normal text-muted-foreground">
                      — {colaborador.funcao.nome}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-xs space-y-3">
                {dossie.isLoading ? (
                  <p className="text-muted-foreground">Carregando exigências…</p>
                ) : !colaborador.funcao_id ? (
                  // Sem função não há o que exigir, e isso é a própria pendência —
                  // dizer "nenhuma pendência" aqui afirmaria conformidade que ninguém
                  // verificou.
                  <p className="text-amber-700 font-medium">
                    Colaborador sem função definida. Sem função, o sistema não tem
                    contra o que conferir treinamentos e EPIs.
                  </p>
                ) : dossie.pendencias.length === 0 ? (
                  <p className="text-emerald-700 font-medium">
                    Nenhuma pendência de treinamento ou EPI para esta função.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {dossie.pendencias.map((p, i) => (
                      <div
                        key={`${p.tipo}-${p.itemNome}-${i}`}
                        className="flex flex-wrap items-center gap-2 p-2 rounded border bg-amber-50/60"
                      >
                        <Badge variant="outline" className="text-[10px]">
                          {p.tipo === "TREINAMENTO" ? "Treinamento" : "EPI"}
                        </Badge>
                        <span className="font-medium">{p.itemNome}</span>
                        <span
                          className={
                            p.situacao === "VENCIDO"
                              ? "text-red-700 font-semibold"
                              : "text-amber-800 font-semibold"
                          }
                        >
                          {p.situacao === "VENCIDO" ? "Vencido" : "Nunca realizado"}
                        </span>
                        {p.vencimento && (
                          <span className="text-muted-foreground">
                            venceu em {dataBr(p.vencimento)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/*
                  As matrículas em turma aparecem aqui porque a aba "NRs & Certificados"
                  conta APENAS `sgsst_colaborador_treinamentos`, o cadastro manual de
                  certificado. Quem foi matriculado numa turma não entra naquela conta —
                  e é a matrícula, não o cadastro manual, que a matriz usa para dar baixa
                  na exigência da função. Sem este bloco, a mesma tela dizia "0" e
                  cobrava um treinamento que o trabalhador tinha feito.
                */}
                {dossie.matriculas.length > 0 && (
                  <div className="pt-2 border-t space-y-1.5">
                    <p className="font-semibold text-slate-700">
                      Turmas em que está matriculado ({dossie.matriculas.length})
                    </p>
                    {dossie.matriculas.map((m) => (
                      <div key={m.id} className="flex flex-wrap items-center gap-2 text-muted-foreground">
                        <span className="font-medium text-slate-700">
                          {m.turma?.treinamento?.nome || m.turma?.codigo_turma || "Turma"}
                        </span>
                        {m.resultado && <Badge variant="outline" className="text-[10px]">{m.resultado}</Badge>}
                        {m.data_conclusao && <span>concluído em {dataBr(m.data_conclusao)}</span>}
                        {m.validade && <span>· válido até {dataBr(m.validade)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: TREINAMENTOS & CERTIFICADOS */}
          <TabsContent value="treinamentos" className="space-y-4 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Certificados e Treinamentos do Trabalhador
                </h3>
                <p className="text-xs text-muted-foreground">
                  Cadastre as NRs e faça upload dos certificados em PDF/imagem diretamente no Cloudflare R2.
                </p>
              </div>

              {!isAddingTreinamento && (
                <Button size="sm" onClick={limparFormularioAbrindoCadastro} className="gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Adicionar Treinamento / NR
                </Button>
              )}
            </div>

            {/* Form to Add Training */}
            {isAddingTreinamento && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="py-2.5 px-4 border-b bg-primary/10">
                  <CardTitle className="text-xs font-bold text-primary">
                    {treinamentoEmEdicao
                      ? `Editando: ${treinamentoEmEdicao.nome_treinamento}`
                      : "Novo Treinamento / Certificado NR"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <form onSubmit={handleSaveTreinamento} className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs font-semibold">Nome do Treinamento / NR *</Label>
                        <Input
                          placeholder="Ex: NR-35 Trabalho em Altura"
                          value={nomeTreinamento}
                          onChange={(e) => setNomeTreinamento(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Carga Horária (Horas)</Label>
                        <Input
                          type="number"
                          placeholder="8"
                          value={cargaHoraria}
                          onChange={(e) => setCargaHoraria(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Data de Conclusão</Label>
                        <Input
                          type="date"
                          value={dataConclusao}
                          onChange={(e) => setDataConclusao(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Data de Validade</Label>
                        <Input
                          type="date"
                          value={dataValidade}
                          onChange={(e) => setDataValidade(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs font-semibold">Upload do Certificado (Cloudflare R2)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={handleCertificadoUpload}
                            disabled={isUploadingCert}
                            className="text-xs"
                          />
                          {isUploadingCert && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        </div>
                        {certificadoUrl && (
                          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 pt-1">
                            ✓ Certificado anexado com sucesso!
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs font-semibold">Observações / Instituição de Ensino</Label>
                        <Input
                          placeholder="Ex: Entidade Senai / Instrutor Eng. Carlos"
                          value={observacoes}
                          onChange={(e) => setObservacoes(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      {/*
                        Cancelar limpa o formulário inteiro, e não só fecha: sem
                        zerar `treinamentoEmEdicao`, o próximo clique em "Adicionar"
                        abriria o formulário ainda apontando para o registro anterior
                        e o cadastro novo sobrescreveria aquele lançamento.
                      */}
                      <Button type="button" variant="outline" size="sm" onClick={limparFormularioDoTreinamento}>
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={addTreinamento.isPending || updateTreinamento.isPending}
                      >
                        {treinamentoEmEdicao ? "Salvar alterações" : "Salvar Treinamento"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* List of Worker Trainings */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-bold">Treinamento / NR</TableHead>
                      <TableHead className="text-xs font-bold">Conclusão</TableHead>
                      <TableHead className="text-xs font-bold">Validade</TableHead>
                      <TableHead className="text-xs font-bold">Situação</TableHead>
                      <TableHead className="text-xs font-bold">Certificado</TableHead>
                      <TableHead className="text-xs font-bold text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!colaborador.treinamentos?.length ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                          Nenhum treinamento ou certificado NR cadastrado para este colaborador.
                        </TableCell>
                      </TableRow>
                    ) : (
                      colaborador.treinamentos.map((tr) => {
                        const statusVal = calculateVencimentoTreinamento(tr.data_validade);
                        return (
                          <TableRow key={tr.id}>
                            <TableCell className="font-semibold text-xs">{tr.nome_treinamento}</TableCell>
                            <TableCell className="text-xs">{tr.data_conclusao || "—"}</TableCell>
                            <TableCell className="text-xs">{tr.data_validade || "Sem Validade"}</TableCell>
                            <TableCell>
                              {statusVal === "VENCIDO" && <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold">VENCIDO</Badge>}
                              {statusVal === "PROXIMO_VENCIMENTO" && <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">PRÓXIMO VENCIMENTO</Badge>}
                              {statusVal === "VALIDO" && <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">VÁLIDO</Badge>}
                            </TableCell>
                            <TableCell>
                              {tr.certificado_url ? (
                                <a
                                  href={resolveFileUrl(tr.certificado_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary underline flex items-center gap-1 font-medium hover:text-primary/80"
                                >
                                  <FileCheck className="h-3.5 w-3.5" /> Ver PDF / R2
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sem anexo</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {/*
                                Editar existia só como apagar-e-lançar-de-novo, e esse
                                caminho perde o anexo: a URL do certificado no R2 vive
                                no registro apagado, então o usuário teria de reenviar
                                o arquivo para corrigir uma data digitada errada.
                                Data de conclusão e validade vêm de um certificado em
                                papel, digitadas à mão — são os campos que mais se
                                corrigem.
                              */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => iniciarEdicaoDoTreinamento(tr)}
                                className="h-7 w-7"
                                title="Editar lançamento"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveTr(tr.id)}
                                className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Remover lançamento"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-3 sm:justify-between">
          {/* Emitir fica fora de qualquer permissão de edição: emitir é leitura. */}
          <Button
            variant="outline"
            className="gap-2"
            onClick={emitirDossie}
            disabled={emitindo || dossie.isLoading}
            title="Emitir o dossiê deste trabalhador em PDF, para compartilhamento"
          >
            {emitindo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Emitir dossiê em PDF
          </Button>

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar Dossiê
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
