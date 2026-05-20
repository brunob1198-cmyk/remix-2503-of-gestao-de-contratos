import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { migrateTableRecords, MigrationLog, buildStorageIndex } from "@/utils/storageMigration";
import { Loader2, Play, CheckCircle2, AlertCircle, SkipForward, Search } from "lucide-react";
import { toast } from "sonner";

const TABLES_CONFIG = [
  { name: "contratos", id: "id", columns: ["arquivo_url"], label: "Contratos" },
  { name: "diario_fotos", id: "id", columns: ["url", "thumb_url", "thumb_600_url"], label: "Diário de Obras (Fotos)" },
  { name: "diario_campo_fotos", id: "id", columns: ["url", "thumb_url"], label: "Diário de Campo (Fotos)" },
  { name: "profiles", id: "id", columns: ["avatar_url"], label: "Perfis (Avatares)" },
  { name: "lancamentos_medicao", id: "id", columns: ["logo_empresa_url", "capa_url"], label: "Lançamentos de Medição" },
  { name: "empresas", id: "id", columns: ["logo_url"], label: "Empresas (Logos)" },
  { name: "clientes", id: "id", columns: ["logo_url"], label: "Clientes (Logos)" },
  { name: "medicao_exports", id: "id", columns: ["storage_path"], label: "Exportações de Medição" },
];

