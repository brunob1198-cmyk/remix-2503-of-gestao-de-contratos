import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SgsstAso, useSgsstAsoHistorico, calculateVencimentoAso } from "@/hooks/sgsst/useSgsstAsosAndExames";
import { Stethoscope, CheckCircle2, AlertTriangle, XCircle, Clock, History } from "lucide-react";
import { format, parseISO } from "date-fns";

interface AsoDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aso: SgsstAso | null;
}

export function AsoDetailDialog({
  open,
  onOpenChange,
  aso,
}: AsoDetailDialogProps) {
  const { historico } = useSgsstAsoHistorico(aso?.id);

  if (!aso) return null;

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const getAptidaoBadge = (apt?: string | null) => {
    // Sem conclusão é estado próprio, e não o ramo do apto: quem abre o ASO precisa
    // distinguir "o médico concluiu apto" de "ninguém concluiu nada".
    if (!apt) {
      return (
        <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
          A concluir pelo médico
        </Badge>
      );
    }
    switch (apt) {
      case "APTO":
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">APTO</Badge>;
      case "APTO_COM_RESTRICAO":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">APTO COM RESTRIÇÃO</Badge>;
      case "INAPTO":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold">INAPTO</Badge>;
      default:
        return <Badge variant="outline">{apt}</Badge>;
    }
  };

  const statusVencimento = calculateVencimentoAso(aso.validade);

  const getVencimentoBadge = () => {
    switch (statusVencimento) {
      case "VALIDO":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">VÁLIDO</Badge>;
      case "PROXIMO_VENCIMENTO":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-semibold">PRÓXIMO AO VENCIMENTO</Badge>;
      case "VENCIDO":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold">VENCIDO</Badge>;
    }
  };

  const colabNome = aso.colaborador?.profile?.nome || aso.colaborador?.recurso?.nome || aso.colaborador?.nome || "Sem Nome";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              ASO — Atestado de Saúde Ocupacional
            </DialogTitle>
            {getVencimentoBadge()}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs sm:text-sm">
          {/* Main Info */}
          <div className="p-3 bg-muted/30 rounded border space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm">{colabNome}</span>
              <span className="font-mono text-xs text-muted-foreground">CPF: {aso.colaborador?.cpf || "—"}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Função: <strong>{aso.colaborador?.funcao?.nome || "—"}</strong> | Número ASO: <strong>{aso.numero_documento || "—"}</strong> | Status: <strong>{aso.status}</strong>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-muted-foreground block text-xs">Tipo de Exame:</span>
              <Badge variant="outline" className="text-xs">{aso.tipo}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Conclusão de Aptidão:</span>
              {getAptidaoBadge(aso.aptidao)}
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Validade do ASO:</span>
              <span className="font-mono font-bold">{formatDateStr(aso.validade)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <span className="text-muted-foreground block text-xs">Data de Emissão:</span>
              <span className="font-semibold">{formatDateStr(aso.data_emissao)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Médico Responsável / CRM:</span>
              <span className="font-semibold">{aso.medico_responsavel || "—"} ({aso.crm_medico || "Sem CRM"})</span>
            </div>
          </div>

          {/* Restrição Section */}
          {aso.aptidao === "APTO_COM_RESTRICAO" && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded space-y-1.5 text-xs">
              <span className="font-bold text-amber-900 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Detalhes da Restrição Ocupacional:
              </span>
              <p className="text-amber-900">{aso.descricao_restricao || "Restrição não detalhada."}</p>
              <div className="text-[11px] text-amber-800">
                Período: {formatDateStr(aso.data_inicio_restricao)} até {formatDateStr(aso.data_termino_restricao)}
              </div>
            </div>
          )}

          {aso.observacoes && (
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-semibold">Observações Gerais:</span>
              <p className="text-xs bg-muted/30 p-2 rounded border">{aso.observacoes}</p>
            </div>
          )}

          {/* Audit History */}
          <div className="space-y-2 pt-2 border-t">
            <h4 className="font-semibold text-xs flex items-center gap-1">
              <History className="h-3.5 w-3.5" /> Trilha de Auditoria do ASO
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data/Hora</TableHead>
                  <TableHead className="text-xs">Operação</TableHead>
                  <TableHead className="text-xs">Usuário</TableHead>
                  <TableHead className="text-xs">Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-4 text-xs text-muted-foreground">Sem registros de histórico.</TableCell></TableRow>
                ) : (
                  historico.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-mono text-xs">{formatDateStr(h.created_at)}</TableCell>
                      <TableCell className="text-xs font-bold">{h.operacao}</TableCell>
                      <TableCell className="text-xs">{h.usuario?.nome || "Sistema"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.observacao || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
