import { useState } from "react";
import { useContratos } from "@/hooks/useContratos";
import { useClientes } from "@/hooks/useClientes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ScrollText, Pencil, Trash2, AlertTriangle, CalendarCheck, CalendarX, FileText } from "lucide-react";
import ContratosForm from "@/components/medicoes/ContratosForm";
import { supabase } from "@/integrations/supabase/client";
import { Contrato } from "@/types/medicoes";
import { differenceInDays, parseISO, isBefore, startOfDay } from "date-fns";

export default function ContratosPage() {
  const { contratos, isLoading, deleteContrato } = useContratos();
  const { clientes } = useClientes();
  const [isOpen, setIsOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este contrato e seus aditivos?")) {
      deleteContrato.mutate(id);
    }
  };

  const handleEdit = (contrato: Contrato) => {
    setEditingContrato(contrato);
    setIsOpen(true);
  };

  const calcularStatus = (prazoFim?: string) => {
    if (!prazoFim) return { label: "Sem Prazo", color: "bg-gray-100 text-gray-800", icon: <ScrollText className="h-3 w-3" /> };
    
    const fim = parseISO(prazoFim);
    const hoje = startOfDay(new Date());
    const diasRestantes = differenceInDays(fim, hoje);

    if (isBefore(fim, hoje)) {
      return { label: "Vencido", color: "bg-red-100 text-red-800", icon: <CalendarX className="h-3 w-3" /> };
    }
    
    if (diasRestantes <= 30) {
      return { label: "Vence em breve", color: "bg-yellow-100 text-yellow-800", icon: <AlertTriangle className="h-3 w-3" /> };
    }

    return { label: "Vigente", color: "bg-green-100 text-green-800", icon: <CalendarCheck className="h-3 w-3" /> };
  };

  const formatCurrency = (val?: number) => val ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : "-";
  const formatDate = (val?: string) => val ? parseISO(val).toLocaleDateString('pt-BR') : "-";

  const getClientesNomes = (ids?: string[]) => {
    if (!ids || ids.length === 0) return "-";
    return ids.map(id => clientes.find(c => c.id === id)?.razao_social || 'Desconhecido').join(", ");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Contratos e Aditivos</h2>
          <p className="text-sm text-muted-foreground">Gerencie todos os contratos da empresa.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setEditingContrato(null); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl h-[90vh] overflow-y-auto">
            <ContratosForm 
              contratoToEdit={editingContrato} 
              onClose={() => { setIsOpen(false); setEditingContrato(null); }} 
              contratos={contratos}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Lista de Contratos Principais ({contratos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8">Carregando...</p>
          ) : contratos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum contrato cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Contrato</TableHead>
                  <TableHead>Contrato / Objeto</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead>Valor Integrado</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((c) => {
                  const statusInfo = calcularStatus(c.prazo_fim);
                  // Calculate integrated total (parent + additives)
                  const aditivosVal = c.aditivos?.reduce((acc, aditi) => acc + (aditi.valor_total || 0), 0) || 0;
                  const valorTotalIntegrado = (c.valor_total || 0) + aditivosVal;

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm font-semibold whitespace-nowrap">
                        {c.numero_contrato || "-"}
                      </TableCell>
                      <TableCell>
                          {c.escopo || "Contrato s/ Objeto Definido"}
                        </div>
                        {c.aditivos && c.aditivos.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                              Aditivos ({c.aditivos.length})
                            </div>
                            {c.aditivos.map((ad, idx) => (
                              <div key={ad.id} className="flex items-center justify-between bg-muted/50 p-1.5 rounded border border-muted-foreground/10 text-[11px]">
                                <span className="font-medium truncate max-w-[120px]">
                                  Aditivo #{idx + 1}
                                </span>
                                <div className="flex gap-1">
                                  {ad.arquivo_url && (
                                    <button 
                                      className="text-blue-600 hover:text-blue-800"
                                      onClick={async () => {
                                        const { data } = await supabase.storage.from('contratos').createSignedUrl(ad.arquivo_url!, 3600);
                                        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                      }}
                                    >
                                      <FileText className="h-3 w-3" />
                                    </button>
                                  )}
                                  <button onClick={() => handleEdit(ad)} className="text-muted-foreground hover:text-primary">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={getClientesNomes(c.cliente_ids)}>
                        {getClientesNomes(c.cliente_ids)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatCurrency(valorTotalIntegrado)}
                        {aditivosVal > 0 && (
                          <span className="block text-xs text-muted-foreground">Original: {formatCurrency(c.valor_total)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        De {formatDate(c.prazo_inicio)}<br/>
                        Até <span className="font-semibold">{formatDate(c.prazo_fim)}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {c.arquivo_url && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Ver arquivo original"
                              onClick={async () => {
                                const { data } = await supabase.storage.from('contratos').createSignedUrl(c.arquivo_url, 3600);
                                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                              }}
                            >
                              <FileText className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
