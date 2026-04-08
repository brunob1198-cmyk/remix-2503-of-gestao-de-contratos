import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, ArrowRight, Image, Check } from "lucide-react";
import { format } from "date-fns";
import type { DiarioCampo, DiarioCampoFoto } from "@/hooks/useDiarioCampo";

interface AnotacoesCampoDialogProps {
  diarioCampo: DiarioCampo;
  fotosCampo: DiarioCampoFoto[];
  diarioObraId: string | null;
  itensDisponiveis: { id: string; item_lpu_id: string; nome: string }[];
  producoes: { id: string; item_lpu_id: string }[];
  onFotoTransferred: () => void;
  ensureDiario: () => Promise<string | null>;
}

export function AnotacoesCampoDialog({
  diarioCampo,
  fotosCampo,
  diarioObraId,
  itensDisponiveis,
  producoes,
  onFotoTransferred,
  ensureDiario,
}: AnotacoesCampoDialogProps) {
  const { toast } = useToast();
  const [transferring, setTransferring] = useState<Record<string, boolean>>({});
  const [transferred, setTransferred] = useState<Record<string, boolean>>({});
  const [selectedTarget, setSelectedTarget] = useState<Record<string, string>>({});

  const handleTransferFoto = async (foto: DiarioCampoFoto) => {
    const fotoId = foto.id;
    const target = selectedTarget[fotoId] || "geral";
    setTransferring(p => ({ ...p, [fotoId]: true }));

    try {
      const diarioId = diarioObraId || (await ensureDiario());
      if (!diarioId) throw new Error("Não foi possível criar o diário de obra");

      const insertData: any = {
        diario_id: diarioId,
        url: foto.url,
        classificacao: "execucao",
        legenda: foto.legenda || "Transferido do Diário de Campo",
      };

      if (target !== "geral") {
        // target is a producao id
        insertData.diario_producao_id = target;
      }

      const { error } = await supabase.from("diario_fotos").insert([insertData]);
      if (error) throw error;

      setTransferred(p => ({ ...p, [fotoId]: true }));
      onFotoTransferred();
      toast({ title: "Foto transferida para o Diário de Obra!" });
    } catch (err: any) {
      toast({ title: "Erro ao transferir", description: err.message, variant: "destructive" });
    } finally {
      setTransferring(p => ({ ...p, [fotoId]: false }));
    }
  };

  // Build target options: geral + each producao item
  const targetOptions = [
    { value: "geral", label: "📷 Geral (sem item LPU)" },
    ...producoes.map(p => {
      const item = itensDisponiveis.find(i => i.item_lpu_id === p.item_lpu_id);
      return { value: p.id, label: item?.nome || p.item_lpu_id };
    }),
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-orange-300 text-orange-600 hover:bg-orange-50">
          <FileText className="h-4 w-4 mr-2" />
          Anotações de Campo
          <Badge variant="secondary" className="ml-2 text-xs">
            {fotosCampo.length} foto{fotosCampo.length !== 1 ? "s" : ""}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-500" />
            Anotações de Campo
            <Badge variant="outline" className="ml-2 text-xs">
              {format(new Date(diarioCampo.data + "T12:00:00"), "dd/MM/yyyy")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-4">
            {/* Text content */}
            {diarioCampo.descricao_servico && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Descrição do Serviço</p>
                <p className="text-sm bg-muted/50 rounded-md p-3 whitespace-pre-wrap">{diarioCampo.descricao_servico}</p>
              </div>
            )}
            {diarioCampo.equipe_campo && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Equipe em Campo</p>
                <p className="text-sm bg-muted/50 rounded-md p-3 whitespace-pre-wrap">{diarioCampo.equipe_campo}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {diarioCampo.clima && (
                <Badge variant="secondary" className="text-xs">Clima: {diarioCampo.clima}</Badge>
              )}
              {diarioCampo.uf && (
                <Badge variant="secondary" className="text-xs">
                  {diarioCampo.uf}{diarioCampo.municipio ? ` / ${diarioCampo.municipio}` : ""}
                </Badge>
              )}
            </div>
            {diarioCampo.observacoes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
                <p className="text-sm bg-muted/50 rounded-md p-3 whitespace-pre-wrap">{diarioCampo.observacoes}</p>
              </div>
            )}

            {/* Photos with transfer */}
            {fotosCampo.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  <Image className="h-3.5 w-3.5 inline mr-1" />
                  Fotos ({fotosCampo.length}) — Transferir para Diário de Obra
                </p>
                <div className="space-y-3">
                  {fotosCampo.map(f => (
                    <div key={f.id} className="flex items-center gap-3 border rounded-lg p-2 bg-muted/30">
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img src={f.url} alt={f.legenda || "Foto"} className="w-20 h-20 object-cover rounded-md border" />
                      </a>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <Select
                          value={selectedTarget[f.id] || "geral"}
                          onValueChange={v => setSelectedTarget(p => ({ ...p, [f.id]: v }))}
                          disabled={transferred[f.id]}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Destino" />
                          </SelectTrigger>
                          <SelectContent>
                            {targetOptions.map(o => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {transferred[f.id] ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-400 text-xs">
                            <Check className="h-3 w-3 mr-1" /> Transferida
                          </Badge>
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
                  ))}
                </div>
              </div>
            )}

            {!diarioCampo.descricao_servico && !diarioCampo.equipe_campo && !diarioCampo.observacoes && fotosCampo.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Registro de campo criado, mas sem anotações preenchidas.</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
