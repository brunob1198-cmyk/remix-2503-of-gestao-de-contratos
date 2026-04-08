import { useState, useCallback, useEffect } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useProjetos } from "@/hooks/useProjetos";
import { useSites } from "@/hooks/useSites";
import { useDiarioCampo, useDiarioCampoCalendario } from "@/hooks/useDiarioCampo";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarDays, ClipboardEdit, Camera, Upload, Trash2, Users, MapPin, Cloud,
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DiarioCalendarioEntry } from "@/components/medicoes/DiarioCalendario";

export default function DiarioCampoPage() {
  const { toast } = useToast();
  const { projetos } = useProjetos();
  const [selectedProjetoId, setSelectedProjetoId] = usePersistedState<string>("diario_campo_projeto_id", "");
  const { sites } = useSites(selectedProjetoId || undefined);
  const [selectedSiteId, setSelectedSiteId] = usePersistedState<string>("diario_campo_site_id", "");
  const [selectedDate, setSelectedDate] = usePersistedState<string>("diario_campo_date", format(new Date(), "yyyy-MM-dd"));
  const [activeTab, setActiveTab] = useState<string>("calendario");
  const [periodoInicio, setPeriodoInicio] = useState(() => format(subMonths(new Date(), 2), "yyyy-MM-dd"));
  const [periodoFim, setPeriodoFim] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [diarioUf, setDiarioUf] = usePersistedState<string>("diario_campo_uf", "");
  const [diarioMunicipio, setDiarioMunicipio] = usePersistedState<string>("diario_campo_municipio", "");

  // Form state
  const [descricao, setDescricao] = useState("");
  const [equipeCampo, setEquipeCampo] = useState("");
  const [obs, setObs] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleProjetoChange = (projetoId: string) => {
    setSelectedProjetoId(projetoId);
    setSelectedSiteId("");
  };

  const {
    diario, loadingDiario, fotos, criarDiario, atualizarDiario, addFoto, removeFoto,
  } = useDiarioCampo(selectedSiteId, selectedDate);

  const { data: calendarRaw = [] } = useDiarioCampoCalendario(
    selectedSiteId || undefined, periodoInicio, periodoFim
  );

  // Map calendar data to DiarioCalendarioEntry format
  const calendarEntries: DiarioCalendarioEntry[] = calendarRaw.map(e => ({
    id: e.id,
    data: e.data,
    clima: e.clima,
    observacoes: e.descricao || null,
    totalProducao: 0,
    totalItens: e.hasContent ? 1 : 0,
    totalEquipe: e.totalFotos,
  }));

  // Sync form from diario
  useEffect(() => {
    if (diario) {
      setDescricao(diario.descricao_servico || "");
      setEquipeCampo(diario.equipe_campo || "");
      setObs(diario.observacoes || "");
      if (diario.uf) setDiarioUf(diario.uf);
      if (diario.municipio) setDiarioMunicipio(diario.municipio);
    } else {
      setDescricao("");
      setEquipeCampo("");
      setObs("");
    }
  }, [diario?.id]);

  const handleCalendarDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setActiveTab("lancamento");
  };

  const ensureDiario = useCallback(async () => {
    if (diario) return diario.id;
    try {
      const result = await criarDiario.mutateAsync({
        site_id: selectedSiteId,
        data: selectedDate,
        uf: diarioUf || undefined,
        municipio: diarioMunicipio || undefined,
      });
      return result.id;
    } catch {
      return null;
    }
  }, [diario, criarDiario, selectedSiteId, selectedDate, diarioUf, diarioMunicipio]);

  const handleClimaChange = async (clima: string) => {
    const diarioId = diario?.id || (await ensureDiario());
    if (!diarioId) return;
    await atualizarDiario.mutateAsync({ id: diarioId, clima });
    toast({ title: "Clima atualizado!" });
  };

  const handleUfChange = async (uf: string) => {
    setDiarioUf(uf);
    setDiarioMunicipio("");
    if (diario?.id) {
      await atualizarDiario.mutateAsync({ id: diario.id, uf, municipio: "" });
    }
  };

  const handleMunicipioChange = async (municipio: string) => {
    setDiarioMunicipio(municipio);
    if (diario?.id) {
      await atualizarDiario.mutateAsync({ id: diario.id, uf: diarioUf, municipio });
    }
  };

  const handleSaveDescricao = async () => {
    const diarioId = diario?.id || (await ensureDiario());
    if (!diarioId) return;
    await atualizarDiario.mutateAsync({
      id: diarioId,
      descricao_servico: descricao,
      equipe_campo: equipeCampo,
      observacoes: obs,
    });
    toast({ title: "Registro salvo!" });
  };

  const handleUploadFotos = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    const diarioId = diario?.id || (await ensureDiario());
    if (!diarioId) { setUploading(false); return; }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = `campo/${diarioId}/${Date.now()}_${i}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("diario-fotos").upload(path, file);
      if (uploadError) {
        toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
        continue;
      }
      const { data: urlData } = supabase.storage.from("diario-fotos").getPublicUrl(path);
      await addFoto.mutateAsync({ diario_campo_id: diarioId, url: urlData.publicUrl });
    }
    setUploading(false);
    toast({ title: `${files.length} foto(s) enviada(s)!` });
  };

  const handleRemoveFoto = async (fotoId: string) => {
    await removeFoto.mutateAsync(fotoId);
    toast({ title: "Foto removida" });
  };

  const selectedProjeto = projetos.find(p => p.id === selectedProjetoId);
  const selectedSite = sites.find(s => s.id === selectedSiteId);

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
              <label className="text-sm font-medium mb-1 block">Site</label>
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId} disabled={!selectedProjetoId}>
                <SelectTrigger><SelectValue placeholder="Selecione o site" /></SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                    {sites.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedSiteId && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="calendario" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="lancamento" className="flex items-center gap-2">
              <ClipboardEdit className="h-4 w-4" />
              Lançamento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendario">
            <DiarioCalendario
              entries={calendarEntries}
              onDayClick={handleCalendarDayClick}
              periodoInicio={periodoInicio}
              periodoFim={periodoFim}
              onPeriodoChange={(inicio, fim) => { setPeriodoInicio(inicio); setPeriodoFim(fim); }}
            />
          </TabsContent>

          <TabsContent value="lancamento">
            <div className="space-y-4">
              {/* Date and location header */}
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
                      <Select
                        value={(diario as any)?.clima || ""}
                        onValueChange={handleClimaChange}
                      >
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
                      onUfChange={handleUfChange}
                      onMunicipioChange={handleMunicipioChange}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Service description - Main field */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardEdit className="h-5 w-5 text-primary" />
                    Descrição do Serviço Realizado
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Descreva as atividades realizadas em campo hoje... (ex: Instalação de cabos no trecho A, lançamento de fibra entre postes 15-30)"
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
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
                    onChange={e => setEquipeCampo(e.target.value)}
                    className="min-h-[80px]"
                  />
                </CardContent>
              </Card>

              {/* Photos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="h-5 w-5 text-primary" />
                    Fotos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                      onChange={e => e.target.files && handleUploadFotos(e.target.files)}
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        const input = document.getElementById("campo-foto-input-camera") as HTMLInputElement;
                        input?.click();
                      }}
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
                      onChange={e => e.target.files && handleUploadFotos(e.target.files)}
                    />
                  </div>

                  {fotos.length > 0 && (
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
                  )}
                  {fotos.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma foto enviada para este dia.</p>
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
                    onChange={e => setObs(e.target.value)}
                    className="min-h-[80px]"
                  />
                </CardContent>
              </Card>

              {/* Save button */}
              <div className="flex justify-end">
                <Button
                  size="lg"
                  onClick={handleSaveDescricao}
                  disabled={!selectedSiteId || (!descricao && !equipeCampo && !obs)}
                >
                  Salvar Registro de Campo
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {!selectedSiteId && selectedProjetoId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione um site para visualizar o diário de campo.
          </CardContent>
        </Card>
      )}
      {!selectedProjetoId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione um projeto para começar.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
