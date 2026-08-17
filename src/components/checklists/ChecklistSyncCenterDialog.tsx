import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useChecklistsOffline } from "@/hooks/checklists/useChecklistsOffline";
import { RefreshCw, Wifi, WifiOff, CheckCircle2, AlertTriangle, Clock, Layers, HardDrive } from "lucide-react";

interface ChecklistSyncCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChecklistSyncCenterDialog({ open, onOpenChange }: ChecklistSyncCenterDialogProps) {
  const { stats, offlineApplications, pendingQueue, triggerManualSync } = useChecklistsOffline();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <HardDrive className="h-5 w-5 text-primary" />
            Central de Sincronização & Armazenamento Offline
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2 text-xs">
          {/* STATS DASHBOARD */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-amber-50/50 border-amber-200">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-[11px] font-semibold text-amber-800">PENDENTES SYNC</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-amber-700">{stats.pendingCount}</div>
              </CardContent>
            </Card>

            <Card className="bg-emerald-50/50 border-emerald-200">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-[11px] font-semibold text-emerald-800">SINCRONIZADOS</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-emerald-700">{stats.syncedCount}</div>
              </CardContent>
            </Card>

            <Card className="bg-red-50/50 border-red-200">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-[11px] font-semibold text-red-800">COM ERRO</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-red-700">{stats.errorCount}</div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50/50 border-blue-200">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-[11px] font-semibold text-blue-800">MODELOS OFFLINE</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-blue-700">{stats.localModelsCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* ACTION BUTTON */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-lg">
            <div className="text-slate-700">
              <span className="font-bold">Fila de Transmissão para Supabase & Cloudflare R2</span>
              <p className="text-[11px] text-muted-foreground pt-0.5">
                Os dados salvos no IndexedDB são transmitidos automaticamente assim que a conexão é estabelecida.
              </p>
            </div>

            <Button
              onClick={triggerManualSync}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 text-xs"
            >
              <RefreshCw className="h-4 w-4" /> Sincronizar Agora
            </Button>
          </div>

          {/* FILA DE APLICAÇÕES PENDENTES */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs text-slate-800">Aplicações e Rascunhos no Dispositivo</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-bold">Checklist Modelo</TableHead>
                    <TableHead className="text-xs font-bold">ID Local</TableHead>
                    <TableHead className="text-xs font-bold">Execução</TableHead>
                    <TableHead className="text-xs font-bold">Status Sync</TableHead>
                    <TableHead className="text-xs font-bold">Último AutoSave</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offlineApplications.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nenhuma aplicação armazenada localmente.</TableCell></TableRow>
                  ) : (
                    offlineApplications.map((app) => (
                      <TableRow key={app.local_application_id}>
                        <TableCell className="font-bold text-xs text-slate-800">{app.modelo_nome}</TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-600 truncate max-w-[120px]">
                          {app.local_application_id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {app.origem_execucao}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {app.sync_status === "SINCRONIZADO" ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold">SINCRONIZADO</Badge>
                          ) : app.sync_status === "PENDENTE_SINCRONIZACAO" ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-bold">PENDENTE SYNC</Badge>
                          ) : app.sync_status === "ERRO_SINCRONIZACAO" ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 font-bold">ERRO SYNC</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 font-bold">RASCUNHO LOCAL</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {app.auto_saved_at ? new Date(app.auto_saved_at).toLocaleString("pt-BR") : "—"}
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
