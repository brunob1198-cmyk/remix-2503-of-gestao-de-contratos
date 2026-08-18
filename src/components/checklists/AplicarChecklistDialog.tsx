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
  ShieldCheck,
  ExternalLink,
  QrCode,
  FileText,
  MapPin,
  Navigation,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SignatureService } from "@/services/SignatureService";
import { getCurrentDeviceLocation, isWithinRadius, GeoCoordinates } from "@/utils/geolocationUtils";
import { useChecklistsOffline } from "@/hooks/checklists/useChecklistsOffline";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { saveOfflinePhoto } from "@/lib/checklistsOfflineDb";
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

  // Estados do Serviço Central de Assinatura
  const [metodoAssinatura, setMetodoAssinatura] = useState<"ASSINATURA_ELETRONICA_INTERNA" | "GOV_BR">("ASSINATURA_ELETRONICA_INTERNA");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signedData, setSignedData] = useState<{
    requestId: string;
    arquivoUrl: string;
    signedAt: string;
    hashOriginal: string;
    hashAssinado: string;
  } | null>(null);

  // Hooks de Conectividade e AutoSave Offline (PROMPT 021)
  const { isOnline, statusLabel } = useConnectionStatus();
  const { autoSaveLocalApplication } = useChecklistsOffline();
  const [localAppId, setLocalAppId] = useState<string>("");

  // Estados de Geolocalização
  const [geoStart, setGeoStart] = useState<GeoCoordinates | null>(null);
  const [geoFinish, setGeoFinish] = useState<GeoCoordinates | null>(null);
  const [isCapturingGeo, setIsCapturingGeo] = useState(false);

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
      setSignedData(null);
      setShowConfirmDialog(false);
      setMetodoAssinatura("ASSINATURA_ELETRONICA_INTERNA");
      setProjetoId(modelo.projeto_id || "");
      setAreaId(modelo.area_id || "");
      setResponsavelId(modelo.responsavel_id || "");
      setLocalAppId(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    }
  }, [modelo, open]);

  if (!modelo) return null;

  const handleStartExecution = async () => {
    const regraGeo = (modelo.exigir_geolocalizacao as any) || "nao";
    const precisaGeoInicio = regraGeo === "iniciar" || regraGeo === "ambos";

    let coordsCaptured: GeoCoordinates | null = null;

    if (precisaGeoInicio || modelo.latitude_alvo) {
      try {
        setIsCapturingGeo(true);
        coordsCaptured = await getCurrentDeviceLocation();
        setGeoStart(coordsCaptured);

        // Validar Raio de alcance se configurado no modelo
        if (modelo.latitude_alvo && modelo.longitude_alvo && modelo.raio_permitido_metros) {
          const radiusResult = isWithinRadius(
            coordsCaptured.latitude,
            coordsCaptured.longitude,
            Number(modelo.latitude_alvo),
            Number(modelo.longitude_alvo),
            modelo.raio_permitido_metros
          );

          if (!radiusResult.inside) {
            const msg = `Você está fora da área permitida para este checklist. Distância atual: ${radiusResult.distanceMeters}m (Raio máximo: ${modelo.raio_permitido_metros}m).`;
            if (modelo.bloquear_fora_raio) {
              toast.error(msg);
              return;
            } else {
              toast.warning(msg);
            }
          }
        }
      } catch (geoErr: any) {
        if (precisaGeoInicio) {
          toast.error("Este checklist exige registro de localização para ser concluído.");
          return;
        }
      } finally {
        setIsCapturingGeo(false);
      }
    }

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

    // AutoSave local inicial no IndexedDB
    const targetId = localAppId || `app_${Date.now()}`;
    setAplicacaoIdCreated(targetId);

    autoSaveLocalApplication({
      localAppId: targetId,
      modeloId: modelo.id,
      modeloNome: modelo.nome,
      respostas: init,
      observacoesGerais: "",
      geoStart: coordsCaptured,
    });

    // Se estiver online, criar também registro remoto imediato
    if (isOnline) {
      try {
        const app = await createAplicacao.mutateAsync({
          modelo_id: modelo.id,
          projeto_id: projetoId || undefined,
          area_id: areaId || undefined,
          responsavel_id: responsavelId || undefined,
          colaborador_id: colaboradorId || undefined,
        });

        if (app?.id) {
          setAplicacaoIdCreated(app.id);
        }

        if (coordsCaptured && empresaId && app?.id) {
          await supabase.from("checklist_geolocalizacoes" as any).insert({
            empresa_id: empresaId,
            aplicacao_id: app.id,
            momento: "inicio",
            latitude: coordsCaptured.latitude,
            longitude: coordsCaptured.longitude,
            precisao: coordsCaptured.accuracy || null,
          });
        }
      } catch (err) {
        console.error("Erro ao iniciar aplicação remota:", err);
      }
    }
  };

  const handleSetAnswer = (itemId: string, valor: string, isNaoConforme: boolean) => {
    const updated = {
      ...respostas,
      [itemId]: {
        ...respostas[itemId],
        resposta_valor: valor,
        is_nao_conforme: isNaoConforme,
        plano_acao: isNaoConforme
          ? respostas[itemId]?.plano_acao || {
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
    };

    setRespostas(updated);

    // AutoSave local no IndexedDB
    if (aplicacaoIdCreated) {
      autoSaveLocalApplication({
        localAppId: aplicacaoIdCreated,
        modeloId: modelo.id,
        modeloNome: modelo.nome,
        respostas: updated,
        observacoesGerais,
        geoStart,
      });
    }
  };

  const handlePhotoUpload = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingItemId(itemId);

      if (isOnline) {
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
      } else {
        // Fluxo Offline: Salvar Foto DataURL no IndexedDB
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await saveOfflinePhoto({
            id: photoId,
            local_application_id: aplicacaoIdCreated || localAppId,
            item_id: itemId,
            data_url: dataUrl,
            file_name: file.name,
            status: "PENDENTE",
            created_at: new Date().toISOString(),
          });

          setRespostas((prev) => ({
            ...prev,
            [itemId]: {
              ...prev[itemId],
              evidencias_urls: [...(prev[itemId]?.evidencias_urls || []), dataUrl],
            },
          }));
          toast.info("Foto salva localmente no dispositivo (Aguardando Sync R2)");
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      toast.error(`Erro ao anexar foto: ${err.message || err}`);
    } finally {
      setUploadingItemId(null);
    }
  };

  const handleFinish = async () => {
    // 1. Validar itens obrigatórios
    const missingItems: string[] = [];
    (modelo.secoes || []).forEach((secao) => {
      (secao.itens || []).forEach((item) => {
        if (item.obrigatorio) {
          const resp = respostas[item.id];
          if (!resp || !resp.resposta_valor) {
            missingItems.push(item.titulo);
          }
        }
      });
    });

    if (missingItems.length > 0) {
      toast.error(`Responda todos os itens obrigatórios: ${missingItems.slice(0, 3).join(", ")}${missingItems.length > 3 ? "..." : ""}`);
      return;
    }

    const regraGeo = (modelo.exigir_geolocalizacao as any) || "nao";
    const precisaGeoFim = regraGeo === "finalizar" || regraGeo === "ambos";

    let coordsCaptured: GeoCoordinates | null = null;

    if (precisaGeoFim) {
      try {
        setIsCapturingGeo(true);
        coordsCaptured = await getCurrentDeviceLocation();
        setGeoFinish(coordsCaptured);

        if (modelo.latitude_alvo && modelo.longitude_alvo && modelo.raio_permitido_metros) {
          const radiusResult = isWithinRadius(
            coordsCaptured.latitude,
            coordsCaptured.longitude,
            Number(modelo.latitude_alvo),
            Number(modelo.longitude_alvo),
            modelo.raio_permitido_metros
          );

          if (!radiusResult.inside) {
            const msg = `Você está fora da área permitida para este checklist. Distância atual: ${radiusResult.distanceMeters}m (Raio máximo: ${modelo.raio_permitido_metros}m).`;
            if (modelo.bloquear_fora_raio) {
              toast.error(msg);
              return;
            } else {
              toast.warning(msg);
            }
          }
        }
      } catch (geoErr: any) {
        toast.error("Este checklist exige registro de localização para ser concluído.");
        return;
      } finally {
        setIsCapturingGeo(false);
      }
    }

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

    let currentAplicacaoId = aplicacaoIdCreated;

    if (!isOnline) {
      const targetLocalId = currentAplicacaoId || localAppId || `app_${Date.now()}`;
      // Conclusão Offline: Salvar payload final no IndexedDB e adicionar item na sync_queue
      await autoSaveLocalApplication({
        localAppId: targetLocalId,
        modeloId: modelo.id,
        modeloNome: modelo.nome,
        respostas,
        observacoesGerais,
        geoStart,
        geoFinish: coordsCaptured,
        isFinalizing: true,
      });

      setResultSummary({
        id: targetLocalId,
        status: "AGUARDANDO SINCRONIZAÇÃO",
        percentual_conformidade: 100,
        total_conforme: listRespostas.length,
        total_nao_conforme: 0,
        total_na: 0,
      });
      setStep("result");
      return;
    }

    try {
      // Garantir que existe um ID de aplicação remoto válido no Supabase
      if (!currentAplicacaoId || currentAplicacaoId.startsWith("app_")) {
        const app = await createAplicacao.mutateAsync({
          modelo_id: modelo.id,
          projeto_id: projetoId || undefined,
          area_id: areaId || undefined,
          responsavel_id: responsavelId || undefined,
          colaborador_id: colaboradorId || undefined,
        });
        currentAplicacaoId = app.id;
        setAplicacaoIdCreated(app.id);
      }

      const summary = await finishAplicacao.mutateAsync({
        aplicacao_id: currentAplicacaoId,
        observacoes_gerais: observacoesGerais,
        respostas: listRespostas,
        planos_acao: listPlanosAcao,
      });

      // Salvar registro de geolocalização de conclusão no banco se capturado
      if (coordsCaptured && empresaId) {
        await supabase.from("checklist_geolocalizacoes" as any).insert({
          empresa_id: empresaId,
          aplicacao_id: currentAplicacaoId,
          momento: "conclusao",
          latitude: coordsCaptured.latitude,
          longitude: coordsCaptured.longitude,
          precisao: coordsCaptured.accuracy || null,
        });
      }

      setResultSummary(summary);
      setStep("result");
    } catch (err: any) {
      console.error("Erro ao finalizar checklist:", err);
      toast.error(`Erro ao finalizar checklist: ${err?.message || err}`);
    }
  };

  const handleStartSignatureProcess = () => {
    if (metodoAssinatura === "GOV_BR") {
      toast.info(
        "GOV.BR preparado arquiteturalmente, porém não habilitado por ausência de autorização/elegibilidade da API."
      );
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmSignature = async () => {
    if (!empresaId || !aplicacaoIdCreated || !modelo) {
      toast.error("Identificador de aplicação ou empresa inválido.");
      return;
    }

    try {
      setIsSigning(true);

      const req = await SignatureService.createRequest({
        empresa_id: empresaId,
        documento_id: aplicacaoIdCreated,
        modulo_origem: "CHECKLISTS",
        entidade_tipo: "checklist_aplicacao",
        entidade_id: aplicacaoIdCreated,
        metodo: "ASSINATURA_ELETRONICA_INTERNA",
      });

      const res = await SignatureService.sign({
        signature_request_id: req.id,
        user_id: profile?.id || "user-anon",
        nome: profile?.nome || profile?.email || "Usuário Autenticado",
        cargo: profile?.cargo || "Auditor / Inspetor",
        empresa_nome: profile?.empresa_nome || "Empresa Cadastrada",
        documento_titulo: `Checklist Finalizado - ${modelo.nome}`,
        conteudo_resumo: `Checklist ${modelo.nome} concluído com ${resultSummary?.percentual_conformidade}% de conformidade. Total de itens: ${resultSummary?.total_itens}. Não conformidades: ${resultSummary?.total_nao_conforme}.`,
        metodo: "ASSINATURA_ELETRONICA_INTERNA",
      });

      setSignedData({
        requestId: req.id,
        arquivoUrl: res.arquivo_assinado_url,
        signedAt: res.signer.signed_at || new Date().toISOString(),
        hashOriginal: res.document.hash_original,
        hashAssinado: res.document.hash_assinado || "",
      });

      setShowConfirmDialog(false);
      toast.success("Documento assinado eletronicamente e registrado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao assinar documento:", err);
      toast.error(`Erro na assinatura: ${err.message || err}`);
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 text-lg font-bold">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <span>Aplicação de Checklist: {modelo.nome}</span>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-bold font-mono">
                {statusLabel}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-normal text-muted-foreground">
                Salvo no dispositivo
              </Badge>
            </div>
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
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-center">
                <div className="text-xs text-amber-800 font-semibold">Planos de Ação</div>
                <div className="text-lg font-bold text-amber-700">{resultSummary.total_nao_conforme || 0}</div>
              </div>
            </div>

            {/* SEÇÃO DE ASSINATURA CENTRAL */}
            <div className="p-4 bg-slate-50 border rounded-lg text-left space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Assinatura do Documento
                </div>
                {signedData && (
                  <Badge className="bg-emerald-600 text-white font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> ASSINADO
                  </Badge>
                )}
              </div>

              {!signedData ? (
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground font-semibold">Responsável:</span>
                    <p className="text-xs font-bold text-slate-800">
                      {profile?.nome || profile?.email || "Usuário Autenticado no SaaS"}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Método de Assinatura:</Label>
                    <RadioGroup
                      value={metodoAssinatura}
                      onValueChange={(val: any) => setMetodoAssinatura(val)}
                      className="space-y-1"
                    >
                      <div className="flex items-center space-x-2 bg-white p-2 border rounded">
                        <RadioGroupItem value="ASSINATURA_ELETRONICA_INTERNA" id="m_interna" />
                        <Label htmlFor="m_interna" className="text-xs font-medium cursor-pointer">
                          Assinatura eletrônica do sistema (Gratuita & Auditável)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 bg-white p-2 border rounded opacity-80">
                        <RadioGroupItem value="GOV_BR" id="m_govbr" />
                        <Label htmlFor="m_govbr" className="text-xs font-medium cursor-pointer flex items-center gap-1">
                          GOV.BR — somente se integração autorizada/disponível
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <Button
                    onClick={handleStartSignatureProcess}
                    disabled={isSigning}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2"
                  >
                    <ShieldCheck className="h-4 w-4" /> ASSINAR E FINALIZAR
                  </Button>
                </div>
              ) : (
                <div className="p-3 bg-white border border-emerald-300 rounded space-y-2 text-xs">
                  <div className="flex items-center justify-between text-emerald-800 font-bold">
                    <span>Documento Assinado Eletronicamente</span>
                    <span>{new Date(signedData.signedAt).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">
                    Hash SHA-256: {signedData.hashOriginal}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <a
                      href={signedData.arquivoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1.5 rounded font-medium border"
                    >
                      <FileText className="h-3.5 w-3.5" /> Baixar PDF Assinado (Cloudflare R2)
                    </a>
                    <a
                      href={`/verificar-assinatura/${signedData.requestId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2.5 py-1.5 rounded font-medium border border-emerald-200"
                    >
                      <QrCode className="h-3.5 w-3.5" /> Ver Validação Pública (QR Code)
                    </a>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => window.print()} className="gap-1.5">
                <Printer className="h-4 w-4" /> Imprimir / PDF
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Finalizar e Fechar
              </Button>
            </DialogFooter>

            {/* MODAL DE CONFIRMAÇÃO DA ASSINATURA INTERNA */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <DialogContent className="max-w-md text-xs space-y-3">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    Confirma a assinatura deste documento?
                  </DialogTitle>
                </DialogHeader>

                <div className="p-3 bg-slate-50 border rounded-lg space-y-1.5 text-left">
                  <div>
                    <span className="font-semibold text-muted-foreground">Nome:</span>{" "}
                    <strong className="text-slate-800">{profile?.nome || profile?.email || "Usuário Autenticado"}</strong>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Cargo:</span>{" "}
                    <strong>{profile?.cargo || "Auditor / Inspetor"}</strong>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Empresa:</span>{" "}
                    <strong>{profile?.empresa_nome || "Empresa Cadastrada"}</strong>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Data/Hora:</span>{" "}
                    <strong>{new Date().toLocaleString("pt-BR")}</strong>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Método:</span>{" "}
                    <span className="text-emerald-700 font-bold">Assinatura eletrônica do sistema</span>
                  </div>
                </div>

                <DialogFooter className="pt-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowConfirmDialog(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirmSignature}
                    disabled={isSigning}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
                  >
                    {isSigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {isSigning ? "Assinando..." : "CONFIRMAR ASSINATURA"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
