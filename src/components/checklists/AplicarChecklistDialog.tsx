import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChecklistModelo, useChecklistAplicacoes } from "@/hooks/checklists/useChecklists";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uploadImage } from "@/services/uploadImage";
import { resolveFileUrl } from "@/utils/fileUrlResolver";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Upload,
  Camera,
  AlertTriangle,
  Loader2,
  Printer,
  Award,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";

interface AplicarChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelo: ChecklistModelo | null;
}

interface RespostaDraft {
  item_id: string;
  resposta_valor: string;
  comentario: string;
  is_nao_conforme: boolean;
  evidencias_urls: string[];
  // 5W2H Plan of Action if Non-Conform
  plano_acao?: {
    o_que_fazer: string;
    por_que: string;
    onde: string;
    quando_prazo: string;
    quem_responsavel_id: string;
    como_fazer: string;
    quanto_custo: number;
    prioridade: "Baixa" | "Media" | "Alta" | "Critica";
  };
}

export function AplicarChecklistDialog({
  open,
  onOpenChange,
  modelo,
}: AplicarChecklistDialogProps) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const { createAplicacao, finishAplicacao } = useChecklistAplicacoes();

  const [step, setStep] = useState<"header" | "execution" | "result">("header");

  const [projetoId, setProjetoId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");

  const [respostas, setRespostas] = useState<Record<string, RespostaDraft>>({});
  const [observacoesGerais, setObservacoesGerais] = useState("");
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  const [aplicacaoIdCreated, setAplicacaoIdCreated] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<any>(null);

  // Load Selects
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_aplicar_chk", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("projetos" as any).select("id, codigo, nome").eq("empresa_id", empresaId!);
      return data || [];
    },
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colabs_aplicar_chk", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("sgsst_colaborador_dados" as any).select("id, nome, cpf").eq("empresa_id", empresaId!);
      return data || [];
    },
  });

  useEffect(() => {
    if (modelo && open) {
      setStep("header");
      setRespostas({});
      setObservacoesGerais("");
      setResultSummary(null);
      setProjetoId(modelo.projeto_id || "");
      setAreaId(modelo.area_id || "");
      setResponsavelId(modelo.responsavel_id || "");
    }
  }, [modelo, open]);

  if (!modelo) return null;

  const handleStartExecution = async () => {
    try {
      const app = await createAplicacao.mutateAsync({
        modelo_id: modelo.id,
        projeto_id: projetoId || undefined,
        area_id: areaId || undefined,
        responsavel_id: responsavelId || undefined,
        colaborador_id: colaboradorId || undefined,
      });

      setAplicacaoIdCreated(app.id);

      // Initialize respuestas
      const init: Record<string, RespostaDraft> = {};
      (modelo.secoes || []).forEach((secao) => {
        (secao.itens || []).forEach((item) => {
          init[item.id] = {
            item_id: item.id,
            resposta_valor: "",
            comentario: "",
            is_nao_conforme: false,
            evidencias_urls: [],
          };
        });
      });

      setRespostas(init);
      setStep("execution");
    } catch (err) {
      // Error handled by mutation
    }
  };

  const handleSetAnswer = (itemId: string, valor: string, isNaoConforme: boolean) => {
    setRespostas((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        resposta_valor: valor,
        is_nao_conforme: isNaoConforme,
        plano_acao: isNaoConforme
          ? prev[itemId]?.plano_acao || {
              o_que_fazer: `Ação corretiva para item de ${modelo.nome}`,
              por_que: "Não conformidade identificada em checklist de campo",
              onde: "Canteiro de Obra",
              quando_prazo: new Date().toISOString().split("T")[0],
              quem_responsavel_id: responsavelId || profile?.id || "",
              como_fazer: "Regularizar item conforme procedimento de segurança",
              quanto_custo: 0,
              prioridade: "Media",
            }
          : undefined,
      },
    }));
  };

  const handlePhotoUpload = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingItemId(itemId);
      const res = await uploadImage(file);
      if (res) {
        setRespostas((prev) => ({
          ...prev,
          [itemId]: {
            ...prev[itemId],
            evidencias_urls: [...(prev[itemId]?.evidencias_urls || []), res],
          },
        }));
        toast.success("Foto anexada com sucesso no Cloudflare R2!");
      }
    } catch (err: any) {
      toast.error(`Erro ao anexar foto: ${err.message || err}`);
    } finally {
      setUploadingItemId(null);
    }
  };

  const handleFinish = async () => {
    if (!aplicacaoIdCreated) return;

    const listRespostas = Object.values(respostas);
    const listPlanosAcao: any[] = [];

    listRespostas.forEach((r) => {
      if (r.is_nao_conforme && r.plano_acao && r.plano_acao.o_que_fazer) {
        listPlanosAcao.push({
          item_id: r.item_id,
          ...r.plano_acao,
        });
      }
    });

    try {
      const summary = await finishAplicacao.mutateAsync({
        aplicacao_id: aplicacaoIdCreated,
        observacoes_gerais: observacoesGerais,
        respostas: listRespostas,
        planos_acao: listPlanosAcao,
      });

      setResultSummary(summary);
      setStep("result");
    } catch (err) {
      // Handled
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Aplicação de Checklist: {modelo.nome}
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: HEADER & METADATA */}
        {step === "header" && (
          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 bg-slate-50 rounded border space-y-1">
              <span className="font-bold text-sm text-primary">{modelo.nome}</span>
              <p className="text-muted-foreground">{modelo.descricao || "Preenchimento de checklist de campo."}</p>
              <div className="flex gap-3 text-[11px] pt-1">
                <span>Categoria: <strong>{modelo.categoria}</strong></span>
                <span>Periodicidade: <strong>{modelo.periodicidade_sugerida}</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <Label className="text-xs font-semibold">Trabalhador / Colaborador Auditado</Label>
                <Select value={colaboradorId} onValueChange={setColaboradorId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecione o colaborador..." />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} {c.cpf ? `(CPF: ${c.cpf})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleStartExecution} disabled={createAplicacao.isPending} className="gap-2">
                {createAplicacao.isPending ? "Iniciando..." : "Iniciar Preenchimento do Checklist"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 2: EXECUTION / QUESTIONS */}
        {step === "execution" && (
          <div className="space-y-6 py-2 text-xs">
            {(modelo.secoes || []).map((secao) => (
              <div key={secao.id} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 p-2 rounded border">
                  {secao.titulo}
                </h3>

                {(secao.itens || []).map((item) => {
                  const resp = respostas[item.id] || { resposta_valor: "", is_nao_conforme: false };
                  const isNc = resp.is_nao_conforme;

                  return (
                    <Card key={item.id} className={`border ${isNc ? "border-red-300 bg-red-50/20" : "border-slate-200"}`}>
                      <CardContent className="p-3 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                              <span>{item.titulo}</span>
                              {item.obrigatorio && <span className="text-red-500 font-bold">*</span>}
                            </div>
                            {item.descricao && <p className="text-[11px] text-muted-foreground pt-0.5">{item.descricao}</p>}
                          </div>

                          {/* Quick Answer Buttons */}
                          <div className="flex items-center gap-1.5 min-w-max">
                            <Button
                              type="button"
                              size="sm"
                              variant={resp.resposta_valor === "Conforme" || resp.resposta_valor === "Sim" || resp.resposta_valor === "OK" ? "default" : "outline"}
                              onClick={() => handleSetAnswer(item.id, item.tipo_resposta.startsWith("Sim") ? "Sim" : "Conforme", false)}
                              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Conforme
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant={isNc ? "destructive" : "outline"}
                              onClick={() => handleSetAnswer(item.id, item.tipo_resposta.startsWith("Sim") ? "Nao" : "NaoConforme", true)}
                              className="text-xs h-8 gap-1"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Não Conforme
                            </Button>

                            {item.tipo_resposta.includes("NA") && (
                              <Button
                                type="button"
                                size="sm"
                                variant={resp.resposta_valor === "NA" ? "secondary" : "outline"}
                                onClick={() => handleSetAnswer(item.id, "NA", false)}
                                className="text-xs h-8 gap-1"
                              >
                                <HelpCircle className="h-3.5 w-3.5" /> N/A
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Non-Conform Extra Fields: Comments, Photos, 5W2H Plan of Action */}
                        {isNc && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-3 text-xs">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-red-900">Comentário / Detalhes do Desvio *</Label>
                              <Textarea
                                rows={2}
                                placeholder="Descreva a inconformidade observada no local..."
                                value={resp.comentario}
                                onChange={(e) =>
                                  setRespostas((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], comentario: e.target.value },
                                  }))
                                }
                                className="bg-white text-xs"
                              />
                            </div>

                            {/* Photo Upload via Cloudflare R2 */}
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-red-900 flex items-center gap-1">
                                <Camera className="h-3.5 w-3.5" /> Anexar Evidência Fotográfica (Cloudflare R2)
                              </Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handlePhotoUpload(item.id, e)}
                                  disabled={uploadingItemId === item.id}
                                  className="bg-white text-xs max-w-xs"
                                />
                                {uploadingItemId === item.id && <Loader2 className="h-4 w-4 animate-spin text-red-600" />}
                              </div>
                              {resp.evidencias_urls?.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {resp.evidencias_urls.map((url, uIdx) => (
                                    <Badge key={uIdx} variant="outline" className="bg-white text-emerald-700 text-[10px]">
                                      ✓ Foto {uIdx + 1} Salva R2
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* 5W2H Plan of Action Section */}
                            {item.gerar_plano_acao_nao_conforme && (
                              <div className="p-2.5 bg-white border border-red-200 rounded space-y-2">
                                <h4 className="text-xs font-bold text-red-900 flex items-center gap-1">
                                  <AlertTriangle className="h-3.5 w-3.5" /> Plano de Ação 5W2H Automático
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[11px]">O que será feito (Action)</Label>
                                    <Input
                                      className="text-xs h-8"
                                      value={resp.plano_acao?.o_que_fazer || ""}
                                      onChange={(e) =>
                                        setRespostas((prev) => ({
                                          ...prev,
                                          [item.id]: {
                                            ...prev[item.id],
                                            plano_acao: { ...prev[item.id].plano_acao!, o_que_fazer: e.target.value },
                                          },
                                        }))
                                      }
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-[11px]">Prazo de Conclusão</Label>
                                    <Input
                                      type="date"
                                      className="text-xs h-8"
                                      value={resp.plano_acao?.quando_prazo || ""}
                                      onChange={(e) =>
                                        setRespostas((prev) => ({
                                          ...prev,
                                          [item.id]: {
                                            ...prev[item.id],
                                            plano_acao: { ...prev[item.id].plano_acao!, quando_prazo: e.target.value },
                                          },
                                        }))
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ))}

            <div className="space-y-1 pt-2">
              <Label className="text-xs font-semibold">Observações Gerais do Checklist</Label>
              <Textarea
                rows={2}
                placeholder="Considerações finais sobre a inspeção realizada..."
                value={observacoesGerais}
                onChange={(e) => setObservacoesGerais(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleFinish} disabled={finishAplicacao.isPending} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                {finishAplicacao.isPending ? "Concluindo..." : "Concluir & Finalizar Checklist"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3: RESULT & SCORING */}
        {step === "result" && resultSummary && (
          <div className="space-y-6 py-4 text-xs text-center">
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
              <div className="inline-flex p-3 bg-emerald-100 rounded-full text-emerald-700">
                <Award className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold text-emerald-900">CHECKLIST CONCLUÍDO COM SUCESSO!</h2>

              <div className="text-3xl font-extrabold text-emerald-700">
                {resultSummary.percentual_conformidade}% de Conformidade
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border rounded text-center">
                <div className="text-xs text-muted-foreground">Total Itens</div>
                <div className="text-lg font-bold">{resultSummary.total_itens}</div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-center">
                <div className="text-xs text-emerald-800 font-semibold">Conforme</div>
                <div className="text-lg font-bold text-emerald-700">{resultSummary.total_conforme}</div>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded text-center">
                <div className="text-xs text-red-800 font-semibold">Não Conforme</div>
                <div className="text-lg font-bold text-red-700">{resultSummary.total_nao_conforme}</div>
              </div>
              <div className="p-3 bg-slate-50 border rounded text-center">
                <div className="text-xs text-muted-foreground">N/A</div>
                <div className="text-lg font-bold">{resultSummary.total_na}</div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => window.print()} className="gap-1.5">
                <Printer className="h-4 w-4" /> Imprimir / PDF
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Finalizar e Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
