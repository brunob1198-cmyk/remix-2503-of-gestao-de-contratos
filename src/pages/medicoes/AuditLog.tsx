import { useState } from "react";
import { useAuditLog, getTabelaLabel, getOperacaoLabel } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { History, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TABELAS = [
  "sites", "projetos", "lancamentos_producao", "lancamentos_medicao",
  "lancamentos_faturamento", "diarios_obra", "diarios_campo", "escopo_itens",
  "itens_lpu", "contratos", "clientes", "recursos", "diario_producao",
  "diario_equipe", "diario_equipamentos", "diario_veiculos", "faturamentos", "faturamento_itens",
];

const operacaoColor: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  UPDATE: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function ChangedFieldsDetail({ entry }: { entry: any }) {
  const [open, setOpen] = useState(false);

  if (entry.operacao === "INSERT") {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Ver dados
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="text-[10px] bg-muted rounded p-2 mt-1 max-h-40 overflow-auto whitespace-pre-wrap">
            {JSON.stringify(entry.dados_novos, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  if (entry.operacao === "DELETE") {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Ver dados excluídos
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="text-[10px] bg-muted rounded p-2 mt-1 max-h-40 overflow-auto whitespace-pre-wrap">
            {JSON.stringify(entry.dados_anteriores, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // UPDATE
  const campos = entry.campos_alterados || [];
  if (campos.length === 0) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {campos.length} campo(s) alterado(s)
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-1">
          {campos.map((campo: string) => (
            <div key={campo} className="text-[11px] bg-muted rounded px-2 py-1">
              <span className="font-medium">{campo}:</span>{" "}
              <span className="text-red-600 line-through">
                {JSON.stringify(entry.dados_anteriores?.[campo]) ?? "—"}
              </span>{" "}
              →{" "}
              <span className="text-emerald-600 font-medium">
                {JSON.stringify(entry.dados_novos?.[campo]) ?? "—"}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function AuditLogPage() {
  const [tabela, setTabela] = useState<string>("");
  const { data: logs = [], isLoading } = useAuditLog({
    tabela: tabela || undefined,
    limit: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Log de Alterações</h1>
          <p className="text-muted-foreground text-sm">Histórico de quem alterou o quê no sistema</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-end gap-4">
            <div className="min-w-[250px]">
              <label className="text-sm font-medium mb-1 block">Filtrar por módulo</label>
              <Select value={tabela || "__all__"} onValueChange={v => setTabela(v === "__all__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os módulos</SelectItem>
                  {TABELAS.map(t => (
                    <SelectItem key={t} value={t}>{getTabelaLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="h-8">
              {logs.length} registro(s)
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <ScrollArea className="h-[calc(100vh-320px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Data/Hora</TableHead>
                <TableHead className="w-[140px]">Usuário</TableHead>
                <TableHead className="w-[100px]">Operação</TableHead>
                <TableHead className="w-[150px]">Módulo</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map(log => (
                  <TableRow key={log.id} className="align-top">
                    <TableCell className="text-xs tabular-nums">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.user_email || <span className="text-muted-foreground">Sistema</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${operacaoColor[log.operacao] || ""}`} variant="secondary">
                        {getOperacaoLabel(log.operacao)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {getTabelaLabel(log.tabela)}
                    </TableCell>
                    <TableCell>
                      <ChangedFieldsDetail entry={log} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    </div>
  );
}
