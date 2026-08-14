import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChecklistPlanoAcao, useChecklistPlanosAcao } from "@/hooks/checklists/useChecklists";
import { uploadImage } from "@/services/uploadImage";
import { resolveFileUrl } from "@/utils/fileUrlResolver";
import { AlertOctagon, CheckCircle2, Clock, FileCheck, Loader2, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface PlanoAcaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: ChecklistPlanoAcao | null;
}

export function PlanoAcaoDialog({
  open,
  onOpenChange,
  plano,
}: PlanoAcaoDialogProps) {
  const { updatePlanoAcao, convertToNaoConformidade } = useChecklistPlanosAcao();
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<any>(plano?.status || "Aberto");
  const [evidenciaUrl, setEvidenciaUrl] = useState(plano?.evidencia_conclusao_r2_url || "");

  if (!plano) return null;

  const handleEvidenciaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const res = await uploadImage(file);
      if (res) {
        setEvidenciaUrl(res);
        toast.success("Evidência de conclusão anexada no R2!");
      }
    } catch (err: any) {
      toast.error(`Erro ao anexar arquivo: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      await updatePlanoAcao.mutateAsync({
        id: plano.id,
        status,
        evidencia_conclusao_r2_url: evidenciaUrl || null,
        data_conclusao: status === "Concluido" ? new Date().toISOString().split("T")[0] : null,
      });
      onOpenChange(false);
    } catch (err) {
      // Handled
    }
  };

  const handleConvertNc = async () => {
    if (confirm("Deseja converter esta ação em uma Não Conformidade formal do SGSST?")) {
      await convertToNaoConformidade.mutateAsync(plano);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Plano de Ação 5W2H [{plano.codigo || "PA"}]
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* 5W2H Summary */}
          <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground font-semibold">O que fazer (What):</span>
              <span className="font-bold text-foreground">{plano.o_que_fazer}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground font-semibold">Por que (Why):</span>
              <span>{plano.por_que || "Desvio em checklist de campo"}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground font-semibold">Onde (Where):</span>
              <span>{plano.onde || "Canteiro de obra"}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground font-semibold">Prazo (When):</span>
              <span className="font-bold text-red-600">{plano.quando_prazo || "Sem Prazo"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-semibold">Responsável (Who):</span>
              <span>{plano.quem_responsavel?.nome || "Não atribuído"}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Status do Plano de Ação</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aberto">Aberto</SelectItem>
                  <SelectItem value="Em_Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Concluido">Concluído</SelectItem>
                  <SelectItem value="Atrasado">Atrasado</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Prioridade</Label>
              <Input className="text-xs" value={plano.prioridade} disabled />
            </div>
          </div>

          {/* Evidence Upload */}
          <div className="space-y-1 p-3 bg-slate-50 border rounded">
            <Label className="text-xs font-semibold">Evidência de Conclusão (Upload Cloudflare R2)</Label>
            <div className="flex items-center gap-2 pt-1">
              <Input type="file" onChange={handleEvidenciaUpload} disabled={isUploading} className="text-xs max-w-xs bg-white" />
              {isUploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>
            {evidenciaUrl && (
              <a href={resolveFileUrl(evidenciaUrl)} target="_blank" rel="noreferrer" className="text-xs text-primary underline font-medium flex items-center gap-1 pt-1">
                <FileCheck className="h-3.5 w-3.5" /> Ver Evidência Anexada no R2
              </a>
            )}
          </div>

          {/* Integration with SGSST NC */}
          {!plano.nao_conformidade_sgsst_id ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-amber-900">Converter em Não Conformidade do SGSST</div>
                <div className="text-[11px] text-amber-700">Envia a ação para o módulo central de Não Conformidades mantendo a rastreabilidade.</div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={handleConvertNc} className="gap-1 text-xs border-amber-300 text-amber-900 hover:bg-amber-100">
                <AlertOctagon className="h-3.5 w-3.5" /> Converter
              </Button>
            </div>
          ) : (
            <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 font-semibold text-xs">
              ✓ Vinculado a Não Conformidade do SGSST
            </Badge>
          )}

          <DialogFooter className="pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updatePlanoAcao.isPending}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
