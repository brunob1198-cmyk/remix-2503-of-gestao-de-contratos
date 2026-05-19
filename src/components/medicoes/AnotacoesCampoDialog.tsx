import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPublicUrl } from "@/services/uploadImage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
              atividadesCampo.map((atividade, idx) => {
                const fotosAtividade = allFotos.filter(f => f.diario_campo_id === atividade.id);
                const hasContent = !!(atividade.descricao_servico || atividade.equipe_campo || atividade.observacoes || fotosAtividade.length > 0);

                return (
                  <div key={atividade.id}>
                    {idx > 0 && <Separator className="my-4" />}
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="default" className="text-xs">
                        Atividade {idx + 1}
                      </Badge>
                      {atividade.clima && (
                        <Badge variant="secondary" className="text-xs">Clima: {atividade.clima}</Badge>
                      )}
                      {atividade.uf && (
                        <Badge variant="secondary" className="text-xs">
                          {atividade.uf}{atividade.municipio ? ` / ${atividade.municipio}` : ""}
                        </Badge>
                      )}
                    </div>

                    {!hasContent && (
                      <p className="text-sm text-muted-foreground italic">
                        Registro de campo encontrado, mas sem anotações preenchidas.
                      </p>
                    )}

                    {atividade.descricao_servico && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Descrição do Serviço</p>
                        <p className="text-sm bg-muted/50 rounded-md p-3 whitespace-pre-wrap">{atividade.descricao_servico}</p>
                      </div>
                    )}

                    {atividade.equipe_campo && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Equipe em Campo</p>
                        <p className="text-sm bg-muted/50 rounded-md p-3 whitespace-pre-wrap">{atividade.equipe_campo}</p>
                      </div>
                    )}

                    {atividade.observacoes && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
                        <p className="text-sm bg-muted/50 rounded-md p-3 whitespace-pre-wrap">{atividade.observacoes}</p>
                      </div>
                    )}

                    {fotosAtividade.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            <Image className="h-3.5 w-3.5 inline mr-1" />
                            Fotos ({fotosAtividade.length}) — Transferir para Diário de Obra
                          </p>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-[10px] px-2"
                              onClick={() => handleTransferAll(fotosAtividade)}
                              disabled={fotosAtividade.every(f => fotosObra.some(fo => fo.url === f.url))}
                            >
                              Transferir Todas
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-[10px] px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveAll(fotosAtividade)}
                              disabled={!fotosAtividade.some(f => fotosObra.some(fo => fo.url === f.url))}
                            >
                              Remover Todas
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {fotosAtividade.map((f) => {
                            const fotoNoDiario = fotosObra.find(fo => fo.url === f.url);
                            const isTransferred = !!fotoNoDiario;
                            
                            return (
                              <div key={f.id} className="flex items-center gap-3 border rounded-lg p-2 bg-muted/30">
                                <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                  <img src={getPublicUrl(f.url)} alt={f.legenda || "Foto"} className="w-20 h-20 object-cover rounded-md border" />
                                </a>
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <Select
                                    value={selectedTarget[f.id] || (fotoNoDiario?.diario_producao_id || "geral")}
                                    onValueChange={(v) => setSelectedTarget((p) => ({ ...p, [f.id]: v }))}
                                    disabled={isTransferred}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
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
                                  
                                  <div className="flex gap-2">
                                    {isTransferred ? (
                                      <>
                                        <Badge variant="outline" className="text-xs py-1">
                                          <Check className="h-3 w-3 mr-1 text-emerald-600" /> Transferida
                                        </Badge>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                          onClick={() => handleRemoveFoto(f.url)}
                                          disabled={removing[fotoNoDiario?.id || ""]}
                                        >
                                          <Trash2 className="h-3 w-3 mr-1" />
                                          {removing[fotoNoDiario?.id || ""] ? "Removendo..." : "Remover"}
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => handleTransferFoto(f)}
                                        disabled={transferring[f.id]}
                                      >
                                        <ArrowRight className="h-3 w-3 mr-1" />
                                        {transferring[f.id] ? "Transferindo..." : "Transferir"}
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
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Nenhuma anotação de campo encontrada para este dia.
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
