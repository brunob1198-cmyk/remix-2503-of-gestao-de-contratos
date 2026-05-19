import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { migrateTableRecords, MigrationLog } from "@/utils/storageMigration";
import { Loader2, Play, CheckCircle2, AlertCircle, SkipForward, Search } from "lucide-react";
import { toast } from "sonner";

const TABLES_CONFIG = [
  { name: "contratos", id: "id", columns: ["arquivo_url"], label: "Contratos" },
  { name: "diario_fotos", id: "id", columns: ["url", "thumb_url", "thumb_600_url"], label: "Diário de Obras (Fotos)" },
  { name: "diario_campo_fotos", id: "id", columns: ["url", "thumb_url", "thumb_600_url"], label: "Diário de Campo (Fotos)" },
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
  };

  const runMigration = async () => {
    if (isMigrating) return;
    
    setIsMigrating(true);
    setLogs([]);
    setProgress(0);

    try {
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

          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.success}</div>
                <div className="text-xs text-muted-foreground">Migrados</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.verified}</div>
                <div className="text-xs text-muted-foreground">Já no R2 (OK)</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.skipped}</div>
                <div className="text-xs text-muted-foreground">Ignorados</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 dark:bg-red-950/20">
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-red-600">{stats.error}</div>
                <div className="text-xs text-muted-foreground">Erros</div>
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
                        {log.status === 'success' && <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Migrado</Badge>}
                        {log.status === 'verified' && <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200"><Search className="h-3 w-3 mr-1" /> OK</Badge>}
                        {log.status === 'skipped' && <Badge variant="secondary" className="bg-gray-100"><SkipForward className="h-3 w-3 mr-1" /> Ignorado</Badge>}
                        {log.status === 'error' && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Erro</Badge>}
                      </TableCell>
                      <TableCell className="font-medium">{log.tableName}</TableCell>
                      <TableCell className="text-xs">{log.columnName}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate" title={log.message || log.oldValue}>
                        {log.message || log.oldValue}
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
