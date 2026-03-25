import { LancamentoForm } from "@/components/medicoes/LancamentoForm";
import { LancamentosTable } from "@/components/medicoes/LancamentosTable";
import { GerarMedicaoDiario } from "@/components/medicoes/GerarMedicaoDiario";
import { useLancamentosMedicao } from "@/hooks/useLancamentos";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, HardHat, ClipboardList } from "lucide-react";
import { exportLancamentosToExcel } from "@/lib/medicoesExport";

export default function MedicaoPage() {
  const { lancamentos, isLoading, createLancamento, bulkCreateLancamento, deleteLancamento } = useLancamentosMedicao();

  const handleSubmit = (data: any) => {
    createLancamento.mutate(data);
  };

  const handleBulkSubmit = (data: any[]) => {
    bulkCreateLancamento.mutate(data);
  };

  const handleGenerateFromDiario = (items: any[]) => {
    bulkCreateLancamento.mutate(items);
  };

  const handleExport = () => {
    exportLancamentosToExcel(lancamentos, "medicao");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Lançamento de Medição</h1>
          <p className="text-muted-foreground">Registre as medições aprovadas pelo cliente</p>
        </div>
        {lancamentos.length > 0 && (
          <Button variant="outline" onClick={handleExport}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        )}
      </div>

      <Tabs defaultValue="diario" className="space-y-4">
        <TabsList>
          <TabsTrigger value="diario" className="flex items-center gap-2">
            <HardHat className="h-4 w-4" />
            Gerar do Diário
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Lançamento Manual / Excel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diario">
          <GerarMedicaoDiario
            onGenerate={handleGenerateFromDiario}
            isLoading={bulkCreateLancamento.isPending}
          />
        </TabsContent>

        <TabsContent value="manual">
          <LancamentoForm
            tipo="medicao"
            onSubmit={handleSubmit}
            onBulkSubmit={handleBulkSubmit}
            isLoading={createLancamento.isPending || bulkCreateLancamento.isPending}
          />
        </TabsContent>
      </Tabs>

      <LancamentosTable
        titulo="Lançamentos de Medição"
        lancamentos={lancamentos}
        tipo="medicao"
        isLoading={isLoading}
        onDelete={(id) => deleteLancamento.mutate(id)}
      />
    </div>
  );
}
