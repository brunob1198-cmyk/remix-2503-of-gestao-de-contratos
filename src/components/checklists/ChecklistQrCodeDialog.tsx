import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChecklistModelo } from "@/hooks/checklists/useChecklists";
import { useChecklistQRCodes } from "@/hooks/checklists/useChecklistsEvolution";
import { generateQRCodeDataUrl } from "@/utils/qrCodeGenerator";
import { QRVinculadoTipo } from "@/types/checklistsEvolution";
import { QrCode, Copy, Download, Power, Plus, ExternalLink, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface ChecklistQrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelo: ChecklistModelo | null;
}

export function ChecklistQrCodeDialog({ open, onOpenChange, modelo }: ChecklistQrCodeDialogProps) {
  const { qrcodes, isLoading, createQRCode, toggleQRCodeAtivo } = useChecklistQRCodes(modelo?.id);

  const [vinculadoTipo, setVinculadoTipo] = useState<QRVinculadoTipo>("area");
  const [vinculadoNome, setVinculadoNome] = useState("");
  const [selectedQrImage, setSelectedQrImage] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(null);

  useEffect(() => {
    if (modelo && open) {
      setVinculadoTipo("area");
      setVinculadoNome("");
      setSelectedQrImage(null);
      setActiveToken(null);
    }
  }, [modelo, open]);

  if (!modelo) return null;

  const handleGenerate = async () => {
    try {
      const res = await createQRCode.mutateAsync({
        checklist_modelo_id: modelo.id,
        vinculado_tipo: vinculadoTipo,
        vinculado_nome: vinculadoNome.trim() || `Vínculo de ${vinculadoTipo}`,
      });

      const startUrl = `${window.location.origin}/checklists/iniciar/${res.token}`;
      const img = await generateQRCodeDataUrl(startUrl);
      setSelectedQrImage(img);
      setActiveToken(res.token);
    } catch (err: any) {
      // Handled in hook
    }
  };

  const handleSelectQrForView = async (token: string) => {
    const startUrl = `${window.location.origin}/checklists/iniciar/${token}`;
    const img = await generateQRCodeDataUrl(startUrl);
    setSelectedQrImage(img);
    setActiveToken(token);
  };

  const handleCopyLink = (token: string) => {
    const startUrl = `${window.location.origin}/checklists/iniciar/${token}`;
    navigator.clipboard.writeText(startUrl);
    toast.success("Link do QR Code copiado para a área de transferência!");
  };

  const handleDownloadImage = () => {
    if (!selectedQrImage || !activeToken) return;
    const a = document.createElement("a");
    a.href = selectedQrImage;
    a.download = `qrcode_checklist_${modelo.codigo || "chk"}_${activeToken}.png`;
    a.click();
    toast.success("Imagem do QR Code baixada!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <QrCode className="h-5 w-5 text-primary" />
            Gerenciar QR Codes do Checklist: {modelo.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2 text-xs">
          {/* GERAR NOVO QR CODE */}
          <div className="p-4 bg-slate-50 border rounded-lg space-y-3">
            <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-emerald-600" /> Gerar Novo QR Code Contextual
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tipo de Vínculo de Campo</Label>
                <Select value={vinculadoTipo} onValueChange={(val: any) => setVinculadoTipo(val)}>
                  <SelectTrigger className="text-xs bg-white">
                    <SelectValue placeholder="Selecione o tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="projeto">Projeto / Obra</SelectItem>
                    <SelectItem value="area">Área / Local de Trabalho</SelectItem>
                    <SelectItem value="equipamento">Equipamento</SelectItem>
                    <SelectItem value="veiculo">Veículo / Frota</SelectItem>
                    <SelectItem value="maquina">Máquina</SelectItem>
                    <SelectItem value="ferramenta">Ferramenta</SelectItem>
                    <SelectItem value="outro">Outro Vínculo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Identificação do Objeto / Local</Label>
                <Input
                  placeholder="Ex: Escavadeira CAT-320, Canteiro Bloco B, Placa ABC-1234..."
                  value={vinculadoNome}
                  onChange={(e) => setVinculadoNome(e.target.value)}
                  className="bg-white text-xs"
                />
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={createQRCode.isPending}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 text-xs"
            >
              {createQRCode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              {createQRCode.isPending ? "Gerando..." : "Gerar QR Code Seguro"}
            </Button>
          </div>

          {/* VISUALIZADOR DE QR CODE */}
          {selectedQrImage && activeToken && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <img src={selectedQrImage} alt="QR Code" className="w-36 h-36 border p-2 bg-white rounded-lg shadow-sm" />
              <div className="space-y-2 flex-1">
                <Badge className="bg-emerald-600 text-white font-bold">QR CODE ATIVO</Badge>
                <div className="font-bold text-slate-800 text-sm">{modelo.nome}</div>
                <div className="text-xs font-mono text-slate-600">Token: {activeToken}</div>
                <p className="text-[11px] text-muted-foreground">
                  Escaneie pelo celular para abrir o preenchimento direto com geolocalização e contexto alocado.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={handleDownloadImage} className="gap-1 text-xs bg-white">
                    <Download className="h-3.5 w-3.5" /> Baixar Imagem
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleCopyLink(activeToken)} className="gap-1 text-xs bg-white">
                    <Copy className="h-3.5 w-3.5" /> Copiar Link
                  </Button>
                  <a
                    href={`/checklists/iniciar/${activeToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded font-bold hover:bg-emerald-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Testar Acesso
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* LISTA DE QR CODES CADASTRADOS */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs text-slate-800">Histórico de QR Codes Registrados</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-bold">Vínculo</TableHead>
                    <TableHead className="text-xs font-bold">Token Seguro</TableHead>
                    <TableHead className="text-xs font-bold">Status</TableHead>
                    <TableHead className="text-xs font-bold">Data Criação</TableHead>
                    <TableHead className="text-xs font-bold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Carregando QR Codes...</TableCell></TableRow>
                  ) : qrcodes.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum QR Code gerado para este modelo.</TableCell></TableRow>
                  ) : (
                    qrcodes.map((qr) => (
                      <TableRow key={qr.id}>
                        <TableCell>
                          <span className="font-bold uppercase text-[11px] text-primary block">{qr.vinculado_tipo}</span>
                          <span className="text-slate-800">{qr.vinculado_nome || "—"}</span>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-600">{qr.token}</TableCell>
                        <TableCell>
                          {qr.ativo ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">ATIVO</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">DESATIVADO</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(qr.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSelectQrForView(qr.token)}
                              className="text-xs gap-1 text-primary"
                            >
                              <QrCode className="h-3.5 w-3.5" /> Ver
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleQRCodeAtivo.mutate({ id: qr.id, ativo: !qr.ativo })}
                              className={`text-xs gap-1 ${qr.ativo ? "text-red-600" : "text-emerald-600"}`}
                              title={qr.ativo ? "Desativar QR Code" : "Reativar QR Code"}
                            >
                              <Power className="h-3.5 w-3.5" />
                              {qr.ativo ? "Desativar" : "Ativar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
