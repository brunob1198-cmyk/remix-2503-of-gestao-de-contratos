import { useState } from "react";
import { useBdiConfig, useBdiMensal, useToggleBdiVariavel, useAddBdiMensal, useUpdateBdiMensal, useDeleteBdiMensal } from "@/hooks/useProjetoBdiMensal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Trash2, Pencil, Check, X, CalendarDays, AlertTriangle } from "lucide-react";

function BdiMensalCalendar({ projetoId, bdiPadrao }: { projetoId: string; bdiPadrao: number | null }) {
  const { data: bdis, isLoading } = useBdiMensal(projetoId);
  const addBdi = useAddBdiMensal();
  const updateBdi = useUpdateBdiMensal();
  const deleteBdi = useDeleteBdiMensal();

  const [mesCompetencia, setMesCompetencia] = useState("");
  const [bdiInput, setBdiInput] = useState("");
  const [observacaoInput, setObservacaoInput] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBdi, setEditBdi] = useState("");
  const [editObs, setEditObs] = useState("");

  const handleAdd = () => {
    if (!mesCompetencia || !bdiInput) return;
    addBdi.mutate({ 
      projetoId, 
      mesCompetencia, 
      bdi: parseFloat(bdiInput), 
      observacao: observacaoInput 
    }, {
      onSuccess: () => {
        setMesCompetencia("");
        setBdiInput("");
        setObservacaoInput("");
      }
    });
  };

  const handleStartEdit = (bdiRecord: any) => {
    setEditingId(bdiRecord.id);
    setEditBdi(String(bdiRecord.bdi));
    setEditObs(bdiRecord.observacao || "");
  };

  const handleSaveEdit = (id: string) => {
    updateBdi.mutate({ id, bdi: parseFloat(editBdi), observacao: editObs }, {
      onSuccess: () => setEditingId(null)
    });
  };

  // Check if current month has BDI
  const currentDate = new Date();
  const currentKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
  const hasCurrentMonthBdi = bdis?.some(b => b.competencia === currentKey);

  return (
    <div className="pt-2 space-y-4">
      {!hasCurrentMonthBdi && bdiPadrao === null && (
        <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 p-3 rounded-md text-sm border border-yellow-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>Nenhum BDI cadastrado para o mês atual e nenhum BDI padrão configurado. A análise de custos pode retornar erro ou custo zero para este mês.</p>
        </div>
      )}

      <div className="flex items-end gap-3 bg-muted/50 p-3 rounded-md">
        <div className="space-y-1">
          <label className="text-xs font-medium">Mês Competência</label>
          <Input type="month" value={mesCompetencia} onChange={e => setMesCompetencia(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">BDI</label>
          <Input type="number" step="0.0001" min="0.0001" max="9.9999" placeholder="ex: 2.8400" value={bdiInput} onChange={e => setBdiInput(e.target.value)} className="w-32" />
        </div>
        <div className="space-y-1 flex-1">
          <label className="text-xs font-medium">Observação (opcional)</label>
          <Input type="text" value={observacaoInput} onChange={e => setObservacaoInput(e.target.value)} />
        </div>
        <Button onClick={handleAdd} disabled={!mesCompetencia || !bdiInput || addBdi.isPending}>+ Adicionar</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mês/Ano</TableHead>
            <TableHead>BDI</TableHead>
            <TableHead>Observação</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bdis?.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Nenhum BDI mensal cadastrado.</TableCell></TableRow>
          )}
          {bdis?.map(item => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {new Date(item.competencia).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
              </TableCell>
              <TableCell>
                {editingId === item.id ? (
                  <Input type="number" step="0.0001" value={editBdi} onChange={e => setEditBdi(e.target.value)} className="w-24" />
                ) : (
                  Number(item.bdi).toFixed(4)
                )}
              </TableCell>
              <TableCell>
                {editingId === item.id ? (
                  <Input type="text" value={editObs} onChange={e => setEditObs(e.target.value)} />
                ) : (
                  item.observacao || "-"
                )}
              </TableCell>
              <TableCell>
                {editingId === item.id ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleSaveEdit(item.id)} disabled={updateBdi.isPending}><Check className="h-4 w-4 text-green-600" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}><X className="h-4 w-4 text-muted-foreground" /></Button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleStartEdit(item)}><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteBdi.mutate(item.id)} disabled={deleteBdi.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function BdiConfigCard() {
  const { data: projetos, isLoading } = useBdiConfig();
  const toggleBdi = useToggleBdiVariavel();

  if (isLoading) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Configuração de BDI por Projeto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead className="w-[150px]">Modo</TableHead>
                <TableHead className="w-[200px]">BDI Padrão (Fallback)</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projetos?.map(projeto => (
                <TableRow key={projeto.id} className="border-b-0 hover:bg-transparent">
                  <TableCell colSpan={4} className="p-0">
                    <div className="flex items-center px-4 py-2 hover:bg-muted/50 transition-colors border-b">
                      <div className="flex-1 font-medium">{projeto.codigo} - {projeto.nome}</div>
                      <div className="w-[150px] flex items-center gap-2">
                        <Switch 
                          checked={projeto.bdi_variavel} 
                          onCheckedChange={(val) => toggleBdi.mutate({ id: projeto.id, bdi_variavel: val, bdi_padrao: val ? projeto.bdi_padrao : null })}
                          disabled={toggleBdi.isPending}
                        />
                        <span className="text-sm">{projeto.bdi_variavel ? "Variável" : "Fixo"}</span>
                      </div>
                      <div className="w-[200px] px-2">
                        {projeto.bdi_variavel && (
                          <Input 
                            type="number" 
                            step="0.0001" 
                            placeholder="ex: 2.8400" 
                            defaultValue={projeto.bdi_padrao || ""}
                            className="h-8"
                            onBlur={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : null;
                              if (val !== projeto.bdi_padrao) {
                                toggleBdi.mutate({ id: projeto.id, bdi_variavel: true, bdi_padrao: val });
                              }
                            }}
                          />
                        )}
                      </div>
                      <div className="w-[100px] text-right">
                        {projeto.bdi_variavel ? <Badge variant="default" className="bg-blue-500">Variável</Badge> : <Badge variant="secondary">Fixo da LPU</Badge>}
                      </div>
                    </div>
                    {projeto.bdi_variavel && (
                      <AccordionItem value={projeto.id} className="border-0 px-4">
                        <AccordionTrigger className="py-2 text-sm text-blue-600 hover:no-underline hover:text-blue-800">
                          Calendário de BDI — {projeto.codigo}
                        </AccordionTrigger>
                        <AccordionContent>
                          <BdiMensalCalendar projetoId={projeto.id} bdiPadrao={projeto.bdi_padrao} />
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Accordion>
      </CardContent>
    </Card>
  );
}
