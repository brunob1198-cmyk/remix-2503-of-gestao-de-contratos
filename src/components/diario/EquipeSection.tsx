import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Pencil, Trash2, X } from "lucide-react";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface EquipeSectionProps {
  equipe: any[];
  recursosPessoa: any[];
  recursos: any[];
  getCustoAtual: (id: string) => { custo_unitario?: number } | undefined | null;
  onAdd: (recursoId: string, horas: string, custoHora: string) => Promise<void> | void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, horas: string, custoHora: string) => Promise<void> | void;
}

function EquipeSection({
  equipe,
  recursosPessoa,
  recursos,
  getCustoAtual,
  onAdd,
  onRemove,
  onUpdate,
}: EquipeSectionProps) {
  const [eqRecursoId, setEqRecursoId] = useState("");
  const [eqHoras, setEqHoras] = useState("0");
  const [eqCustoHora, setEqCustoHora] = useState("");
  const [editingEquipeId, setEditingEquipeId] = useState<string | null>(null);
  const [editEquipeHoras, setEditEquipeHoras] = useState("");
  const [editEquipeCustoHora, setEditEquipeCustoHora] = useState("");

  const handleAdd = async () => {
    await onAdd(eqRecursoId, eqHoras, eqCustoHora);
    setEqRecursoId("");
    setEqHoras("0");
    setEqCustoHora("");
  };

  return (
    <Card>
      <CardHeader><CardTitle>Equipe</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select
            value={eqRecursoId}
            onValueChange={v => {
              setEqRecursoId(v);
              const r = recursos.find(x => x.id === v);
              setEqCustoHora(r ? String(getCustoAtual(r.id)?.custo_unitario || 0) : "");
            }}
          >
            <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione pessoa" /></SelectTrigger>
            <SelectContent>
              {recursosPessoa.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" value={eqHoras} onChange={e => setEqHoras(e.target.value)} placeholder="Horas" className="w-24" />
          <Input type="number" value={eqCustoHora} onChange={e => setEqCustoHora(e.target.value)} placeholder="Custo/h" className="w-24" />
          <Button onClick={handleAdd}>Adicionar</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipe.map(e => (
              <TableRow key={e.id}>
                <TableCell>{e.nome}</TableCell>
                <TableCell className="text-right">
                  {editingEquipeId === e.id ? (
                    <div className="flex flex-col gap-1 items-end">
                      <Input
                        type="number"
                        value={editEquipeHoras}
                        onChange={ev => setEditEquipeHoras(ev.target.value)}
                        className="w-20 h-8"
                        placeholder="Horas"
                      />
                      <Input
                        type="number"
                        value={editEquipeCustoHora}
                        onChange={ev => setEditEquipeCustoHora(ev.target.value)}
                        className="w-20 h-8 text-xs"
                        placeholder="Custo/h"
                      />
                    </div>
                  ) : (
                    e.horas
                  )}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(e.custo_total)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    {editingEquipeId === e.id ? (
                      <>
                        <Button variant="ghost" size="icon" onClick={async () => { await onUpdate(e.id, editEquipeHoras, editEquipeCustoHora); setEditingEquipeId(null); }} className="h-8 w-8 text-green-600">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditingEquipeId(null)} className="h-8 w-8 text-red-600">
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingEquipeId(e.id);
                            setEditEquipeHoras(String(e.horas));
                            setEditEquipeCustoHora(String(e.custo_hora));
                          }}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onRemove(e.id)} className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default React.memo(EquipeSection);
