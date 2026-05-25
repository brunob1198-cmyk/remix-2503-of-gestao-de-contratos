import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { resolveFileUrl } from "@/utils/fileUrlResolver";
import { SafeImage } from "@/components/ui/SafeImage";
import { SmartImage } from "@/components/ui/SmartImage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, ArrowRight, Image, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { safeFormat } from "@/lib/utils";
import type { DiarioCampo, DiarioCampoFoto } from "@/hooks/useDiarioCampo";
import type { DiarioFoto } from "@/hooks/useDiarioObra";

interface AnotacoesCampoDialogProps {
  atividadesCampo: DiarioCampo[];
  diarioObraId: string | null;
  itensDisponiveis: { id: string; item_lpu_id: string; nome: string }[];
  producoes: { id: string; item_lpu_id: string }[];
  fotosObra?: DiarioFoto[];
  onFotoTransferred: () => void;
  ensureDiario: () => Promise<string | null>;
  selectedDate: string;
}

export function AnotacoesCampoDialog({
  atividadesCampo,
  diarioObraId,
  itensDisponiveis,
  producoes,
  fotosObra = [],
  onFotoTransferred,
  ensureDiario,
  selectedDate,
}: AnotacoesCampoDialogProps) {
  const { toast } = useToast();
  const [transferring, setTransferring] = useState<Record<string, boolean>>({});
  const [removing, setRemoving] = useState<Record<string, boolean>>({});
  const [selectedTarget, setSelectedTarget] = useState<Record<string, string>>({});

  // Fetch photos for ALL activities at once
  const atividadeIds = atividadesCampo.map(a => a.id);
  const { data: allFotos = [] } = useQuery({
    queryKey: ["diario_campo_fotos_all", ...atividadeIds],
    queryFn: async () => {
      if (atividadeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("diario_campo_fotos")
        .select("*")
        .in("diario_campo_id", atividadeIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as DiarioCampoFoto[];
    },
    enabled: atividadeIds.length > 0,
  });

  const totalFotos = allFotos.length;

  const handleTransferFoto = async (foto: DiarioCampoFoto) => {
    const fotoId = foto.id;
    const target = selectedTarget[fotoId] || "geral";
    setTransferring((p) => ({ ...p, [fotoId]: true }));

    try {
      const diarioId = diarioObraId || (await ensureDiario());
      if (!diarioId) throw new Error("Não foi possível criar o diário de obra");

      const insertData: any = {
        diario_id: diarioId,
        url: foto.url,
        thumb_url: foto.thumb_url,
        thumb_600_url: foto.thumb_600_url,
        classificacao: "execucao",
        legenda: foto.legenda || "Transferido do Diário de Campo",
      };

      if (target !== "geral") {
        insertData.diario_producao_id = target;
      }

      const { error } = await supabase.from("diario_fotos").insert([insertData]);
      if (error) throw error;

      onFotoTransferred();
      toast({ title: "Foto transferida para o Diário de Obra!" });
    } catch (err: any) {
      toast({ title: "Erro ao transferir", description: err.message, variant: "destructive" });
    } finally {
      setTransferring((p) => ({ ...p, [fotoId]: false }));
    }
  };

  const handleRemoveFoto = async (fotoUrl: string) => {
    const fotoNoDiario = fotosObra.find(f => f.url === fotoUrl);
    if (!fotoNoDiario) return;

    setRemoving((p) => ({ ...p, [fotoNoDiario.id]: true }));

    try {
      const { error } = await supabase
        .from("diario_fotos")
        .delete()
        .eq("id", fotoNoDiario.id);
      
      if (error) throw error;

      onFotoTransferred(); // Invalidate parent queries
      toast({ title: "Foto removida do Diário de Obra!" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    } finally {
      setRemoving((p) => ({ ...p, [fotoNoDiario.id]: false }));
    }
  };

  const handleTransferAll = async (fotos: DiarioCampoFoto[]) => {
    const untransferred = fotos.filter(f => !fotosObra.some(fo => fo.url === f.url));
    if (untransferred.length === 0) {
      toast({ title: "Todas as fotos já foram transferidas" });
      return;
    }

    const diarioId = diarioObraId || (await ensureDiario());
    if (!diarioId) return;

    setTransferring(prev => {
      const next = { ...prev };
      untransferred.forEach(f => { next[f.id] = true; });
      return next;
    });

    try {
      const inserts = untransferred.map(foto => {
        const target = selectedTarget[foto.id] || "geral";
        const data: any = {
          diario_id: diarioId,
          url: foto.url,
          thumb_url: foto.thumb_url,
          thumb_600_url: foto.thumb_600_url,
          classificacao: "execucao",
          legenda: foto.legenda || "Transferido do Diário de Campo",
        };
        if (target !== "geral") data.diario_producao_id = target;
        return data;
      });

      const { error } = await supabase.from("diario_fotos").insert(inserts);
      if (error) throw error;

      onFotoTransferred();
      toast({ title: `${untransferred.length} fotos transferidas com sucesso!` });
    } catch (err: any) {
      toast({ title: "Erro ao transferir fotos", description: err.message, variant: "destructive" });
    } finally {
      setTransferring(prev => {
        const next = { ...prev };
        untransferred.forEach(f => { next[f.id] = false; });
        return next;
      });
    }
  };

  const handleRemoveAll = async (fotos: DiarioCampoFoto[]) => {
    const transferred = fotos
      .map(f => fotosObra.find(fo => fo.url === f.url))
      .filter((fo): fo is DiarioFoto => !!fo);
    
    if (transferred.length === 0) {
      toast({ title: "Nenhuma foto para remover" });
      return;
    }

    const idsToRemove = transferred.map(f => f.id);
    
    setRemoving(prev => {
      const next = { ...prev };
      idsToRemove.forEach(id => { next[id] = true; });
      return next;
    });

    try {
      const { error } = await supabase
        .from("diario_fotos")
        .delete()
        .in("id", idsToRemove);
      
      if (error) throw error;

      onFotoTransferred();
      toast({ title: `${transferred.length} fotos removidas com sucesso!` });
    } catch (err: any) {
      toast({ title: "Erro ao remover fotos", description: err.message, variant: "destructive" });
    } finally {
      setRemoving(prev => {
        const next = { ...prev };
        idsToRemove.forEach(id => { next[id] = false; });
        return next;
      });
    }
  };

  const targetOptions = [
    { value: "geral", label: "📷 Geral (sem item LPU)" },
    ...producoes.map((p) => {
      const item = itensDisponiveis.find((i) => i.item_lpu_id === p.item_lpu_id);
      return { value: p.id, label: item?.nome || p.item_lpu_id };
    }),
  ];

  const hasAtividades = atividadesCampo.length > 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2 text-primary" />
          Anotações de Campo
          <Badge variant="secondary" className="ml-2 text-xs">
            {hasAtividades
              ? `${atividadesCampo.length} atividade${atividadesCampo.length !== 1 ? "s" : ""}${totalFotos > 0 ? ` · ${totalFotos} foto${totalFotos !== 1 ? "s" : ""}` : ""}`
              : "Sem registros"}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Anotações de Campo
            <Badge variant="outline" className="ml-2 text-xs">
              {safeFormat(selectedDate, "dd/MM/yyyy")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-4">
            {hasAtividades ? (
              <Tabs defaultValue={atividadesCampo[0].id} className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto mb-4 bg-muted/30 h-auto p-1">
                  {atividadesCampo.map((atividade, idx) => (
                    <TabsTrigger 
                      key={atividade.id} 
                      value={atividade.id}
                      className="text-xs data-[state=active]:bg-background"
                    >
                      Atividade {idx + 1}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                {atividadesCampo.map((atividade, idx) => {
                  const fotosAtividade = allFotos.filter(f => f.diario_campo_id === atividade.id);
                  const hasContent = !!(atividade.descricao_servico || atividade.equipe_campo || atividade.observacoes || fotosAtividade.length > 0);

                  return (
                    <TabsContent key={atividade.id} value={atividade.id} className="mt-0">
                      <div className="flex items-center gap-2 mb-4">
                        {atividade.clima && (
                          <Badge variant="secondary" className="text-xs font-normal">Clima: {atividade.clima}</Badge>
                        )}
                        {atividade.uf && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {atividade.uf}{atividade.municipio ? ` / ${atividade.municipio}` : ""}
                          </Badge>
                        )}
                      </div>

                      {!hasContent && (
                        <p className="text-sm text-muted-foreground italic text-center py-8">
                          Registro de campo encontrado, mas sem anotações preenchidas para esta atividade.
                        </p>
                      )}

                      {atividade.descricao_servico && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-primary/80 uppercase tracking-wider mb-2">Descrição do Serviço</p>
                          <p className="text-sm bg-muted/40 rounded-lg p-4 whitespace-pre-wrap border border-border/50">{atividade.descricao_servico}</p>
                        </div>
                      )}

                      {atividade.equipe_campo && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-primary/80 uppercase tracking-wider mb-2">Equipe em Campo</p>
                          <p className="text-sm bg-muted/40 rounded-lg p-4 whitespace-pre-wrap border border-border/50">{atividade.equipe_campo}</p>
                        </div>
                      )}

                      {atividade.observacoes && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-primary/80 uppercase tracking-wider mb-2">Observações</p>
                          <p className="text-sm bg-muted/40 rounded-lg p-4 whitespace-pre-wrap border border-border/50">{atividade.observacoes}</p>
                        </div>
                      )}

                      {fotosAtividade.length > 0 && (
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center justify-between gap-2 border-b pb-2 mb-2">
                            <p className="text-xs font-semibold text-primary/80 uppercase tracking-wider flex items-center">
                              <Image className="h-3.5 w-3.5 mr-2" />
                              Fotos ({fotosAtividade.length})
                            </p>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-[11px] px-3"
                                onClick={() => handleTransferAll(fotosAtividade)}
                                disabled={fotosAtividade.every(f => fotosObra.some(fo => fo.url === f.url))}
                              >
                                Transferir Todas
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 text-[11px] px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemoveAll(fotosAtividade)}
                                disabled={!fotosAtividade.some(f => fotosObra.some(fo => fo.url === f.url))}
                              >
                                Remover Todas
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-4">
                            {fotosAtividade.map((f) => {
                              const fotoNoDiario = fotosObra.find(fo => fo.url === f.url);
                              const isTransferred = !!fotoNoDiario;
                              
                              return (
                                <div key={f.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border rounded-xl p-3 bg-muted/20 hover:bg-muted/30 transition-colors">
                                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0 group relative">
                                    <SmartImage 
                                      src={f.thumb_url || f.url} 
                                      context="diario_campo_fotos" 
                                      fallbackUrls={[f.thumb_600_url, f.url]} 
                                      alt={f.legenda || "Foto"} 
                                      className="w-24 h-24 object-cover rounded-lg border shadow-sm group-hover:opacity-90 transition-opacity" 
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="bg-black/40 rounded-full p-1.5">
                                        <Image className="h-4 w-4 text-white" />
                                      </div>
                                    </div>
                                  </a>
                                  <div className="flex-1 w-full space-y-3">
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Destino no Diário</p>
                                      <Select
                                        value={selectedTarget[f.id] || (fotoNoDiario?.diario_producao_id || "geral")}
                                        onValueChange={(v) => setSelectedTarget((p) => ({ ...p, [f.id]: v }))}
                                        disabled={isTransferred}
                                      >
                                        <SelectTrigger className="h-9 text-xs bg-background">
                                          <SelectValue placeholder="Destino" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {targetOptions.map((o) => (
                                            <SelectItem key={o.value} value={o.value} className="text-xs">
                                              {o.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                      {isTransferred ? (
                                        <>
                                          <Badge variant="outline" className="text-xs py-1.5 px-3 bg-emerald-50 text-emerald-700 border-emerald-200">
                                            <Check className="h-3 w-3 mr-1.5" /> Transferida
                                          </Badge>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleRemoveFoto(f.url)}
                                            disabled={removing[fotoNoDiario?.id || ""]}
                                          >
                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                            {removing[fotoNoDiario?.id || ""] ? "Removendo..." : "Remover"}
                                          </Button>
                                        </>
                                      ) : (
                                        <Button
                                          size="sm"
                                          className="h-9 text-xs px-4"
                                          onClick={() => handleTransferFoto(f)}
                                          disabled={transferring[f.id]}
                                        >
                                          <ArrowRight className="h-3.5 w-3.5 mr-2" />
                                          {transferring[f.id] ? "Transferindo..." : "Transferir Foto"}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-12">
                Nenhuma anotação de campo encontrada para este dia.
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
