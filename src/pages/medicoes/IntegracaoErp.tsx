import { useState, useEffect } from "react";
import { useErpConfig, useErpLogs, useErpSend } from "@/hooks/useErpIntegration";
import { useContaAzulConnection } from "@/hooks/useAnaliseCustos";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings, Plus, RefreshCw, Trash2, Download, Webhook, CheckCircle2, XCircle, Clock, Link2, Unlink, CloudOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { useSearchParams } from "react-router-dom";

export default function IntegracaoErpPage() {
  const { role } = useAuth();
  const { configs, isLoading: loadingConfig, createConfig, updateConfig, deleteConfig } = useErpConfig();
  const { data: logs = [], isLoading: loadingLogs } = useErpLogs();
  const { retry } = useErpSend();
  const { isConnected, isExpired, loadingStatus, getAuthUrl, exchangeCode, refreshToken, disconnect } = useContaAzulConnection();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ nome: "ERP Principal", webhook_url: "", auth_token: "", auth_type: "bearer" });
  const [searchParams, setSearchParams] = useSearchParams();

  const isAdmin = role === "admin";

  const [processingCallback, setProcessingCallback] = useState(false);

  // Processar callback OAuth do Conta Azul
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (code && !processingCallback) {
      setProcessingCallback(true);
      console.log("OAuth callback recebido - code:", code.substring(0, 8) + "...", "state:", state);
      // Limpar params da URL imediatamente para evitar reuso
      setSearchParams({}, { replace: true });
      exchangeCode.mutate(code, {
        onSettled: () => setProcessingCallback(false),
      });
    }
  }, [searchParams]);

  const handleCreate = () => {
    createConfig.mutate(formData, {
      onSuccess: () => {
        setShowForm(false);
        setFormData({ nome: "ERP Principal", webhook_url: "", auth_token: "", auth_type: "bearer" });
      },
    });
  };


  const statusBadge = (status: string) => {
    switch (status) {
      case "enviado": return <Badge variant="secondary" className="bg-primary/10 text-primary gap-1"><CheckCircle2 className="h-3 w-3" /> Enviado</Badge>;
      case "erro": return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erro</Badge>;
      default: return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
    }
  };

  const exportLogs = () => {
    const data = logs.map((l) => ({
      Data: format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      Evento: l.evento,
      Status: l.status,
      Tentativas: l.tentativas,
      Erro: l.erro || "",
      Obra: (l.payload as any)?.obra || "",
      Cliente: (l.payload as any)?.cliente || "",
      Valor: (l.payload as any)?.valor || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs ERP");
    XLSX.writeFile(wb, `logs_erp_${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Integração ERP</h2>
          <p className="text-muted-foreground">Configure a integração com o Conta Azul e webhooks para ERP financeiro</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportLogs} disabled={logs.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar Logs
          </Button>
          {isAdmin && (
            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Nova Integração</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Configurar Integração ERP</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>URL do Webhook *</Label>
                    <Input value={formData.webhook_url} onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })} placeholder="https://erp.exemplo.com/api/webhook" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Autenticação</Label>
                    <Select value={formData.auth_type} onValueChange={(v) => setFormData({ ...formData, auth_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bearer">Bearer Token</SelectItem>
                        <SelectItem value="api-key">API Key</SelectItem>
                        <SelectItem value="basic">Basic Auth</SelectItem>
                        <SelectItem value="none">Sem autenticação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.auth_type !== "none" && (
                    <div className="space-y-2">
                      <Label>Token / Chave</Label>
                      <Input type="password" value={formData.auth_token} onChange={(e) => setFormData({ ...formData, auth_token: e.target.value })} />
                    </div>
                  )}
                  <Button onClick={handleCreate} className="w-full" disabled={!formData.webhook_url || createConfig.isPending}>
                    {createConfig.isPending ? "Salvando..." : "Salvar Configuração"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Conta Azul Connection Card */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">CA</span>
              </div>
              <div>
                <CardTitle className="text-lg">Conta Azul</CardTitle>
                <CardDescription>Integração direta via API OAuth2</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {loadingStatus ? (
                <Badge variant="secondary" className="gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Verificando...
                </Badge>
              ) : isConnected ? (
                <Badge variant="secondary" className={`gap-1 ${isExpired ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}>
                  {isExpired ? (
                    <><CloudOff className="h-3 w-3" /> Token expirado</>
                  ) : (
                    <><CheckCircle2 className="h-3 w-3" /> Conectado</>
                  )}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <Unlink className="h-3 w-3" /> Desconectado
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {isConnected && !isExpired
                ? "A integração está ativa. As despesas serão sincronizadas diretamente da API."
                : isConnected && isExpired
                ? "O token expirou. Reconecte para continuar sincronizando."
                : "Conecte sua conta do Conta Azul para sincronizar dados financeiros automaticamente."}
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              {isConnected ? (
                <>
                  {isExpired && (
                    <Button
                      variant="outline"
                      onClick={() => refreshToken.mutate(undefined)}
                      disabled={refreshToken.isPending}
                      className="gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${refreshToken.isPending ? "animate-spin" : ""}`} />
                      {refreshToken.isPending ? "Renovando..." : "Renovar token"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => disconnect.mutate()}
                    disabled={disconnect.isPending}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Unlink className="h-4 w-4" />
                    Desconectar
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => getAuthUrl.mutate()}
                  disabled={getAuthUrl.isPending || exchangeCode.isPending || processingCallback}
                  className="gap-2"
                >
                  {getAuthUrl.isPending || exchangeCode.isPending || processingCallback ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {processingCallback ? "Conectando..." : "Redirecionando..."}
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                      Conectar Conta Azul
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {configs.map((config) => (
          <Card key={config.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{config.nome}</CardTitle>
                </div>
                {isAdmin && (
                  <Switch
                    checked={config.ativo}
                    onCheckedChange={(ativo) => updateConfig.mutate({ id: config.id, ativo })}
                  />
                )}
              </div>
              <CardDescription className="truncate text-xs">{config.webhook_url}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground capitalize">{config.auth_type}</span>
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => deleteConfig.mutate(config.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {configs.length === 0 && !loadingConfig && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Settings className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Nenhuma integração webhook configurada</p>
              {isAdmin && <p className="text-sm text-muted-foreground">Clique em "Nova Integração" para configurar webhooks</p>}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Log de Envios</CardTitle>
          <CardDescription>Histórico de envios ao ERP com status e detalhes</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum envio registrado</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.evento}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{(log.payload as any)?.obra || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {(log.payload as any)?.valor
                          ? `R$ ${Number((log.payload as any).valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                      <TableCell>{statusBadge(log.status)}</TableCell>
                      <TableCell className="text-center">{log.tentativas}</TableCell>
                      <TableCell>
                        {log.status === "erro" && (
                          <Button variant="ghost" size="sm" onClick={() => retry.mutate(log.id)} disabled={retry.isPending}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
