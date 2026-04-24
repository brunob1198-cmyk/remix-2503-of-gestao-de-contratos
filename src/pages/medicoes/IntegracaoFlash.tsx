import { useState } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function IntegracaoFlashPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = role === "admin";

  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [lastResult, setLastResult] = useState<any>(null);

  // Buscar logs de integração
  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["flash_integration_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flash_integration_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Contar registros sincronizados
  const { data: totalRegistros = 0 } = useQuery({
    queryKey: ["flash_transactions_raw_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("flash_transactions_raw")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Helper: extrai o JSON real do erro retornado pela edge function
  // O supabase-js empacota o body em error.context (Response), precisa ler como texto e fazer parse.
  const parseEdgeError = async (error: any, fallbackMsg: string) => {
    let payload: any = {};
    try {
      const ctx = error?.context;
      if (ctx && typeof ctx.text === "function") {
        const txt = await ctx.text();
        try { payload = JSON.parse(txt); } catch { payload = { error: txt }; }
      } else if (ctx?.body && typeof ctx.body === "string") {
        try { payload = JSON.parse(ctx.body); } catch { payload = { error: ctx.body }; }
      } else if (ctx?.body && typeof ctx.body === "object") {
        payload = ctx.body;
      }
    } catch (e) {
      // ignora
    }
    const err = new Error(payload.error || error?.message || fallbackMsg);
    (err as any).status = payload.status ?? error?.status;
    (err as any).hint = payload.hint;
    (err as any).raw = payload;
    return err;
  };

  const testMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("flash-sync", {
        body: { action: "test" },
      });

      if (error) {
        throw await parseEdgeError(error, "Erro ao testar conexão");
      }

      if (data?.success === false) {
        const err = new Error(data.error || "Erro ao testar conexão");
        (err as any).status = data.status;
        (err as any).hint = data.hint;
        throw err;
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Conexão OK",
        description: data.message || "A API da Flash respondeu corretamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Falha na conexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const authProbeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("flash-sync", {
        body: { action: "test-auth" },
      });
      if (error) throw await parseEdgeError(error, "Erro ao sondar autenticação");
      return data;
    },
    onSuccess: (data) => {
      setLastResult({ authProbe: data });
      toast({
        title: data.winner ? "Variação encontrada!" : "Nenhuma variação funcionou",
        description: data.winner ? `✅ ${data.winner}` : "Veja os detalhes abaixo de cada tentativa.",
        variant: data.winner ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!startDate || !endDate) {
        throw new Error("Selecione as datas de início e fim");
      }
      if (startDate > endDate) {
        throw new Error("Data de início deve ser anterior à data de fim");
      }

      const { data, error } = await supabase.functions.invoke("flash-sync", {
        body: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
        },
      });

      if (error) {
        throw await parseEdgeError(error, "Erro na sincronização");
      }

      if (data?.success === false) {
        const err = new Error(data.error || "Erro na sincronização");
        (err as any).status = data.status;
        (err as any).hint = data.hint;
        throw err;
      }
      return data;
    },
    onSuccess: (data) => {
      setLastResult(data);
      toast({
        title: "Sincronização concluída",
        description: `${data?.totalProcessed || 0} transações processadas em ${data?.duracao_ms || 0}ms`,
      });
      queryClient.invalidateQueries({ queryKey: ["flash_integration_logs"] });
      queryClient.invalidateQueries({ queryKey: ["flash_transactions_raw_count"] });
    },
    onError: (error: any) => {
      setLastResult({ 
        error: error.message, 
        status: error.status,
        hint: error.hint 
      });
      toast({
        title: "Erro na sincronização",
        description: error.message || "Falha ao chamar a API da Flash",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["flash_integration_logs"] });
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "sucesso":
        return <Badge variant="secondary" className="bg-primary/10 text-primary gap-1"><CheckCircle2 className="h-3 w-3" /> Sucesso</Badge>;
      case "erro":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erro</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Acesso negado</AlertTitle>
          <AlertDescription>
            Apenas administradores podem acessar a Integração Flash.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Integração Flash</h1>
          <p className="text-sm text-muted-foreground">
            Sincronização de transações da API Flash
          </p>
        </div>
      </div>

      {/* Status geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total sincronizado</CardDescription>
            <CardTitle className="text-3xl">{totalRegistros}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">transações brutas armazenadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Última execução</CardDescription>
            <CardTitle className="text-lg">
              {logs[0] ? format(new Date(logs[0].created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs[0] && statusBadge(logs[0].status)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status do token</CardDescription>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Configurado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">FLASH_API_TOKEN ativo</p>
          </CardContent>
        </Card>
      </div>

      {/* Sincronização */}
      <Card>
        <CardHeader>
          <CardTitle>Sincronizar Transações</CardTitle>
          <CardDescription>
            Selecione o período desejado e dispare a importação das transações via Flash API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data de Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Atalhos rápidos */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate(subDays(new Date(), 7));
                setEndDate(new Date());
              }}
            >
              Últimos 7 dias
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate(subDays(new Date(), 30));
                setEndDate(new Date());
              }}
            >
              Últimos 30 dias
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate(subDays(new Date(), 90));
                setEndDate(new Date());
              }}
            >
              Últimos 90 dias
            </Button>
          </div>

          {/* Botão de sincronização */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || syncMutation.isPending || authProbeMutation.isPending}
              className="gap-2"
            >
              {testMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  Validar Token
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => authProbeMutation.mutate()}
              disabled={authProbeMutation.isPending || syncMutation.isPending || testMutation.isPending}
              className="gap-2"
              title="Tenta múltiplos formatos de autenticação (Bearer, apikey, x-api-key, raw, Basic, Token) e mostra qual funciona"
            >
              {authProbeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sondando auth...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Testar Variações de Auth
                </>
              )}
            </Button>
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !startDate || !endDate}
              className="gap-2"
            >
              {syncMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sincronizar Flash
                </>
              )}
            </Button>
          </div>

          {/* Progresso da sincronização */}
          {syncMutation.isPending && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importando transações...</span>
                <span className="text-muted-foreground">Aguarde</span>
              </div>
              <Progress value={undefined} className="h-2" />
            </div>
          )}

          {/* Resultado da sondagem de autenticação */}
          {lastResult?.authProbe && !authProbeMutation.isPending && (
            <Alert variant={lastResult.authProbe.winner ? "default" : "destructive"}>
              <AlertTitle className="flex items-center gap-2">
                {lastResult.authProbe.winner ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                Sondagem de Autenticação
              </AlertTitle>
              <AlertDescription className="mt-2 space-y-3">
                <p className="font-semibold whitespace-pre-wrap break-words">
                  {lastResult.authProbe.message}
                </p>
                <div className="text-xs space-y-1 opacity-80">
                  <p><strong>URL:</strong> <code className="break-all">{lastResult.authProbe.url}</code></p>
                  <p><strong>Token:</strong> <code>{lastResult.authProbe.token_preview}</code></p>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {lastResult.authProbe.attempts?.map((a: any, i: number) => (
                    <div key={i} className="border border-border/40 rounded-md p-2 bg-background/40 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono font-semibold">{a.variant}</span>
                        <Badge variant={a.ok ? "secondary" : "destructive"}>
                          {a.status ? `HTTP ${a.status}` : "ERR"}
                        </Badge>
                      </div>
                      {a.body_preview && (
                        <pre className="whitespace-pre-wrap break-all opacity-70 mt-1">{a.body_preview}</pre>
                      )}
                      {a.error && <p className="text-destructive">{a.error}</p>}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Resultado da última execução */}
          {lastResult && !lastResult.authProbe && !syncMutation.isPending && (
            <Alert variant={lastResult.error ? "destructive" : "default"}>
              <AlertTitle className="flex items-center gap-2">
                {lastResult.error ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {lastResult.error ? "Falha na sincronização" : "Sincronização concluída"}
                {lastResult.status && (
                  <Badge variant="destructive" className="ml-2">HTTP {lastResult.status}</Badge>
                )}
              </AlertTitle>
              <AlertDescription className="mt-2">
                {lastResult.error ? (
                  <div className="space-y-3">
                    <p className="font-semibold whitespace-pre-wrap break-words">
                      {lastResult.error}
                    </p>
                    {lastResult.hint && (
                      <p className="text-xs opacity-80 italic whitespace-pre-wrap break-words">
                        💡 {lastResult.hint}
                      </p>
                    )}
                    {lastResult.status === 403 && (
                      <div className="bg-destructive/10 p-3 rounded-md text-sm border border-destructive/20">
                        <p className="font-bold mb-2">Como corrigir o erro 403 (Acesso Negado):</p>
                        <ul className="list-disc list-inside space-y-1 opacity-90">
                          <li>Acesse o painel da Flash (RH/Financeiro).</li>
                          <li>Vá em Configurações &gt; Desenvolvedores / API.</li>
                          <li>Confirme que o token possui permissão para <strong>Leitura de Transações</strong> (Business API).</li>
                          <li>Verifique se o token não expirou.</li>
                          <li>Gere um novo token e atualize o secret <code className="bg-background/50 px-1 rounded">FLASH_API_TOKEN</code>.</li>
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1 text-sm">
                    <p><strong>Transações processadas:</strong> {lastResult.totalProcessed || 0}</p>
                    <p><strong>Páginas consumidas:</strong> {lastResult.pages || 1}</p>
                    <p><strong>Tempo total:</strong> {lastResult.duracao_ms || 0}ms</p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Histórico de logs */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Execuções</CardTitle>
          <CardDescription>Últimas 20 sincronizações</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma sincronização registrada ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm font-mono">{log.evento}</TableCell>
                      <TableCell>{statusBadge(log.status)}</TableCell>
                      <TableCell className="text-sm">
                        {log.http_status ? (
                          <Badge variant={log.http_status < 400 ? "secondary" : "destructive"}>
                            {log.http_status}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.duracao_ms ? `${log.duracao_ms}ms` : "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-md">
                        {log.erro ? (
                          <span
                            className="text-destructive whitespace-pre-wrap break-words block"
                            title={log.erro}
                          >
                            {log.erro}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {(log.request as any)?.startDate} → {(log.request as any)?.endDate}
                          </span>
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
