import { LancamentoForm } from "@/components/medicoes/LancamentoForm";
import { LancamentosTable } from "@/components/medicoes/LancamentosTable";
import { useLancamentosProducao } from "@/hooks/useLancamentos";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { exportLancamentosToExcel } from "@/lib/medicoesExport";

export default function ProducaoPage() {
  const { lancamentos, isLoading, createLancamento, bulkCreateLancamento, deleteLancamento, bulkDeleteLancamento } = useLancamentosProducao();

  const handleSubmit = (data: any) => {
    createLancamento.mutate(data);
  };

  const handleBulkSubmit = (data: any[]) => {
    bulkCreateLancamento.mutate(data);
  };

  const handleExport = () => {
    exportLancamentosToExcel(lancamentos, "producao");
  };

  const handleBulkDelete = (ids: string[]) => {
    bulkDeleteLancamento.mutate(ids);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Lançamento de Produção</h1>
          <p className="text-muted-foreground">Registre a produção executada em campo</p>
        </div>
        {lancamentos.length > 0 && (
          <Button variant="outline" onClick={handleExport}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        )}
      </div>

      <LancamentoForm 
        tipo="producao" 
        onSubmit={handleSubmit} 
        onBulkSubmit={handleBulkSubmit}
        isLoading={createLancamento.isPending || bulkCreateLancamento.isPending} 
      />

      <LancamentosTable
        titulo="Lançamentos de Produção"
        lancamentos={lancamentos}
        tipo="producao"
        isLoading={isLoading}
        onDelete={(id) => deleteLancamento.mutate(id)}
        onBulkDelete={handleBulkDelete}
      />
    </div>
  );
}
