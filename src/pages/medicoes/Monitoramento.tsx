import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, Database, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const cache = queryClient.getQueryCache();
      const allQueries = cache.getAll();
      
      const queryStats = allQueries.map(q => {
        const state = q.state;
        return {
          key: JSON.stringify(q.queryKey),
          status: state.status,
          fetchCount: state.fetchCount,
          lastUpdated: state.dataUpdatedAt,
          isStale: q.isStale(),
          observers: q.getObserversCount()
        };
      }).sort((a, b) => b.fetchCount - a.fetchCount);

      setStats(queryStats);
    }, 2000);

    return () => clearInterval(interval);
  }, [queryClient]);

  const totalFetches = stats.reduce((sum, s) => sum + s.fetchCount, 0);
  const activeQueries = stats.filter(s => s.observers > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Monitoramento Interno</h1>
          <p className="text-muted-foreground text-sm">Performance e volume de requisições em tempo real</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Fetches (Sessão)</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFetches}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queries Ativas</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeQueries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Total</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Queries (por volume)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query Key</TableHead>
                <TableHead>Fetches</TableHead>
                <TableHead>Observers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última Atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.slice(0, 15).map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-[10px] max-w-md truncate">
                    {s.key}
                  </TableCell>
                  <TableCell className="font-bold">{s.fetchCount}</TableCell>
                  <TableCell>{s.observers}</TableCell>
                  <TableCell>
                    <Badge variant={s.isStale ? "outline" : "default"} className="text-[10px]">
                      {s.isStale ? "Stale" : "Fresh"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.lastUpdated > 0 ? new Date(s.lastUpdated).toLocaleTimeString() : "N/A"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}