const StorageMigrationPage = () => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [currentTable, setCurrentTable] = useState<string>("");
  const [progress, setProgress] = useState(0);

  const stats = {
    success: logs.filter(l => l.status === 'success').length,
    error: logs.filter(l => l.status === 'error').length,
    skipped: logs.filter(l => l.status === 'skipped').length,
    verified: logs.filter(l => l.status === 'verified').length,
    reconciled: logs.filter(l => l.status === 'success' && l.matchType && l.matchType !== 'exact' && l.matchType !== 'parser').length,
  };

  const runMigration = async () => {
    if (isMigrating) return;
    
    setIsMigrating(true);
    setLogs([]);
    setProgress(0);

    try {
      setCurrentTable("Escaneando Storage...");
      await buildStorageIndex();
      
      for (let i = 0; i < TABLES_CONFIG.length; i++) {
        const config = TABLES_CONFIG[i];
        setCurrentTable(config.name);
        setProgress(Math.round(((i) / TABLES_CONFIG.length) * 100));
        
        await migrateTableRecords(
          config.name,
          config.id,
          config.columns,
          (log) => {
            setLogs(prev => [log, ...prev].slice(0, 200));
          }
        );
      }
      
      setProgress(100);
      toast.success("Migração concluída!");
    } catch (error: any) {
      console.error("Erro na migração:", error);
      toast.error("Erro durante a migração: " + error.message);
    } finally {
      setIsMigrating(false);
      setCurrentTable("");
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Migração de Arquivos: Supabase ➔ R2</CardTitle>
              <CardDescription>
                Transfere fisicamente os arquivos do Supabase Storage para o Cloudflare R2 e atualiza as referências no banco de dados.
              </CardDescription>
            </div>
            <Button 
              onClick={runMigration} 
              disabled={isMigrating}
              className="gap-2"
            >
              {isMigrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isMigrating ? "Migrando..." : "Iniciar Migração Full"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isMigrating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processando: <strong>{TABLES_CONFIG.find(t => t.name === currentTable)?.label || currentTable}</strong></span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-4 text-center p-2 md:p-4">
                <div className="text-2xl font-bold text-green-600">{stats.success}</div>
                <div className="text-xs text-muted-foreground">Migrados</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200">
              <CardContent className="pt-4 text-center p-2 md:p-4">
                <div className="text-2xl font-bold text-purple-600">{stats.reconciled}</div>
                <div className="text-xs text-muted-foreground">Reconciliados ✨</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="pt-4 text-center p-2 md:p-4">
                <div className="text-2xl font-bold text-blue-600">{stats.verified}</div>
                <div className="text-xs text-muted-foreground">No R2 (OK)</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="pt-4 text-center p-2 md:p-4">
                <div className="text-2xl font-bold text-yellow-600">{stats.skipped}</div>
                <div className="text-xs text-muted-foreground">Ignorados</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 dark:bg-red-950/20">
              <CardContent className="pt-4 text-center p-2 md:p-4">
                <div className="text-2xl font-bold text-red-600">{stats.error}</div>
                <div className="text-xs text-muted-foreground">Erros</div>
              </CardContent>
            </Card>
            <Card className="bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200">
              <CardContent className="pt-4 text-center p-2 md:p-4">
                <div className="text-2xl font-bold text-indigo-600">
                  {stats.success + stats.verified + stats.reconciled}
                </div>
                <div className="text-xs text-muted-foreground text-indigo-600 font-medium">Total Online ✅</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Diagnóstico de Buckets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs space-y-1">
                  {Array.from(new Set(logs.map(l => l.tableName))).map(table => {
                    const tableLogs = logs.filter(l => l.tableName === table);
                    const errs = tableLogs.filter(l => l.status === 'error').length;
                    return (
                      <div key={table} className="flex justify-between items-center py-1 border-b last:border-0">
                        <span>{TABLES_CONFIG.find(t => t.name === table)?.label || table}</span>
                        <div className="flex gap-2">
                          {errs > 0 && <Badge variant="destructive" className="text-[10px]">{errs} erros</Badge>}
                          <Badge variant="outline" className="text-[10px]">{tableLogs.length} total</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Origens de Caminhos Quebrados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs space-y-1">
                   {(() => {
                     const paths = logs.filter(l => l.status === 'skipped' || l.status === 'error').map(l => {
                       if (l.oldValue?.includes('/thumbs/')) return 'Thumbnails legadas';
                       if (l.oldValue?.includes('/600/') || l.oldValue?.includes('/medium/')) return 'Arquivos redimensionados';
                       if (!l.oldValue?.includes('/')) return 'Apenas nome de arquivo (sem path)';
                       return 'Caminho incompleto/inválido';
                     });
                     const counts = paths.reduce((acc, p) => ({...acc, [p]: (acc[p] || 0) + 1}), {} as Record<string, number>);
                     return Object.entries(counts).sort((a,b) => b[1] - a[1]).map(([p, count]) => (
                       <div key={p} className="flex justify-between items-center py-1 border-b last:border-0">
                         <span>{p}</span>
                         <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                       </div>
                     ));
                   })()}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="border rounded-md">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 && !isMigrating && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhum log de migração disponível. Inicie o processo para ver resultados.
                      </TableCell>
                    </TableRow>
                  )}
                  {logs.map((log, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {log.status === 'success' && <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Migrado</Badge>}
                          {log.status === 'verified' && <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200"><Search className="h-3 w-3 mr-1" /> OK</Badge>}
                          {log.status === 'skipped' && <Badge variant="secondary" className="bg-gray-100"><SkipForward className="h-3 w-3 mr-1" /> Ignorado</Badge>}
                          {log.status === 'error' && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Erro</Badge>}
                          
                          {log.matchType && log.matchType !== 'exact' && log.matchType !== 'parser' && log.matchType !== 'verified' && (
                            <Badge variant="outline" className="text-purple-600 bg-purple-50 border-purple-200 text-[10px] py-0">
                              Reconciliado: {log.matchType}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{log.tableName}</TableCell>
                      <TableCell className="text-xs">{log.columnName}</TableCell>
                      <TableCell className="text-xs max-w-xs break-all" title={log.message || log.oldValue}>
                        <div className="font-semibold text-red-500">{log.status === 'error' ? log.message : ''}</div>
                        <div className="opacity-70">{log.oldValue}</div>
                        {log.status === 'success' && <div className="text-[10px] text-green-600 mt-1 truncate">{log.message}</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StorageMigrationPage;
