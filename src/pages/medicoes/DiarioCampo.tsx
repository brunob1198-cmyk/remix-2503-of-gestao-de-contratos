import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useProjetos } from "@/hooks/useProjetos";
import { useSites } from "@/hooks/useSites";
import { useDiarioCampoAtividades, useDiarioCampoFotos, useDiarioCampoCalendario } from "@/hooks/useDiarioCampo";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DiarioCalendario, CLIMA_OPTIONS } from "@/components/medicoes/DiarioCalendario";
import { UfMunicipioSelector } from "@/components/medicoes/UfMunicipioSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ClipboardEdit, Camera, Upload, Trash2, Users, MapPin, Check, Plus, AlertCircle, RefreshCw
} from "lucide-react";

import { format, subMonths } from "date-fns";
import type { DiarioCalendarioEntry } from "@/components/medicoes/DiarioCalendario";
import { getUploadQueue, updateUploadStatus, addToUploadQueue, UploadItem, clearCompletedUploads, removeFromUploadQueue } from "@/lib/db";

import { uploadImage, verifyImageUrl, getPublicUrl, uploadImageWithVariants } from "@/services/uploadImage";


export default function DiarioCampoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { projetos } = useProjetos();
  const [selectedProjetoId, setSelectedProjetoId] = usePersistedState<string>("diario_campo_projeto_id", "");
  const { sites } = useSites(selectedProjetoId || undefined);
  const [selectedSiteId, setSelectedSiteId] = usePersistedState<string>("diario_campo_site_id", "");
  const [selectedDate, setSelectedDate] = usePersistedState<string>("diario_campo_date", format(new Date(), "yyyy-MM-dd"));
  const [activeTab, setActiveTab] = useState<string>("calendario");
  const [periodoInicio, setPeriodoInicio] = useState(() => format(subMonths(new Date(), 2), "yyyy-MM-dd"));
  const [periodoFim, setPeriodoFim] = useState(() => format(new Date(), "yyyy-MM-dd"));

  // Which activity is selected: index into atividades[], or "new" for blank form
  const [activeAtividadeIdx, setActiveAtividadeIdx] = useState<number | "new">("new");

  // Form state
  const [descricao, setDescricao] = useState("");
  const [equipeCampo, setEquipeCampo] = useState("");
  const [obs, setObs] = useState("");
  const [clima, setClima] = useState("");
  const [diarioUf, setDiarioUf] = useState("");
  const [diarioMunicipio, setDiarioMunicipio] = useState("");
  const [formSiteId, setFormSiteId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  const processQueue = useCallback(async () => {
    if (isProcessingQueue) return;
    setIsProcessingQueue(true);

    const queue = await getUploadQueue();
    const pending = queue.filter(i => i.status === 'pending' || i.status === 'uploading' || i.status === 'failed');
    
    if (pending.length === 0) {
      setIsProcessingQueue(false);
      return;
    }

    const CONCURRENCY = 4;
    let index = 0;

    const worker = async () => {
      while (index < pending.length) {
        const item = pending[index++];
        try {
          await updateUploadStatus(item.id, 'uploading');
          setUploadQueue(await getUploadQueue());

          const timestamp = Date.now();
          
          let fileToUpload = item.file;
          // Image will be compressed automatically in uploadImage

          const publicUrl = await uploadImage(fileToUpload);
          console.log("PHOTO URL:", publicUrl);


          const { error: insertError } = await supabase
            .from("diario_campo_fotos")
            .insert([{ 
              diario_campo_id: item.diarioId, 
              url: publicUrl,
              thumb_url: publicUrl,
              thumb_600_url: publicUrl
            }])
            .select();
          
          if (insertError) throw insertError;

          // Double check: verify row exists in DB
          const { data: verifyData, error: verifyError } = await supabase
            .from("diario_campo_fotos")
            .select("id")
            .eq("url", publicUrl)
            .single();

          if (verifyError || !verifyData) {
            throw new Error("Falha ao confirmar salvamento da URL no banco de dados.");
          }

          await updateUploadStatus(item.id, 'completed', { url: publicUrl });

        } catch (error: any) {
          console.error("Upload error:", error);
          await updateUploadStatus(item.id, 'failed', { error: error.message });
        }
        setUploadQueue(await getUploadQueue());
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
    
    setIsProcessingQueue(false);
    queryClient.invalidateQueries({ queryKey: ["diario_campo_fotos"] });
    queryClient.invalidateQueries({ queryKey: ["diario_campo_atividades"] });
  }, [queryClient, isProcessingQueue]);

  // Load pending uploads on mount and auto-process
  useEffect(() => {
    let isMounted = true;
    const loadAndProcess = async () => {
      const queue = await getUploadQueue();
      if (!isMounted) return;
      
      if (queue.length > 0) {
        setUploadQueue(queue);
        const hasWork = queue.some(i => i.status === 'pending' || i.status === 'uploading' || i.status === 'failed');
        if (hasWork) {
          setTimeout(() => {
            if (isMounted) processQueue();
          }, 1000);
        }
      }
    };
    loadAndProcess();
    return () => { isMounted = false; };
  }, [processQueue]);


  const handleProjetoChange = (projetoId: string) => {
    setSelectedProjetoId(projetoId);
    setSelectedSiteId("");
  };

  const { atividades, loadingAtividades, criarAtividade, atualizarAtividade } =
    useDiarioCampoAtividades(selectedProjetoId, selectedSiteId, selectedDate);

  const currentAtividade = typeof activeAtividadeIdx === "number" ? atividades[activeAtividadeIdx] : null;

  const { fotos, addFoto, removeFoto } = useDiarioCampoFotos(currentAtividade?.id);

  useEffect(() => {
    if (fotos && fotos.length > 0) {
      console.log("PHOTO STATE:", fotos);
    }
  }, [fotos]);

  const { data: calendarRaw = [] } = useDiarioCampoCalendario(
    selectedProjetoId || undefined, selectedSiteId || undefined, periodoInicio, periodoFim
  );

  const calendarEntries: DiarioCalendarioEntry[] = calendarRaw.map(e => ({
    id: e.id,
    data: e.data,
    clima: e.clima,
    observacoes: e.descricao || null,
    totalProducao: 0,
    totalItens: e.hasContent ? 1 : 0,
    totalEquipe: e.totalFotos,
  }));

  // When atividades load or activeAtividadeIdx changes, sync form
  const lastSyncKey = useRef<string | null>(null);
  useEffect(() => {
    const syncKey = `${activeAtividadeIdx}_${atividades.length}`;
    if (syncKey === lastSyncKey.current) return;
    lastSyncKey.current = syncKey;

    console.count("DiarioCampo syncForm executado");
    if (typeof activeAtividadeIdx === "number" && atividades[activeAtividadeIdx]) {
      const a = atividades[activeAtividadeIdx];
      setDescricao(a.descricao_servico || "");
      setEquipeCampo(a.equipe_campo || "");
      setObs(a.observacoes || "");
      setClima(a.clima || "");
      setDiarioUf(a.uf || "");
      setDiarioMunicipio(a.municipio || "");
      setFormSiteId(a.site_id || "");
      setSaved(true);
      setDirty(false);
    } else if (activeAtividadeIdx === "new") {
      setDescricao("");
      setEquipeCampo("");
      setObs("");
      setClima("");
      setDiarioUf("");
      setDiarioMunicipio("");
      setFormSiteId(selectedSiteId || "");
      setSaved(false);
      setDirty(false);
    }
  }, [activeAtividadeIdx, atividades, selectedSiteId]);

  // When date changes, reset to "new" or first activity
  useEffect(() => {
    if (atividades.length > 0) {
      setActiveAtividadeIdx(0);
    } else {
      setActiveAtividadeIdx("new");
    }
  }, [selectedDate, atividades.length]);

  const handleCalendarDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setActiveTab("lancamento");
  };

  const handleSave = async () => {
    if (activeAtividadeIdx === "new") {
      // Create new activity
      const result = await criarAtividade.mutateAsync({
        projeto_id: selectedProjetoId || undefined,
        site_id: formSiteId || undefined,
        data: selectedDate,
        descricao_servico: descricao,
        equipe_campo: equipeCampo,
        observacoes: obs,
        clima: clima || undefined,
        uf: diarioUf || undefined,
        municipio: diarioMunicipio || undefined,
      });
      if (result) {
        toast({ title: "Atividade salva!" });
        // After saving, the atividades list will update; set to new idx
        // We'll rely on the effect to set the right index after refetch
        // For now mark as saved
        setSaved(true);
        setDirty(false);
      }
    } else if (currentAtividade) {
      // Update existing
      await atualizarAtividade.mutateAsync({
        id: currentAtividade.id,
        descricao_servico: descricao,
        equipe_campo: equipeCampo,
        observacoes: obs,
        clima: clima || undefined,
        uf: diarioUf || undefined,
        municipio: diarioMunicipio || undefined,
        site_id: formSiteId || null,
      });
      toast({ title: "Atividade atualizada!" });
      setSaved(true);
      setDirty(false);
    }
  };

  const handleNewAtividade = () => {
    setActiveAtividadeIdx("new");
  };

  const handleUploadFotos = async (files: FileList, input?: HTMLInputElement | null) => {
    if (!files.length) return;

    let diarioId = currentAtividade?.id;
    if (!diarioId) {
      try {
        const result = await criarAtividade.mutateAsync({
          projeto_id: selectedProjetoId || undefined,
          site_id: formSiteId || undefined,
          data: selectedDate,
          descricao_servico: descricao || undefined,
          equipe_campo: equipeCampo || undefined,
          observacoes: obs || undefined,
          clima: clima || undefined,
          uf: diarioUf || undefined,
          municipio: diarioMunicipio || undefined,
        });
        diarioId = result?.id;
        if (!diarioId) {
          toast({ title: "Erro ao criar atividade", variant: "destructive" });
          return;
        }
        setSaved(true);
        setDirty(false);
      } catch {
        toast({ title: "Erro ao criar atividade", variant: "destructive" });
        return;
      }
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = crypto.randomUUID();
      await addToUploadQueue({
        id,
        diarioId,
        file,
        status: 'pending'
      });
    }

    setUploadQueue(await getUploadQueue());
    if (input) input.value = "";
    processQueue();
  };

  const handleRemoveFoto = async (fotoId: string) => {
    await removeFoto.mutateAsync(fotoId);
    toast({ title: "Foto removida" });
  };

  const markDirty = () => { setDirty(true); setSaved(false); };

  const pendingCount = uploadQueue.filter(i => i.status === 'pending' || i.status === 'uploading').length;
  const failedCount = uploadQueue.filter(i => i.status === 'failed').length;
  const completedCount = uploadQueue.filter(i => i.status === 'completed').length;
  const totalInQueue = uploadQueue.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Diário de Campo</h1>
        <p className="text-muted-foreground">Registro simplificado de atividades realizadas em campo</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Projeto</label>
              <Select value={selectedProjetoId} onValueChange={handleProjetoChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {projetos.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Site <span className="text-muted-foreground text-xs">(opcional)</span></label>
              <Select value={selectedSiteId || "__all__"} onValueChange={v => setSelectedSiteId(v === "__all__" ? "" : v)} disabled={!selectedProjetoId}>
                <SelectTrigger><SelectValue placeholder="Todos os sites" /></SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  <SelectItem value="__all__">Todos os sites</SelectItem>
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.codigo} — {s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedProjetoId && (
        <div className="space-y-4">
          {activeTab === "calendario" && (
            <DiarioCalendario
              entries={calendarEntries}
              onDayClick={handleCalendarDayClick}
              periodoInicio={periodoInicio}
              periodoFim={periodoFim}
              onPeriodoChange={(inicio, fim) => { setPeriodoInicio(inicio); setPeriodoFim(fim); }}
            />
          )}

          {activeTab === "lancamento" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setActiveTab("calendario")}>
                  ← Voltar ao Calendário
                </Button>
                <span className="text-sm font-medium text-muted-foreground">
                  {format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy")}
                </span>
              </div>

              {/* Activity tabs inside the day view */}
              <div className="flex flex-wrap items-center gap-2">
                {atividades.map((_, idx) => (
                  <Button
                    key={idx}
                    variant={activeAtividadeIdx === idx ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveAtividadeIdx(idx)}
                    className="flex items-center gap-1"
                  >
                    <ClipboardEdit className="h-4 w-4" />
                    Atividade {idx + 1}
                  </Button>
                ))}
                <Button
                  variant={activeAtividadeIdx === "new" ? "default" : "outline"}
                  size="sm"
                  onClick={handleNewAtividade}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Nova Atividade
                </Button>
              </div>
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="min-w-[160px]">
                      <label className="text-sm font-medium mb-1 block">Data</label>
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                      />
                    </div>
                    <div className="min-w-[160px]">
                      <label className="text-sm font-medium mb-1 block">Clima</label>
                      <Select value={clima} onValueChange={v => { setClima(v); markDirty(); }}>
                        <SelectTrigger><SelectValue placeholder="Clima" /></SelectTrigger>
                        <SelectContent>
                          {CLIMA_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>
                              <span className="flex items-center gap-2">
                                <o.icon className={`h-4 w-4 ${o.color}`} />
                                {o.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <UfMunicipioSelector
                      uf={diarioUf}
                      municipio={diarioMunicipio}
                      onUfChange={v => { setDiarioUf(v); setDiarioMunicipio(""); markDirty(); }}
                      onMunicipioChange={v => { setDiarioMunicipio(v); markDirty(); }}
                    />
                    {/* Site per activity */}
                    <div className="min-w-[200px]">
                      <label className="text-sm font-medium mb-1 block">Site da Atividade</label>
                      <Select value={formSiteId || "__none__"} onValueChange={v => { setFormSiteId(v === "__none__" ? "" : v); markDirty(); }}>
                        <SelectTrigger><SelectValue placeholder="Sem site" /></SelectTrigger>
                        <SelectContent className="max-h-[300px] overflow-y-auto">
                          <SelectItem value="__none__">Sem site</SelectItem>
                          {sites.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.codigo} — {s.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Service description */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardEdit className="h-5 w-5 text-primary" />
                    Descrição do Serviço Realizado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Descreva as atividades realizadas em campo hoje..."
                    value={descricao}
                    onChange={e => { setDescricao(e.target.value); markDirty(); }}
                    className="min-h-[120px]"
                  />
                </CardContent>
              </Card>

              {/* Team */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Equipe em Campo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Informe os nomes dos membros da equipe (ex: João, Maria, Pedro - Encarregado)"
                    value={equipeCampo}
                    onChange={e => { setEquipeCampo(e.target.value); markDirty(); }}
                    className="min-h-[80px]"
                  />
                </CardContent>
              </Card>

              {/* Photos - only for saved activities */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Camera className="h-5 w-5 text-primary" />
                      Fotos
                    </div>
                    {totalInQueue > 0 && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        Fila: {completedCount}/{totalInQueue}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {totalInQueue > 0 && (
                    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-1.5">
                          {isProcessingQueue ? <RefreshCw className="h-3 w-3 animate-spin text-primary" /> : <Check className="h-3 w-3 text-green-600" />}
                          {isProcessingQueue ? `Enviando ${pendingCount} fotos...` : 'Envios concluídos'}
                        </span>
                        <span>{Math.round((completedCount / totalInQueue) * 100)}%</span>
                      </div>
                      <Progress value={(completedCount / totalInQueue) * 100} className="h-1.5" />
                      
                      {failedCount > 0 && (
                        <div className="flex items-center justify-between bg-destructive/10 p-2 rounded border border-destructive/20 mt-2">
                          <div className="flex items-center gap-2 text-destructive text-[11px]">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>{failedCount} fotos falharam</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-[10px] text-destructive hover:bg-destructive/20"
                            onClick={processQueue}
                            disabled={isProcessingQueue}
                          >
                            Tentar Novamente
                          </Button>
                        </div>
                      )}
                      
                      {!isProcessingQueue && completedCount === totalInQueue && (
                         <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full h-7 text-[10px] text-muted-foreground"
                          onClick={() => { clearCompletedUploads(); setUploadQueue([]); }}
                        >
                          Limpar Histórico de Envios
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById("campo-foto-input")?.click()}
                      disabled={isProcessingQueue}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isProcessingQueue ? "Enviando..." : "Selecionar Fotos"}
                    </Button>
                    <input
                      id="campo-foto-input"
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={e => e.target.files && handleUploadFotos(e.target.files, e.currentTarget)}
                    />
                    <Button
                      variant="outline"
                      onClick={() => (document.getElementById("campo-foto-input-camera") as HTMLInputElement)?.click()}
                      disabled={isProcessingQueue}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Câmera
                    </Button>
                    <input
                      id="campo-foto-input-camera"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => e.target.files && handleUploadFotos(e.target.files, e.currentTarget)}
                    />
                  </div>

                  {fotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {fotos.map(foto => (
                        <div key={foto.id} className="relative group rounded-lg overflow-hidden border">
                          <img
                            src={getPublicUrl(foto.url)}
                            alt={foto.legenda || "Foto de campo"}
                            className="w-full h-32 object-cover"
                          />
                          <button
                            onClick={() => handleRemoveFoto(foto.id)}
                            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 z-20 shadow-sm"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma foto enviada para esta atividade.</p>
                  )}
                </CardContent>
              </Card>

              {/* Observations */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Observações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Observações adicionais, ocorrências, impedimentos..."
                    value={obs}
                    onChange={e => { setObs(e.target.value); markDirty(); }}
                    className="min-h-[80px]"
                  />
                </CardContent>
              </Card>

              {/* Save button */}
              <div className="flex justify-end">
                {saved && !dirty ? (
                  <Button size="lg" variant="outline" disabled className="text-emerald-600 border-emerald-500 opacity-100">
                    <Check className="h-4 w-4 mr-2" />
                    Alterações Salvas
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={handleSave}
                    disabled={!selectedProjetoId || (!descricao && !equipeCampo && !obs)}
                  >
                    {activeAtividadeIdx === "new" ? "Salvar Atividade" : "Atualizar Atividade"}
                  </Button>
                )}
              </div>
            </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
