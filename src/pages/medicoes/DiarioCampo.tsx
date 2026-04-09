import { useState, useCallback, useEffect } from "react";
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
import {
  ClipboardEdit, Camera, Upload, Trash2, Users, MapPin, Check, Plus,
} from "lucide-react";
import { format, subMonths } from "date-fns";
import type { DiarioCalendarioEntry } from "@/components/medicoes/DiarioCalendario";

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

  const handleProjetoChange = (projetoId: string) => {
    setSelectedProjetoId(projetoId);
    setSelectedSiteId("");
  };

  const { atividades, loadingAtividades, criarAtividade, atualizarAtividade } =
    useDiarioCampoAtividades(selectedProjetoId, selectedSiteId, selectedDate);

  const currentAtividade = typeof activeAtividadeIdx === "number" ? atividades[activeAtividadeIdx] : null;

  const { fotos, addFoto, removeFoto } = useDiarioCampoFotos(currentAtividade?.id);

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
  useEffect(() => {
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
  }, [activeAtividadeIdx, atividades.length]);

  // When date changes, reset to "new" or first activity
  useEffect(() => {
    if (atividades.length > 0) {
      setActiveAtividadeIdx(0);
    } else {
      setActiveAtividadeIdx("new");
    }
  }, [selectedDate, atividades.length === 0]);

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
    setUploading(true);

    // If activity not yet saved, auto-create it first
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
          setUploading(false);
          return;
        }
        setSaved(true);
        setDirty(false);
      } catch {
        toast({ title: "Erro ao criar atividade", variant: "destructive" });
        setUploading(false);
        return;
      }
    }

    let uploadedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = `campo/${diarioId}/${Date.now()}_${i}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("diario-fotos").upload(path, file);
      if (uploadError) {
        toast({ title: "Erro no upload", description: `${file.name}: ${uploadError.message}`, variant: "destructive" });
        continue;
      }
      const { data: urlData } = supabase.storage.from("diario-fotos").getPublicUrl(path);
      // Insert directly with the correct diarioId to avoid stale hook reference
      const { error: insertError } = await supabase
        .from("diario_campo_fotos")
        .insert([{ diario_campo_id: diarioId, url: urlData.publicUrl }]);
      if (insertError) {
        toast({ title: "Erro ao salvar foto", description: insertError.message, variant: "destructive" });
        await supabase.storage.from("diario-fotos").remove([path]);
        continue;
      }

      uploadedCount += 1;
    }
    // Refresh fotos and atividades queries
    queryClient.invalidateQueries({ queryKey: ["diario_campo_fotos"] });
    queryClient.invalidateQueries({ queryKey: ["diario_campo_atividades"] });
    setUploading(false);

    if (input) {
      input.value = "";
    }

    if (uploadedCount > 0) {
      toast({ title: `${uploadedCount} foto(s) enviada(s)!` });
    }
  };

  const handleRemoveFoto = async (fotoId: string) => {
    await removeFoto.mutateAsync(fotoId);
    toast({ title: "Foto removida" });
  };

  const markDirty = () => { setDirty(true); setSaved(false); };

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
          {/* Calendar view - always visible when calendario tab */}
          <DiarioCalendario
            entries={calendarEntries}
            onDayClick={handleCalendarDayClick}
            periodoInicio={periodoInicio}
            periodoFim={periodoFim}
            onPeriodoChange={(inicio, fim) => { setPeriodoInicio(inicio); setPeriodoFim(fim); }}
          />

          {/* Activity tabs below calendar, tied to selectedDate */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground mr-1">
              {format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy")}:
            </span>

            {atividades.map((_, idx) => (
              <Button
                key={idx}
                variant={activeTab === "lancamento" && activeAtividadeIdx === idx ? "default" : "outline"}
                size="sm"
                onClick={() => { setActiveTab("lancamento"); setActiveAtividadeIdx(idx); }}
                className="flex items-center gap-1"
              >
                <ClipboardEdit className="h-4 w-4" />
                Atividade {idx + 1}
              </Button>
            ))}

            <Button
              variant={activeTab === "lancamento" && activeAtividadeIdx === "new" ? "default" : "outline"}
              size="sm"
              onClick={() => { setActiveTab("lancamento"); handleNewAtividade(); }}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Nova Atividade
            </Button>

            {atividades.length === 0 && activeTab !== "lancamento" && (
              <span className="text-sm text-muted-foreground italic">Nenhuma atividade neste dia</span>
            )}
          </div>

          {/* Activity form */}
          {activeTab === "lancamento" && (
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
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="h-5 w-5 text-primary" />
                    Fotos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => document.getElementById("campo-foto-input")?.click()}
                          disabled={uploading}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploading ? "Enviando..." : "Enviar Fotos"}
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
                          disabled={uploading}
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
                                src={foto.url}
                                alt={foto.legenda || "Foto de campo"}
                                className="w-full h-32 object-cover"
                              />
                              <button
                                onClick={() => handleRemoveFoto(foto.id)}
                                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhuma foto enviada para esta atividade.</p>
                      )}
                    </>
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
          )}
        </div>
      )}
    </div>
  );
}
