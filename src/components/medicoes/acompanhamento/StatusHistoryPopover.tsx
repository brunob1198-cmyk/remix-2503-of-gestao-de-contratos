import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { History, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StatusHistoryPopoverProps {
  medicaoId: string;
  siteId: string;
  siteCodigo: string;
  numeroMedicao: string | null;
  dataResposta: string | null;
  formatDateTime: (dateStr: string) => string;
}

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-gray-500" },
  { value: "enviada", label: "Enviada", color: "bg-blue-500" },
  { value: "aprovado", label: "Aprovada", color: "bg-green-500" },
  { value: "rejeitado", label: "Rejeitada", color: "bg-red-500" },
  { value: "finalizado", label: "Finalizado", color: "bg-purple-500" },
];

export function getStatusBadge(status: string) {
  const statusOption = STATUS_OPTIONS.find(s => s.value === status);
  return (
    <Badge className={`${statusOption?.color || "bg-gray-500"} hover:${statusOption?.color || "bg-gray-600"}`}>
      {statusOption?.label || status}
    </Badge>
  );
}

export function StatusHistoryPopover({
  medicaoId,
  siteId,
  siteCodigo,
  numeroMedicao,
  dataResposta,
  formatDateTime
}: StatusHistoryPopoverProps) {
  const [open, setOpen] = useState(false);

  const { data: statusHistory = [] } = useQuery({
    queryKey: ["medicao_status_historico", medicaoId, open],
    queryFn: async () => {
      if (!open) return [];
      
      let query = supabase
        .from("medicao_status_historico")
        .select("*")
        .eq("site_id", siteId)
        .order("data_mudanca", { ascending: false });

      if (numeroMedicao) {
        query = query.eq("numero_medicao", numeroMedicao);
      } else {
        query = query.is("numero_medicao", null);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
    enabled: open,
  });

  return (
    <div className="flex items-center gap-1">
      <span className="text-sm">{dataResposta ? formatDateTime(dataResposta) : "-"}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Ver histórico de status">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-3 border-b">
            <p className="text-sm font-semibold">Histórico de Movimentações</p>
            <p className="text-xs text-muted-foreground">{siteCodigo} — {numeroMedicao || "s/n"}</p>
          </div>
          <div className="max-h-60 overflow-auto p-2">
            {statusHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2 text-center">Nenhuma movimentação registrada</p>
            ) : (
              <div className="space-y-2">
                {statusHistory.map((h: any) => (
                  <div key={h.id} className="flex items-start gap-2 text-xs border-b pb-2 last:border-b-0">
                    <Calendar className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium">{formatDateTime(h.data_mudanca)}</p>
                      <p className="text-muted-foreground">
                        {h.status_anterior ? (
                          <>{getStatusBadge(h.status_anterior)} → {getStatusBadge(h.status_novo)}</>
                        ) : (
                          <>Criado como {getStatusBadge(h.status_novo)}</>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
